export { type Effect, fn, gen, dieMessage } from "effect-3/Effect";
export { type Tag as Service, type Context, empty as emptyContext, add as addToContext } from "effect-3/Context";
export { type UnionToIntersection, type Simplify } from "effect-3/Types";
export { type Layer, effect as layerFromEffect, succeed as layerFromImpl } from "effect-3/Layer";
export { type Option, none, isNone, some } from "effect-3/Option";

import { Tag } from "effect-3/Context";

export function makeService(key: string) {
  return Tag(key)();
}

export function isService(service: Tag<any, any>) {
  return service._op === "Tag";
}
