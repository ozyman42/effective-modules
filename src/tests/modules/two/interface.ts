import { PossibleError } from "../../errors";
import { type fn } from "../../effect";

export interface ITwo {
  FinalThing(shouldError: boolean): fn.Return<string, PossibleError, never>
}
