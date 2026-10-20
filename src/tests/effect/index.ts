export { gen, log, catchTag, fn, runPromiseExit, provide, type Effect, provideService, succeed } from "effect/Effect";
export { provideMerge, type Layer } from "effect/Layer";
export { FileSystem, layerNoop } from "effect/FileSystem";
export { value, tagsExhaustive } from "effect/Match";
export { TaggedError } from "effect/Data";

import { layer, make as makeLogger } from "effect/Logger";
import type { Cause } from "effect/Cause";
import { type ServiceClass, Service } from "effect/Context";

export function layerWithLogToArray(logs: string[]) {
  return layer([makeLogger(({ message }) => {
    logs.push(Array.isArray(message) ? message.map(String).join(" ") : String(message));
  })]);
}

export function matchCause<E, R>(cause: Cause<E>, handlers: {
  empty: () => R
  fail: (error: E) => R
  die: (defect: unknown) => R
  interrupt: () => R
}): R {
  const first = cause.reasons[0];
  if (!first)                    return handlers.empty();
  if (first._tag === "Die")      return handlers.die(first.defect);
  if (first._tag === "Interrupt") return handlers.interrupt();
  return handlers.fail(first.error);
}

export function ServiceClass<Self, Id extends string, Interface>(id: Id): ServiceClass<Self, Id, Interface> {
  return Service<Self, Interface>()(id);
}
