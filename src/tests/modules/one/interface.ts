import { type GenEffect } from "../../../";
import { PossibleError } from "../../errors";
import { Module } from "../";

export interface IOne {
  DoThing(argOne: number): GenEffect<{hello: "world"}, never, Module.two>;
  OtherThing(argTwo: string): GenEffect<void, PossibleError>;
}
