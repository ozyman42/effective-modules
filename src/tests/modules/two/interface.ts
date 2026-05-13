import { PossibleError } from "../../errors";
import { type fn, ServiceClass } from "../../effect";

export interface ITwo {
  FinalThing(shouldError: boolean): fn.Return<string, PossibleError, never>
}

// Test a normal service class / tag class declaration mixed with others.
export class Two extends ServiceClass<Two, "TWO", ITwo>("TWO") {}
