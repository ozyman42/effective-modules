import { log, catchTag, succeed, provide, fn } from "../../effect";
import { implementing, effunct, type Initialize } from "../../../";
import { modules, Module } from "../";
import { OtherError, PossibleError } from "../../errors";
import { type IOne } from "./interface";

export class OneImpl extends implementing(modules.one).uses(modules.two, modules.three).throws<OtherError>() implements IOne {
  private testInstanceVar = 5;

  constructor() {
    super(function*(): Initialize<typeof OneImpl> {
      yield* log("Running initializer for module one");
      const three = yield* modules.three;
      yield* log(`Three says ${yield* three.hello()}`);
      return {
        two: yield* modules.two,
        three
      }
    });
  }

  *DoThing(argOne: number): fn.Return<{ hello: "world"; }, never, Module.two> {
    yield* log("do thing");
    const two = yield* modules.two;
    const three = this.getDependency(modules.three);
    yield* log("yielded module two", `and three's ${yield* three.hello()}`);
    const result = yield* effunct(two.FinalThing)(true).pipe(
      catchTag("PossibleError", err => succeed("caught & handled"))
    );
    yield* log("DoThing", result);
    return {hello: "world"};
  }
  *OtherThing(argTwo: string): fn.Return<void, PossibleError> {
    const item = yield* this.confirmYieldItem();
    const item2 = yield* effunct(this.confirmYieldItem)();
    yield* log("OtherThing", item, item2);
    const {hello} = yield* effunct(this.DoThing)(item).pipe(provide(this.context));
    yield* log(`got ${hello}`);
    yield* log("now directly call two");
    const result = yield* this.dependencies.two.FinalThing(false);
    yield* log(`Got ${result} from two`);
  }

  private *confirmYieldItem() {
    yield* log("confirming yield item");
    return this.testInstanceVar;
  }
}