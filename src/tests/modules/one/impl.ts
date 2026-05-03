import { pipe } from "effect";
import { log, catchTag, succeed, provide } from "effect/Effect";
import { Implementing, type GenEffect, effunct } from "../../../";
import { modules, Module } from "../";
import { OtherError, PossibleError } from "../../errors";
import { type IOne } from "./interface";

export class OneImpl extends Implementing(modules.one).Uses(modules.two, modules.three).Throws<OtherError>() implements IOne {
  private testInstanceVar = 5;

  constructor() {
    super(function*() {
      yield* log("Running initializer for module one");
      const three = yield* modules.three;
      yield* log(`Three says ${yield* three.hello()}`);
      return {
        two: yield* modules.two,
        three
      }
    });
  }

  *DoThing(argOne: number): GenEffect<{ hello: "world"; }, never, Module.two> {
    yield* log("do thing");
    const two = yield* modules.two;
    const three = this.getDependency(modules.three);
    yield* log("yielded module two", `and three's ${yield* three.hello()}`);
    const result = yield* pipe(
      effunct(two.FinalThing)(true),
      catchTag("PossibleError", err => succeed("caught & handled"))
    );
    yield* log("DoThing", result);
    return {hello: "world"};
  }
  *OtherThing(argTwo: string): GenEffect<void, PossibleError> {
    const item = yield* this.confirmYieldItem();
    const item2 = yield* effunct(this.confirmYieldItem)();

    yield* log("OtherThing", item, item2);
    yield* effunct(this.DoThing)(item).pipe(provide(this.context));
    yield* log("now directly call two");
    const result = yield* this.dependencies.two.FinalThing(false);
    yield* log(`Got ${result} from two`);
  }

  private *confirmYieldItem() {
    yield* log("confirming yield item");
    return this.testInstanceVar;
  }
}