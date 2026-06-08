import { EffectiveModulesError, EffectiveModulesErrorReason, effunct, implementing, interfaces } from "..";
import { Module, modules } from "./modules";

import {
  gen, log, fn,
  runPromiseExit, provide, type Effect, provideService,
  layerWithLogToArray,
  provideMerge,
  FileSystem, layerNoop,
  value, tagsExhaustive, matchCause
} from "./effect";

import { expect, test } from "bun:test";
import { TwoImpl } from "./modules/two/impl";
import { ThreeImpl } from "./modules/three/impl";
import { OneImpl } from "./modules/one/impl";
import type { IOne } from "./modules/one/interface";
import { PossibleError } from "./errors";
import { Two, type ITwo } from "./modules/two/interface";

// Happy Path

test("happy path", async () => {
  const logs: string[] = [];

  await expectError(PossibleError, gen(function*() {
    const two = yield* Two;
    yield* two.FinalThing(true);
    // Below should never be called
    expect(1).toBe(2);
  }).pipe(
    provide(TwoImpl.Layer.pipe(
      provideMerge(layerWithLogToArray(logs))
    ))
  ));
  expect(logs).toEqual(["Final thing", "yielding possible error"]);

  const logs2: string[] = [];
  await expectNoIssue(gen(function*() {
    const one = yield* modules.one;
    yield* one.OtherThing("arg");
  }).pipe(
    provide(OneImpl.Layer.pipe(
      provideMerge(TwoImpl.Layer),
      provideMerge(ThreeImpl.Layer),
      provideMerge(layerWithLogToArray(logs2))
    ))
  ));
  expect(logs2).toEqual([
    "Running initializer for module one",
    "Three says world",
    "confirming yield item",
    "confirming yield item",
    "OtherThing 5 5",
    "do thing",
    "yielded module two and three's world",
    "Final thing",
    "yielding possible error",
    "DoThing caught & handled",
    "got world",
    "now directly call two",
    "Final thing",
    "Got final thing from two",
    "Final thing",
    "yielding possible error",
    "Got error PossibleError from two"
  ]);
});

test("construction throws expected error", async () => {
  // Throws 
  class TwoThrowsError extends implementing(Two).throws<PossibleError>() {
    constructor() {
      super(function*() {
        yield* new PossibleError();
      })
    }
  }
  await expectError(PossibleError, gen(function*() {
    const two = yield* Two;
  }).pipe(
    provide(TwoThrowsError.Layer)
  ));
  // No Throws
  class TwoNoThrows extends implementing(Two).throws<PossibleError>() {
    constructor() {
      super(function*() {})
    }
  }
  await expectNoIssue(gen(function*() {
    const two = yield* Two;
  }).pipe(
    provide(TwoNoThrows.Layer)
  ));
})

test("multiple uses and multiple throws is undefined", () => {
  const secondThrows = (implementing(modules.one).uses(Two).throws() as any).throws;
  const secondUses = (implementing(modules.one).uses(Two) as any).uses;
  expect(secondThrows).toBeUndefined();
  expect(secondUses).toBeUndefined();
})

test("new base class created on each implementing, uses, throws call", () => {
  const baseClassOne = implementing(modules.one);
  const baseClassTwo = baseClassOne.uses(Two);
  const baseClassThree = baseClassTwo.throws();
  expect(baseClassOne).not.toBe(baseClassTwo);
  expect(baseClassTwo).not.toBe(baseClassThree);
  expect(baseClassThree).not.toBe(baseClassOne);
  expect(baseClassOne).toBe(baseClassOne);
  expect(baseClassTwo).toBe(baseClassTwo);
  expect(baseClassThree).toBe(baseClassThree);
})

