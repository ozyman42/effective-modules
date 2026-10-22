# Effective Modules

Dependency injection for [Effect](https://effect.website) v4 built from plain TypeScript interfaces and
classes. Background and motivation: [Effective Modules](https://alexleung.net/tech/effective-modules/).

```sh
bun add effective-modules effect
```

## Why

- **The interface is the contract.** You write the interface; the implementation `implements` it. Changing
  an implementation cannot silently change what clients see.
- **Errors land on the line that caused them.** Methods declare `fn.Return<A, E, R>`, so a wrong error or
  requirement is flagged where it happens, not across the whole generator body.
- **Dependencies come with the class.** `.uses(...)` declares them and the superclass wires them up; no
  layer closures or hand-built `Context`.

## 1. Declare interfaces

Each module is a plain interface. A string enum names them, and `interfaces` turns the enum into one
Effect `Context.Service` per module. Enum members are nominal, so two modules can't be confused.

```ts
import { interfaces } from "effective-modules";
import type { fn } from "effect/Effect";

export interface IGreeter {
  greet(name: string): fn.Return<string>;
}

export interface IStore {
  save(key: string, value: string): fn.Return<void, StoreError>;
}

export enum Module {
  greeter = "greeter",
  store = "store",
}

export const modules = interfaces<Module, {
  [Module.greeter]: IGreeter;
  [Module.store]: IStore;
}>(Module);
```

Ordinary Effect services work anywhere a module does (`FileSystem`, or your own
`class X extends Context.Service<X, I>()("X") {}`).

## 2. Implement a module

Extend `implementing(module)`, chain `.uses(...)` for dependencies and `.throws<E>()` if construction can
fail, then `implements` the interface. Methods are generator methods typed with `fn.Return`
(`EffectGen` is an alias).

```ts
import { implementing } from "effective-modules";
import { FileSystem } from "effect/FileSystem";

export class GreeterImpl extends implementing(modules.greeter).uses(modules.store, FileSystem) implements IGreeter {
  *greet(name: string): fn.Return<string, StoreError> {
    const greeting = `Hello, ${name}`;
    yield* this.dependencies.store.save("last", greeting);
    return greeting;
  }
}
```

Inside a method, a dependency can be reached three ways:

- `this.dependencies.<key>`, keyed by the module's name (`store`) or a service's key.
- `this.getDependency(modules.store)`, typed by the module you pass.
- `this.context`, a `Context` holding every dependency, for `Effect.provide(this.context)` when calling
  something that requires them.

Dependencies are only available once the layer has built the instance; reading them in the constructor
throws `EffectiveModulesError`. Methods are bound to the instance, so they can be passed around freely.

## 3. Build layers

Every implementation has a static `Layer`. Its requirements are exactly the modules passed to `.uses`, and
its error is the type passed to `.throws`.

```ts
import { Effect, Layer } from "effect";

const program = Effect.gen(function* () {
  const greeter = yield* modules.greeter;
  return yield* greeter.greet("world");
});

program.pipe(
  Effect.provide(GreeterImpl.Layer.pipe(
    Layer.provideMerge(StoreImpl.Layer),
    Layer.provideMerge(fileSystemLayer),
  )),
);
```

## Custom construction

When construction has to do work, pass an initializer to `super`. It returns the dependencies object, and
`Initialize<typeof Class>` types it. Its errors must be declared with `.throws`.

```ts
export class GreeterImpl extends implementing(modules.greeter).uses(modules.store).throws<ConfigError>() implements IGreeter {
  constructor() {
    super(function* (): Initialize<typeof GreeterImpl> {
      yield* loadConfig();
      return { store: yield* modules.store };
    });
  }
  // ...
}
```

The initializer must return every module named in `.uses`, or building the layer fails.

## Piping a method: `effunct`

A method call is a generator, not an `Effect`, so it has no `.pipe`. `effunct` wraps a method (or any
generator function) into a traced `Effect.fn`:

```ts
const result = yield* effunct(store.save)("key", "value").pipe(
  Effect.catchTag("StoreError", () => Effect.succeed(undefined)),
);
```

## Mocking in tests

`mockLayer` builds a layer from a partial implementation. Any method you leave out dies with
`Property <name> not implemented on mock for <module>` when called.

```ts
const layer = GreeterImpl.mockLayer({
  *greet(name) { return `mock ${name}`; },
});
// or without an implementation class:
implementing(modules.greeter).mockLayer({ /* ... */ });
```

## Errors

Misuse fails with `EffectiveModulesError`, whose `reason` is an `EffectiveModulesErrorReason`: passing a
non-service to `implementing` or `.uses`, a module that uses itself, an empty `.uses()`, instantiating the
superclass directly, reading dependencies before construction, an initializer missing a dependency, or an
`interfaces` enum whose keys and values differ.
