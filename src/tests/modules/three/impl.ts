import { implementing } from "../../..";
import { type fn } from "../../effect";
import { modules } from "..";
import { type IThree } from "./interface";

export class ThreeImpl extends implementing(modules.three) implements IThree {
  *hello(): fn.Return<"world"> {
    return "world";
  }
}