import { PossibleError } from "../../errors";
import { type fn } from "../../effect";
import type { Two } from "../two/interface";

export interface IOne {
  DoThing(argOne: number): fn.Return<{hello: "world"}, never, Two>;
  OtherThing(argTwo: string): fn.Return<void, PossibleError>;
}
