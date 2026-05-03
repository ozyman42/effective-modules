import * as e from "effect";
import { type Effect, fn as effn } from "effect/Effect";
import { type YieldWrap } from "effect/Utils"
import { Tag } from "effect/Context";
import { type UnionToIntersection, type Simplify } from "effect/Types";

type ExtractServices<T extends readonly Tag<any, any>[]> =
  T extends readonly []
    ? {}
    : Simplify<UnionToIntersection<{
        [K in keyof T]:
          T[K] extends Tag<infer Id extends string, infer Interface>
            ? { readonly [P in Id]: Interface }
          :
          never
      }[number]>>;

type ExtractRequirements<T extends readonly Tag<any, any>[]> = T[number]["Identifier"];

export type GenEffect<A, E = never, R = never> =
    Generator<YieldWrap<Effect<any, E, R>>, A, any>;

type GeneratedEffect<GE extends GenEffect<any, any, any>> =
  GE extends GenEffect<infer A, infer E, infer R> ?
    Effect<A, E, R> : never;

export const effunct: <Fn extends (...args: any) => GenEffect<any, any, any>> (fn: Fn) => (...args: Parameters<Fn>) => GeneratedEffect<ReturnType<Fn>> = fn => {
  return effn(fn.name)(fn) as any;
}

type ModuleImplInstance<MaybeRequirements extends Maybe<Tag<any, any>[]> = None> = 
  MaybeRequirements extends None ?
    {}
    :
    {
      readonly getDependency: <D extends ExtractVal<MaybeRequirements>[number]> (dependency: D) => D["Service"];
      readonly dependencies: ExtractServices<ExtractVal<MaybeRequirements>>;
      readonly context: e.Context.Context<ExtractRequirements<ExtractVal<MaybeRequirements>>>;
    }

function getContext<Requirements extends readonly e.Context.Tag<any, any>[] = []>(requirements: Requirements, dependencies: ExtractServices<Requirements>): e.Context.Context<ExtractRequirements<Requirements>> {
  let context = e.Context.empty();
  for (const requirement of requirements) {
    const impl = (dependencies as any)[requirement.key];
    context = e.Context.add(requirement, impl)(context);
  }
  return context as any;
}

export enum EffectiveModulesErrorReason {
  ContextNotInitialized = "ContextNotInitialized",
  DependenciesNotInitialized = "DependenciesNotInitialized",
  TryingToCreateLayerFromSuperclass = "TryingToCreateLayerFromSuperclass",
  CustomInitializerMissingDependencies = "CustomInitializedMissingDependencies",
  PassedNothingToUses = "PassedNothingToUses",
  PassedNonTagToUses = "PassedNonTagToUses",
  PassedNonTagToImplementing = "PassedNonTagToImplementing",
  PassedNonStringEnumToInterfaces = "PassedNonStringEnumToInterfaces"
}

export class EffectiveModulesError extends Error {
  constructor(public readonly reason: EffectiveModulesErrorReason, private readonly reasonMessage: string) {
    super(`Module construction failure. ${reasonMessage}`);
  }
}

function createModule<ModuleService, Requirements extends readonly e.Context.Tag<any, any>[] = [], InitializerError = never>(module: e.Context.Tag<any, ModuleService>, requirements: Requirements, throwsSet: boolean = false) {
  return class Module {
    private initializedContext: e.Option.Option<e.Context.Context<ExtractRequirements<Requirements>>> = e.Option.none();
    get context (): e.Context.Context<ExtractRequirements<Requirements>> {
      if (e.Option.isNone(this.initializedContext))
        throw new EffectiveModulesError(
          EffectiveModulesErrorReason.ContextNotInitialized,
          "Context not initialized. Initialization must be done via Layer construction."
        );
      return this.initializedContext.value;
    };
    private initializedDependencies: e.Option.Option<ExtractServices<Requirements>> = e.Option.none();
    get dependencies (): ExtractServices<Requirements> {
      if (e.Option.isNone(this.initializedDependencies))
        throw new EffectiveModulesError(
          EffectiveModulesErrorReason.DependenciesNotInitialized,
          "Dependencies not initialized. Initialization must be done via Layer construction."
        );
      else return this.initializedDependencies.value;
    }
    constructor(private initializer?: () => GenEffect<ExtractServices<Requirements>, InitializerError, ExtractRequirements<Requirements>>) {
      // TODO: ensure that superclass is not being directly instantiated.
    }
    static get Layer(): e.Layer.Layer<(typeof module)["Identifier"], InitializerError, ExtractRequirements<Requirements>> {
      const self = this;
      if (self === Module) {
        throw new EffectiveModulesError(
          EffectiveModulesErrorReason.TryingToCreateLayerFromSuperclass,
          "You must extend the module superclass. You cannot initialize it directly."
        );
      }
      return e.Layer.effect(module, e.Effect.gen(function*() {
        const instance = new self();
        if (instance.initializer) {
          const dependencies = yield* instance.initializer();
          if (requirements.length) {
            // Validate dependencies
            for (const requirement of requirements) {
              if (!(requirement.key in dependencies)) {
                throw new EffectiveModulesError(
                  EffectiveModulesErrorReason.CustomInitializerMissingDependencies,
                  `Module ${module.key} supposedly uses ${requirement.key}, but initializer provides no implementation for this`
                );
              }
            }
            instance.initializedDependencies = e.Option.some(dependencies);
            instance.initializedContext = e.Option.some(getContext(requirements, dependencies));
          }
        } else {
          if (requirements.length) {
            const dependencies: ExtractServices<Requirements> = {} as any;
            for (const requirement of requirements) {
              (dependencies as any)[requirement.key] = yield* requirement;
            }
            instance.initializedDependencies = e.Option.some(dependencies);
            instance.initializedContext = e.Option.some(getContext(requirements, dependencies));
          }
        }
        return instance as any;
      }));
    }
    static get Uses() {
      if (!requirements.length) {
        return (...requirements: e.Context.Tag<any, any>[]) => {
          if (requirements.length === 0) {
            throw new EffectiveModulesError(
              EffectiveModulesErrorReason.PassedNothingToUses,
              `Cannot pass 0 dependencies to Uses helper`
            )
          }
          // Ensure that each thing passed in as an actual context tag
          for (const requirement of requirements) {
            if (requirement._op !== "Tag") {
              throw new EffectiveModulesError(
                EffectiveModulesErrorReason.PassedNonTagToUses,
                `Detected non-tag passed into Uses ${requirement.key}`
              );
            }
          }
          return createModule(module, requirements, throwsSet);
        }
      }
    }
    static get Throws() {
      if (!throwsSet) {
        return () => {
          return createModule(module, requirements, true);
        }
      }
    }
  }
}