test("no context or dependencies when nothing passed to uses", async () => {
  // With Throws
  class TwoWithThrows extends implementing(Two).throws<PossibleError>() implements ITwo {
    *FinalThing(shouldError: boolean): fn.Return<string, PossibleError, never> {
      expect((this as any).dependencies).toBeUndefined();
      expect((this as any).context).toBeUndefined();
      expect((this as any).getDependencies).toBeUndefined();
      return "hello world" 
    }
  }
  await expectNoIssue(gen(function*() {
    const two = yield* Two;
    yield* two.FinalThing(false);
  }).pipe(
    provide(TwoWithThrows.Layer)
  ));
  // Without Throws
  class TwoWithoutThrows extends implementing(Two).throws<PossibleError>() implements ITwo {
    *FinalThing(shouldError: boolean): fn.Return<string, PossibleError, never> {
      expect((this as any).dependencies).toBeUndefined();
      expect((this as any).context).toBeUndefined();
      expect((this as any).getDependency).toBeUndefined();
      return "hello world" 
    }
  }
  await expectNoIssue(gen(function*() {
    const two = yield* Two;
    yield* two.FinalThing(false);
  }).pipe(
    provide(TwoWithoutThrows.Layer)
  ));
  // Is defined when uses is present
  class TwoWithUses extends implementing(Two).uses(FileSystem) implements ITwo {
    *FinalThing(shouldError: boolean): fn.Return<string, PossibleError, never> {
      expect((this as any).dependencies).toBeDefined();
      expect((this as any).context).toBeDefined();
      expect((this as any).getDependency).toBeDefined();
      return "hello world" 
    }
  }
  await expectNoIssue(gen(function*() {
    const two = yield* Two;
    yield* two.FinalThing(false);
  }).pipe(
    provide(TwoWithUses.Layer.pipe(
      provideMerge(layerNoop({}))
    ))
  ));
})

test("no implementation returned when passed a non dependency to getDependencies", async () => {
  class OneImplTestGetDependency extends implementing(modules.one).uses(Two, FileSystem) implements IOne {
    *DoThing(argOne: number): fn.Return<{ hello: "world"; }, never, Two> {
      // Valid dependency
      const twoFromYield = yield* Two;
      const twoFromConstruction = this.getDependency(Two);
      expect(twoFromYield).toBe(twoFromConstruction);
      expect(twoFromConstruction).toBeDefined();
      expect(twoFromConstruction.FinalThing).toBeDefined();
      expect((twoFromConstruction as any).randomThing).toBeUndefined();
      expect(this.getDependency(FileSystem)).toBeDefined();
      expect(this.context).toBeDefined();
      expect(this.dependencies).toBeDefined();
      expect(this.dependencies.TWO).toBeDefined();
      expect((this.dependencies as any)[FileSystem.key]).toBeDefined();
      // Invalid dependency
      expect(this.getDependency(modules.three as any)).toBeUndefined();
      expect((this.dependencies as any)[modules.three.key]).toBeUndefined();
      return {hello: "world"};
    }
    *OtherThing(argTwo: string): fn.Return<void, PossibleError> {}
  }
  await expectNoIssue(gen(function*() {
    const one = yield* modules.one;
    yield* one.DoThing(1);
  }).pipe(
    provide(
      OneImplTestGetDependency.Layer.pipe(
        provideMerge(TwoImpl.Layer),
        provideMerge(layerNoop({}))
      )
    )
  ));
})

test("mockLayer some methods defined some not", async () => {
  // Off of implementing
  const mockedOneDirectImplementing = implementing(modules.one).mockLayer({
    *DoThing(argOne) {
      return {hello: 'world'};
    }
  });
  const dieError = await expectDefect(Error, gen(function*() {
    const one = yield* modules.one;
    const two = yield* Two;
    expect(one.OtherThing).toBeDefined();
    expect(one.DoThing).toBeDefined();
    const {hello} = yield* effunct(one.DoThing)(1).pipe(
      provideService(Two, two)
    );
    expect(hello).toBe("world");
    yield* one.OtherThing("");
  }).pipe(
    provide(mockedOneDirectImplementing.pipe(
      provideMerge(TwoImpl.Layer),
    ))
  ));
  expect(dieError.message).toBe(`Property OtherThing not implemented on mock for one`);

  // Off of class
  const mockedOneFromImpl = OneImpl.mockLayer({
    *OtherThing(argTwo) {
      yield* log(`Arg two is ${argTwo}`);
    }
  });

  const logs: string[] = [];
  const dieError2 = await expectDefect(Error, gen(function*() {
    const one = yield* modules.one;
    expect(one.DoThing).toBeDefined();
    expect(one.OtherThing).toBeDefined();
    yield* one.OtherThing("hi");
    yield* one.DoThing(2);
  }).pipe(
    provide(
      mockedOneFromImpl.pipe(
        provideMerge(TwoImpl.Layer),
        provideMerge(layerWithLogToArray(logs))
      )
    )
  ));
  expect(dieError2.message).toBe(`Property DoThing not implemented on mock for one`);
  expect(logs).toEqual(["Arg two is hi"]);
});

