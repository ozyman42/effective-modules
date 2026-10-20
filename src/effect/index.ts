export { type Effect, fn, gen } from "effect/Effect";
export { type Service, type Context, empty as emptyContext, add as addToContext, type ServiceClass } from "effect/Context";
export { type UnionToIntersection, type Simplify } from "effect/Types";
export { type Layer, effect as layerFromEffect, succeed as layerFromImpl } from "effect/Layer";
export { type Option, none, isNone, some } from "effect/Option";

import { die } from "effect/Effect";
import { Service, isKey } from "effect/Context";

export function dieMessage(message: string) {
  return die(new Error(message));
}

export function makeService(key: string) {
  return Service(key);
}

export function isService(service: Service<any, any>) {
  return isKey(service);
}