type ExtractVal<M extends Maybe<any>> = M extends Some<infer T> ? T : never;
type None = {has: false};
type Some<T> = {has: true; type: T};
type Maybe<T> = None | Some<T>;

type ModuleSuperClassConstructor<
  Module extends e.Context.Tag<any, any>,
  MaybeRequirements extends Maybe<e.Context.Tag<any, any>[]> = None,
  MaybeError extends Maybe<any> = None
> = 
  (
    abstract new (initializer?: () => 
      GenEffect<
        MaybeRequirements extends None ?
          void : ExtractServices<ExtractVal<MaybeRequirements>>,
        MaybeError extends None ?
          never : ExtractVal<MaybeError>, 
        MaybeRequirements extends None ?
          never : ExtractRequirements<ExtractVal<MaybeRequirements>>
      >
    ) => ModuleImplInstance<MaybeRequirements>
  ) &
  {
    Layer: e.Layer.Layer<
      Module["Identifier"],
      MaybeError extends None ?
          never : ExtractVal<MaybeError>,
      MaybeRequirements extends None ?
          never : ExtractRequirements<ExtractVal<MaybeRequirements>>
    >
    // TODO: layerNoop method similar to https://effect.website/docs/platform/file-system/
  }


type ModuleSuperClass<
  Module extends e.Context.Tag<any, any>,
  MaybeRequirements extends Maybe<e.Context.Tag<any, any>[]> = None,
  MaybeError extends Maybe<any> = None
> = 
  ModuleSuperClassConstructor<Module, MaybeRequirements, MaybeError>
  & (
    MaybeRequirements extends None ?
      {
        Uses: <
          FirstRequirement extends e.Context.Tag<any, any>,
          OtherRequirements extends e.Context.Tag<any, any>[] = []
        >(
          // Require at least one dependency if Uses is invoked, also prevent inputs from being same as Module
          firstReq: FirstRequirement & (FirstRequirement extends Module ? never : FirstRequirement),
          ...otherReqs: {
            [K in keyof OtherRequirements]: OtherRequirements[K] extends Module ? never : OtherRequirements[K]
          }
        ) => ModuleSuperClass<Module, Some<[FirstRequirement, ...OtherRequirements]>, MaybeError>
      }
      :
      {}
  )
  & (
    MaybeError extends None ?
      {Throws: <Error = never> () => ModuleSuperClass<Module, MaybeRequirements, Some<Error>>}
      :
      {}
  );

export const Implementing: <Module extends e.Context.Tag<any, any>> (module: Module) => ModuleSuperClass<Module> = (module) => {
  return createModule(module, []) as any;
}

type StringEnum<Enum extends string> = {[key in Enum]: key};

export function interfaces<ModuleKeysEnum extends string>(moduleKeysEnum: StringEnum<ModuleKeysEnum>): <Interfaces extends {[moduleKey in ModuleKeysEnum]: any}>() => {[moduleKey in keyof Interfaces]: e.Context.Tag<moduleKey, Interfaces[moduleKey]>} {
  // Verify input integrity
  for (const [k, v] of Object.entries(moduleKeysEnum)) {
    if (k !== v) {
      throw new EffectiveModulesError(
        EffectiveModulesErrorReason.PassedNonStringEnumToInterfaces,
        `In module keys enum, key '${k}' not equal to value '${v}'`
      );
    }
  }
  return (() => {
    return Object.fromEntries(Object.keys(moduleKeysEnum)
      .map(k => [k, e.Context.Tag(k)()]));
  }) as any;
}
