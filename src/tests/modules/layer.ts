import { provideMerge, type Layer } from "../effect";
import { Module } from "./";
import { OneImpl } from "./one/impl";
import { TwoImpl } from "./two/impl";
import { ThreeImpl } from "./three/impl";

export const layer = OneImpl.Layer.pipe(
  provideMerge(TwoImpl.Layer),
  provideMerge(ThreeImpl.Layer)
) satisfies Layer<Module, any, never>;
