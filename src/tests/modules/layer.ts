import { pipe } from "effect";
import { provideMerge, type Layer } from "effect/Layer";
import { Module } from "./";
import { OneImpl } from "./one/impl";
import { TwoImpl } from "./two/impl";
import { ThreeImpl } from "./three/impl";

export const layer = pipe(
  OneImpl.Layer,
  provideMerge(TwoImpl.Layer),
  provideMerge(ThreeImpl.Layer)
) satisfies Layer<Module, any, never>;
