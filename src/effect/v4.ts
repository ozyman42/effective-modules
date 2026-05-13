export { type Effect, fn, gen } from "effect-4/Effect";
export { type Service, type Context, empty as emptyContext, add as addToContext, type ServiceClass } from "effect-4/Context";
export { type UnionToIntersection, type Simplify } from "effect-4/Types";
export { type Layer, effect as layerFromEffect, succeed as layerFromImpl } from "effect-4/Layer";
export { type Option, none, isNone, some } from "effect-4/Option";

import { die } from "effect-4/Effect";
import { Service, isKey } from "effect-4/Context";

export function dieMessage(message: string) {
  return die(new Error(message));
}

export function makeService(key: string) {
  return Service(key);
}

export function isService(service: Service<any, any>) {
  return isKey(service);
}
