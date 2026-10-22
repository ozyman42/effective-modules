# Effective Modules

Dependency injection for [Effect](https://effect.website) v4, written as plain TypeScript interfaces and
classes. Background and motivation: [Effective Modules](https://alexleung.net/tech/effective-modules/).

```sh
bun add effective-modules effect
```

## Plain Effect vs effective-modules

Each comparison below builds the same thing both ways: a `Greeter` module that saves greetings through a
`Store` module.

### Declaring modules

Plain Effect:

```ts
import { Context, Effect } from "effect";

interface IStore {
  save(key: string, value: string): Effect.Effect<void, StoreError>;
  load(key: string): Effect.Effect<string, StoreError>;
}
interface IGreeter {
  greet(name: string): Effect.Effect<string, StoreError>;
}

class Store extends Context.Service<Store, IStore>()("Store") {}
class Greeter extends Context.Service<Greeter, IGreeter>()("Greeter") {}
```

effective-modules:

```ts
import { interfaces } from "effective-modules";
import type { fn } from "effect/Effect";

interface IStore {
  save(key: string, value: string): fn.Return<void, StoreError>;
  load(key: string): fn.Return<string, StoreError>;
}
interface IGreeter {
  greet(name: string): fn.Return<string, StoreError>;
}

enum Module { store = "store", greeter = "greeter" }

const modules = interfaces<Module, { store: IStore; greeter: IGreeter }>(Module);
```

Why: one enum names every module once, instead of a class per module that repeats its name three times.
Methods return `fn.Return`, which is what lets the next example write them as generator methods.

### Implementing a module

Plain Effect:

```ts
const GreeterLive = Layer.effect(Greeter, Effect.gen(function* () {
  const store = yield* Store;
  return {
    greet: (name: string) => Effect.gen(function* () {
      const greeting = `Hello, ${name}`;
      yield* store.save("last", greeting);
      return greeting;
    }),
  };
}));
```

effective-modules:

```ts
class GreeterImpl extends implementing(modules.greeter).uses(modules.store) implements IGreeter {
  *greet(name: string): fn.Return<string, StoreError> {
    const greeting = `Hello, ${name}`;
    yield* this.dependencies.store.save("last", greeting);
    return greeting;
  }
}

// GreeterImpl.Layer: Layer<greeter, never, store>
```

Why: in plain Effect, a layer's requirements are whatever its generator happens to yield, and its methods
are closures in an object literal. Here `.uses(...)` states the requirements, `GreeterImpl.Layer` requires
exactly those, and `implements IGreeter` checks each method against the interface, reporting a mismatch
on that method rather than on the whole layer.

### Passing dependencies to a helper

Plain Effect:

```ts
const GreeterLive = Layer.effect(Greeter, Effect.gen(function* () {
  const store = yield* Store;
  const clock = yield* Clock;
  const context = Context.empty().pipe(
    Context.add(Store, store),
    Context.add(Clock, clock),
  );
  return {
    greet: (name: string) => Effect.gen(function* () {
      yield* audit(name).pipe(Effect.provide(context));
      return `Hello, ${name}`;
    }),
  };
}));
```

effective-modules:

```ts
class GreeterImpl extends implementing(modules.greeter).uses(modules.store, Clock) implements IGreeter {
  *greet(name: string): fn.Return<string, StoreError> {
    yield* audit(name).pipe(Effect.provide(this.context));
    return `Hello, ${name}`;
  }
}
```

Why: `this.context` already holds every dependency named in `.uses`, so there is no `Context` to build by
hand and keep in sync with the list of dependencies.

### Mocking in tests

Plain Effect:

```ts
const StoreTest = Layer.succeed(Store, {
  save: () => Effect.void,
  load: () => Effect.die("load is not used in this test"),
});
```

effective-modules:

```ts
const StoreTest = implementing(modules.store).mockLayer({
  *save() {},
});
```

Why: a test writes only the methods it uses. Any other method dies with
`Property load not implemented on mock for store` if called, so adding a method to `IStore` does not
break every existing mock.

## Usage

### Building layers

Every implementation has a static `Layer`, composed like any other Effect layer:

```ts
const program = Effect.gen(function* () {
  const greeter = yield* modules.greeter;
  return yield* greeter.greet("world");
});

program.pipe(
  Effect.provide(GreeterImpl.Layer.pipe(Layer.provideMerge(StoreImpl.Layer))),
);
```

Plain Effect services work anywhere a module does: pass `FileSystem`, or your own `Context.Service`
class, to `.uses(...)`.

### Reaching dependencies

Inside a method:

- `this.dependencies.store`: keyed by module name, or by a service's key.
- `this.getDependency(modules.store)`: typed by the module you pass.
- `this.context`: a `Context` holding all of them, for `Effect.provide`.

They exist once the layer has built the instance, so reading them in the constructor throws. Methods are
bound to the instance and can be passed around freely.

### Construction that can fail

To do work while the layer is built, pass an initializer to `super`. It returns the dependencies, and any
error it can raise is declared with `.throws`:

```ts
class GreeterImpl extends implementing(modules.greeter).uses(modules.store).throws<ConfigError>() implements IGreeter {
  constructor() {
    super(function* (): Initialize<typeof GreeterImpl> {
      yield* loadConfig();
      return { store: yield* modules.store };
    });
  }
  // ...
}

// GreeterImpl.Layer: Layer<greeter, ConfigError, store>
```

The initializer must return every module named in `.uses`, or building the layer fails.

### Piping a method: `effunct`

A method call is a generator, not an `Effect`, so it has no `.pipe`. `effunct` turns a method into a
traced `Effect.fn`:

```ts
yield* effunct(store.save)("key", "value").pipe(
  Effect.catchTag("StoreError", () => Effect.void),
);
```

### Errors

Misuse fails with `EffectiveModulesError`, whose `reason` is one of `EffectiveModulesErrorReason`:
passing a non-service to `implementing` or `.uses`, a module that uses itself, an empty `.uses()`,
instantiating the superclass directly, reading dependencies in the constructor, an initializer that omits
a dependency, or an `interfaces` enum whose keys and values differ.
