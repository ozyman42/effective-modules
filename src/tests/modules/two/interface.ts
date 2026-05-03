import { PossibleError } from "../../errors";
import { type GenEffect } from "../../../";

export interface ITwo {
  FinalThing(shouldError: boolean): GenEffect<string, PossibleError, never>
}
