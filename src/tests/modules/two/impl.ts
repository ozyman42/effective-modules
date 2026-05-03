import { log } from "effect/Effect";
import { Implementing, type GenEffect } from "../../../"
import { PossibleError } from "../../errors";
import { modules } from "../";
import { type ITwo } from "./interface";

export class TwoImpl extends Implementing(modules.two).Throws<PossibleError>() implements ITwo {
  *FinalThing(shouldError: boolean): GenEffect<string, PossibleError, never> {
    yield* log("Final thing");
    if (shouldError) {
      yield* log("yielding possible error");
      return yield* new PossibleError();
    }
    return "final thing";
  }
}