function expectNoIssue(effect: Effect<void, any, never>): Promise<void> {
  return runPromiseExit(effect).then(exit => {
    const successOrExitReason = exit.pipe(
      value,
      tagsExhaustive({
        Success: () => ({success: true}),
        Failure: f => matchCause(f.cause, {
          empty:     () => ({success: false, reason: "empty failure exit"}),
          die:       defect => ({success: false, reason: `defect: ${defect}`}),
          interrupt: () => ({success: false, reason: "interrupt failure exit"}),
          fail:      error => ({success: false, reason: `error: ${error}`}),
        }),
      })
    );
    expect(successOrExitReason).toEqual({success: true});
  });
}

function expectError<E extends Error>(CustomErrorClass: new (...args: any[]) => E, effect: Effect<void, E, never>): Promise<E> {
  const err = runPromiseExit(effect).then(exit => {
    const expectedErrorOrExitReason = exit.pipe(
      value,
      tagsExhaustive({
        Success: () => "successful exit",
        Failure: (f): E | string => matchCause(f.cause, {
          empty:     () => "empty failure exit",
          die:       defect => `defect: ${defect}`,
          interrupt: () => "interrupt failure exit",
          fail:      error => error as any,
        }),
      })
    );
    expect(expectedErrorOrExitReason).toBeInstanceOf(CustomErrorClass);
    return expectedErrorOrExitReason as E;
  });
  return err;
}

// Expected failures

function expectDefect<E extends Error>(CustomErrorClass: new (...args: any[]) => E, effect: Effect<void, any, never>): Promise<E> {
  const err = runPromiseExit(effect).then(exit => {
    const defectOrExitReason = exit.pipe(
      value,
      tagsExhaustive({
        Success: () => "successful exit",
        Failure: f => matchCause(f.cause, {
          empty:     () => "empty failure exit",
          die:       defect => defect,
          interrupt: () => "interrupt failure exit",
          fail:      error => `fail exit with expected error ${(error as any).name}`,
        }),
      })
    );
    expect(defectOrExitReason).toBeInstanceOf(CustomErrorClass);
    return defectOrExitReason as E;
  });
  return err;
}

test("failure when instantiating superclass directly", async () => {
  // 1. Test direct instantiation
  const errDirectInstance = await expectDefect(EffectiveModulesError, gen(function*() {
    const Module = implementing(modules.one).uses(Two);
    new (Module as any)();
  }));
  expect(errDirectInstance.reason).toBe(EffectiveModulesErrorReason.TryingToInstantiateSuperclass);
  // 2. Test Layer instantiation
  const errLayer = await expectDefect(EffectiveModulesError, gen(function*() {
    yield* modules.one;
  }).pipe(provide(implementing(modules.one).throws().Layer)));
  expect(errLayer.reason).toBe(EffectiveModulesErrorReason.TryingToInstantiateSuperclass);
});

test("failure when no uses args", async () => {
  const err = await expectDefect(EffectiveModulesError, gen(function*() {
    (implementing(modules.one).uses as any)();
  }));
  expect(err.reason).toBe(EffectiveModulesErrorReason.PassedNothingToUses);
});

