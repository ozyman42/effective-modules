import { EffectiveModulesError, EffectiveModulesErrorReason, Implementing, interfaces } from "../";
import { gen, log, catchTag, fn, runPromiseExit, provide, type Effect } from "effect/Effect";
import { replace, defaultLogger, make as makeLogger } from "effect/Logger";
import { provideMerge } from "effect/Layer";
import { Module, modules } from "./modules";
import { layer } from "./modules/layer";
import { FileSystem, layerNoop } from "@effect/platform/FileSystem";
import { Match } from "effect"

const program = gen(function*() {
  yield* log("starting program");
  const one = yield* modules.one;
  yield* one.OtherThing("argtwo");
}).pipe(
  catchTag("PossibleError", fn(function*(err) {
    yield* log("caught possible error from program", err.message);
  }))
)

runPromiseExit(program.pipe(provide(layer))).then(exit => {
  runPromiseExit(log("exit with", exit));
})

function layerWithLogToArray(logs: string[]) {
  return replace(defaultLogger, makeLogger(({ message }) => {
    logs.push(Array.isArray(message) ? message.map(String).join(" ") : String(message));
  }));
}

import { expect, test } from "bun:test";
import { TwoImpl } from "./modules/two/impl";
import { ThreeImpl } from "./modules/three/impl";

// Happy Path

test("happy path", () => {
  expect(2 + 2).toBe(4);
});

test("construction throws expected error", () => {})
test("multiple uses and multiple throws is undefined", () => {})
test("new base class created on each Implementing, Uses, Throws call", () => {})
test("no context or dependencies when nothing passed to Uses", () => {})
test("no implementation returned when passed a non dependency to getDependencies", () => {})

// Expected failures

function expectDefect<E extends Error>(CustomErrorClass: new (...args: any[]) => E, effect: Effect<void, any, never>): Promise<E> {
  const err = runPromiseExit(effect).then(exit => {
    const defectOrExitReason = exit.pipe(
      Match.value,
      Match.tagsExhaustive({
        Success: () => "successful exit",
        Failure: f => f.cause.pipe(
          Match.value,
          Match.tagsExhaustive({
            Empty: () => "empty failure exit",
            Die: defect => defect.defect,
            Interrupt: () => "interrupt failure exit",
            Fail: fail => `fail exit with expected error ${fail.error.name}`,
            Sequential: () => "sequential failure exit",
            Parallel: () => "parallel failure exit"
          })
        ),
      })
    )
    expect(defectOrExitReason).toBeInstanceOf(CustomErrorClass);
    return defectOrExitReason as E;
  });
  return err;
}

test("failure when instantiating superclass directly", () => {
  // 1. Test direct instantiation (might not be possible)
  // 2. Test Layer instantiation

})

test("failure when no Uses args", () => {})
test("failure when Uses arg is same as module", () => {})
test("failure when accessing context and dependencies within constructor", () => {})

test("failure when uses arg is not a module", () => {

});

test("failure when implementing arg not a module", () => {

});

test("failure when custom instantiation is not returning all required dependencies", async () => {
  class OneImplMissingAllDeps extends Implementing(modules.one).Uses(modules.two) {
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
  class OneImplMissingOneDep extends Implementing(modules.one).Uses(modules.two, FileSystem) {
    constructor() {
      super(function*() {
        const two = yield* modules.two;
        return {
          two
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
