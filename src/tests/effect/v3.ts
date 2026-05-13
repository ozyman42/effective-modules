export { gen, log, catchTag, fn, runPromiseExit, provide, type Effect, provideService, succeed } from "effect-3/Effect";
export { provideMerge, type Layer } from "effect-3/Layer";
export { FileSystem, layerNoop } from "@effect/platform/FileSystem";
export { value, tagsExhaustive } from "effect-3/Match";
export { TaggedError } from "effect-3/Data";

import { replace, defaultLogger, make as makeLogger } from "effect-3/Logger";
import type { Cause } from "effect-3/Cause";
import { type TagClass, Tag } from "effect-3/Context";

export function layerWithLogToArray(logs: string[]) {
  return replace(defaultLogger, makeLogger(({ message }) => {
    logs.push(Array.isArray(message) ? message.map(String).join(" ") : String(message));
  }));
}

export function matchCause<E, R>(cause: Cause<E>, handlers: {
  empty: () => R
  fail: (error: E) => R
  die: (defect: unknown) => R
  interrupt: () => R
}): R {
  switch (cause._tag) {
    case "Empty":     return handlers.empty();
    case "Fail":      return handlers.fail(cause.error);
    case "Die":       return handlers.die(cause.defect);
    case "Interrupt": return handlers.interrupt();
    case "Sequential":
    case "Parallel":  return matchCause(cause.left, handlers);
  }
}

export function ServiceClass<Self, Id extends string, Interface>(id: Id): TagClass<Self, Id, Interface> {
  return Tag(id)<Self, Interface>();
}
