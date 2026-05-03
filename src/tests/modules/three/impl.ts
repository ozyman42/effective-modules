import { Implementing, type GenEffect } from "../../../";
import { modules } from "../";
import { type IThree } from "./interface";

export class ThreeImpl extends Implementing(modules.three) implements IThree {
  *hello(): GenEffect<"world"> {
    return "world";
  }
}