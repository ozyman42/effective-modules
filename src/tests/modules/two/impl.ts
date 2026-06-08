import { log, type fn } from "../../effect";
import { implementing } from "../../.."
import { PossibleError } from "../../errors";
import { Two, type ITwo } from "./interface";

export class TwoImpl extends implementing(Two).throws<PossibleError>() implements ITwo {
  *FinalThing(shouldError: boolean): fn.Return<string, PossibleError, never> {
    yield* log("Final thing");
    if (shouldError) {
      yield* log("yielding possible error");
      return yield* new PossibleError();
    }
    return "final thing";
  } 
}