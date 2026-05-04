import { PossibleError } from "../../errors";
import { Module } from "../";
import { type fn } from "../../effect";

export interface IOne {
  DoThing(argOne: number): fn.Return<{hello: "world"}, never, Module.two>;
  OtherThing(argTwo: string): fn.Return<void, PossibleError>;
}
