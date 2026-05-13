import { interfaces } from "../../";
import type { IOne } from "./one/interface";
import type { IThree } from "./three/interface";

export enum Module {
  one = "one",
  three = "three"
}

export const modules = interfaces<Module, {
  one: IOne,
  [Module.three]: IThree
}>(Module);

