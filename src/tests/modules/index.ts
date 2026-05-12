import { interfaces } from "../../";
import type { IOne } from "./one/interface";
import type { IThree } from "./three/interface";
import type { ITwo } from "./two/interface";

export enum Module {
  one = "one",
  two = "two",
  three = "three"
}

export const modules = interfaces<Module, {
  one: IOne,
  [Module.two]: ITwo,
  [Module.three]: IThree
}>(Module);