test("failure when uses arg is same as module", async () => {
  const err = await expectDefect(EffectiveModulesError, gen(function*() {
    implementing(modules.one).uses(modules.one as any);
  }));
  expect(err.reason).toBe(EffectiveModulesErrorReason.TryingToCreateModuleDependingOnItself);
});

test("failure when accessing context and dependencies within constructor", async () => {
  // Accessing dependencies in constructor
  class OneImplImproperAccessDependencies extends implementing(modules.one).uses(Two) {
    constructor() {
      super();
      this.dependencies;
    }
  }
  const errDependencies = await expectDefect(EffectiveModulesError, gen(function*() {
    yield* modules.one;
  }).pipe(
    provide(OneImplImproperAccessDependencies.Layer.pipe(
      provideMerge(TwoImpl.Layer)
    ))
  ));
  expect(errDependencies.reason).toBe(EffectiveModulesErrorReason.DependenciesNotInitialized);
  
  // Accessing context in constructor
  class OneImplImproperAccessContext extends implementing(modules.one).uses(Two) {
    constructor() {
      super();
      this.context;
    }
  }
  const errContext = await expectDefect(EffectiveModulesError, gen(function*() {
    yield* modules.one;
  }).pipe(
    provide(OneImplImproperAccessContext.Layer.pipe(
      provideMerge(TwoImpl.Layer)
    ))
  ));
  expect(errContext.reason).toBe(EffectiveModulesErrorReason.ContextNotInitialized);
});

test("failure when uses arg is not a module", async () => {
  const err = await expectDefect(EffectiveModulesError, gen(function*() {
    implementing(modules.one).uses(Two, {} as any, modules.three);
  }));
  expect(err.reason).toBe(EffectiveModulesErrorReason.PassedNonTagToUses);
});

test("failure when implementing arg not a module", async () => {
  const err = await expectDefect(EffectiveModulesError, gen(function*() {
    implementing({} as any);
  }));
  expect(err.reason).toBe(EffectiveModulesErrorReason.PassedNonTagToImplementing);
});

test("failure when custom instantiation is not returning all required dependencies", async () => {
  class OneImplMissingAllDeps extends implementing(modules.one).uses(Two) {
    constructor() {
      super(function*() {
        return {} as any;
      })
    }
  }
  const oneLayerMissingAllDeps = OneImplMissingAllDeps.Layer;
  const oneMissingAllDepsError = await expectDefect(EffectiveModulesError, gen(function*() {
    yield* modules.one;
  }).pipe(
    provide(oneLayerMissingAllDeps.pipe(
      provideMerge(TwoImpl.Layer),
      provideMerge(ThreeImpl.Layer)
    ))
  ));
  expect(oneMissingAllDepsError.reason).toBe(EffectiveModulesErrorReason.CustomInitializerMissingDependencies);
  // Test a non custom module as well, like FS for example
  class OneImplMissingOneDep extends implementing(modules.one).uses(Two, FileSystem) {
    constructor() {
      super(function*() {
        const two = yield* Two;
        return {
          TWO: two
        }
      })
    }
  }
  const oneLayerMissingOneDep = OneImplMissingOneDep.Layer;
  const oneMissingOneDepError = await expectDefect(EffectiveModulesError, gen(function*() {
    yield* modules.one;
  }).pipe(
    provide(oneLayerMissingOneDep.pipe(
      provideMerge(TwoImpl.Layer),
      provideMerge(ThreeImpl.Layer),
      provideMerge(layerNoop({}))
    ))
  ));
  expect(oneMissingOneDepError.reason).toBe(EffectiveModulesErrorReason.CustomInitializerMissingDependencies);
})

test("failure when module keys input is not a identical key value object", async () => {
  const nonStringEnum = {...Module, not: "matching"};
  const error = await expectDefect(EffectiveModulesError, gen(function*() {
    interfaces(nonStringEnum as any);
  }));
  expect(error.reason).toBe(EffectiveModulesErrorReason.PassedNonStringEnumToInterfaces)
})
