import {
  type Effect,
  fn,
  gen,
  dieMessage,
  type Service,
  isService,
  makeService,
  type Context,
  emptyContext,
  addToContext,
  type UnionToIntersection,
  type Simplify,
  type Layer,
  layerFromEffect,
  layerFromImpl,
  type Option,
  none,
  isNone,
  some
} from "./effect";

type ExtractDependenciesObject<Services extends readonly Service<any, any>[]> =
  Services extends readonly []
    ? {}
    : Simplify<UnionToIntersection<{
        [K in keyof Services]:
          Services[K] extends Service<infer Id extends string, infer Interface>
            ? { readonly [P in Id]: Interface }
          :
          never
      }[number]>>;

type ExtractContext<Services extends readonly Service<any, any>[]> = Services[number]["Identifier"];

type GeneratedEffect<EffectGenerator extends fn.Return<any, any, any>> =
  EffectGenerator extends fn.Return<infer A, infer E, infer R> ?
    Effect<A, E, R> : never;

export const effunct: <EffectGeneratorFn extends (...args: any) => fn.Return<any, any, any>> (generatorFn: EffectGeneratorFn) => (...args: Parameters<EffectGeneratorFn>) => GeneratedEffect<ReturnType<EffectGeneratorFn>> = generatorFn => {
  return fn(generatorFn.name)(generatorFn) as any;
}

type ModuleImplInstance<MaybeDependencies extends Maybe<Service<any, any>[]> = None> = 
  MaybeDependencies extends None ?
    {}
    :
    {
      readonly getDependency: <Dependency extends ExtractMaybeVal<MaybeDependencies>[number]> (dependency: Dependency) => Dependency["Service"];
      readonly dependencies: ExtractDependenciesObject<ExtractMaybeVal<MaybeDependencies>>;
      readonly context: Context<ExtractContext<ExtractMaybeVal<MaybeDependencies>>>;
    }

function getContext<Dependencies extends readonly Service<any, any>[] = []>(dependencies: Dependencies, dependenciesObject: ExtractDependenciesObject<Dependencies>): Context<ExtractContext<Dependencies>> {
  let context = emptyContext();
  for (const dependency of dependencies) {
    const impl = (dependenciesObject as any)[dependency.key];
    context = context.pipe(addToContext(dependency, impl));
  }
  return context as any;
}

export enum EffectiveModulesErrorReason {
  ContextNotInitialized = "ContextNotInitialized",
  DependenciesNotInitialized = "DependenciesNotInitialized",
  TryingToInstantiateSuperclass = "TryingToInstantiateSuperclass",
  TryingToCreateModuleDependingOnItself = "TryingToCreateModuleDependingOnItself",
  CustomInitializerMissingDependencies = "CustomInitializedMissingDependencies",
  PassedNothingToUses = "PassedNothingToUses",
  PassedNonTagToUses = "PassedNonTagToUses",
  PassedNonTagToImplementing = "PassedNonTagToImplementing",
  PassedNonStringEnumToInterfaces = "PassedNonStringEnumToInterfaces"
}

export class EffectiveModulesError extends Error {
  constructor(public readonly reason: EffectiveModulesErrorReason, reasonMessage: string) {
    super(`Module construction failure. ${reasonMessage}`);
  }
}

function createModule<Interface, Dependencies extends readonly Service<any, any>[] = [], InitializerError = never>(module: Service<any, Interface>, dependencies: Dependencies, throwsSet: boolean = false) {
  return class Module {
    private initializedContext: Option<Context<ExtractContext<Dependencies>>> = none();
    get context (): Context<ExtractContext<Dependencies>> {
      if (dependencies.length === 0) return undefined as any;
      if (isNone(this.initializedContext))
        throw new EffectiveModulesError(
          EffectiveModulesErrorReason.ContextNotInitialized,
          "Context not initialized. Initialization must be done via Layer construction."
        );
      return this.initializedContext.value;
    };
    private initializedDependencies: Option<ExtractDependenciesObject<Dependencies>> = none();
    get dependencies (): ExtractDependenciesObject<Dependencies> {
      if (dependencies.length === 0) return undefined as any;
      if (isNone(this.initializedDependencies))
        throw new EffectiveModulesError(
          EffectiveModulesErrorReason.DependenciesNotInitialized,
          "Dependencies not initialized. Initialization must be done via Layer construction."
        );
      else return this.initializedDependencies.value;
    }
    get getDependency () {
      if (dependencies.length === 0) return undefined;
      if (isNone(this.initializedDependencies))
        throw new EffectiveModulesError(
          EffectiveModulesErrorReason.DependenciesNotInitialized,
          "Dependencies not initialized. Initialization must be done via Layer construction."
        );
      else {
        return (dependency: Service<any, any>) => {
          const toReturn =  (this.initializedDependencies as any).value[dependency.key];
          return toReturn;
        }
      }
    }
    constructor(private initializer?: () => fn.Return<ExtractDependenciesObject<Dependencies>, InitializerError, ExtractContext<Dependencies>>) {
      if (new.target === Module) {
        throw new EffectiveModulesError(
          EffectiveModulesErrorReason.TryingToInstantiateSuperclass,
          `You must extend the module superclass. You cannot initialize it directly.`
        );
      }
      // Auto bind
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
          .filter(prop => typeof (this as any)[prop] === 'function' && prop !== 'constructor');
      for (const method of methods) {
        (this as any)[method] = (this as any)[method].bind(this);
      }
    }
    static get Layer(): Layer<(typeof module)["Identifier"], InitializerError, ExtractContext<Dependencies>> {
      const self = this;
      return layerFromEffect(module, gen(function*() {
        const instance = new self();
        if (instance.initializer) {
          const dependenciesObj = yield* instance.initializer();
          if (dependencies.length) {
            // Validate dependencies
            for (const dependency of dependencies) {
              if (!(dependency.key in dependenciesObj)) {
                throw new EffectiveModulesError(
                  EffectiveModulesErrorReason.CustomInitializerMissingDependencies,
                  `Module ${module.key} supposedly uses ${dependency.key}, but initializer provides no implementation for this`
                );
              }
            }
            instance.initializedDependencies = some(dependenciesObj);
            instance.initializedContext = some(getContext(dependencies, dependenciesObj));
          }
        } else {
          if (dependencies.length) {
            const dependenciesObj: ExtractDependenciesObject<Dependencies> = {} as any;
            for (const requirement of dependencies) {
              (dependenciesObj as any)[requirement.key] = yield* requirement;
            }
            instance.initializedDependencies = some(dependenciesObj);
            instance.initializedContext = some(getContext(dependencies, dependenciesObj));
          }
        }
        return instance as any;
      }));
    }
    static mockLayer(partialImpl?: Partial<Interface>): Layer<(typeof module)["Identifier"], never, never> {
      const impl: Interface = new Proxy(partialImpl ?? {}, {
        get(target, prop, receiver) {
          if (prop in receiver) {
            return Reflect.get(target, prop, receiver);
          }
          return fn(function*() {
            return yield* dieMessage(`Property ${prop.toString()} not implemented on mock for ${module.key}`);
          });
        }
      }) as Interface;
      return layerFromImpl(module, impl);
    }
    static get Uses() {
      if (!dependencies.length) {
        return (...dependencies: Service<any, any>[]) => {
          if (dependencies.length === 0) {
            throw new EffectiveModulesError(
              EffectiveModulesErrorReason.PassedNothingToUses,
              `Cannot pass 0 dependencies to Uses helper`
            )
          }
          // Ensure that each thing passed in as an actual context tag
          for (const dependency of dependencies) {
            if (dependency.key === module.key) {
              throw new EffectiveModulesError(
                EffectiveModulesErrorReason.TryingToCreateModuleDependingOnItself,
                `Trying to create module depending on itself: ${module.key}`
              )
            }
            if (!isService(dependency)) {
              throw new EffectiveModulesError(
                EffectiveModulesErrorReason.PassedNonTagToUses,
                `Detected non-tag passed into Uses: ${dependency.key}`
              );
            }
          }
          return createModule(module, dependencies, throwsSet);
        }
      }
    }
    static get Throws() {
      if (!throwsSet) {
        return () => {
          return createModule(module, dependencies, true);
        }
      }
    }
  }
}

type ExtractMaybeVal<M extends Maybe<any>> = M extends Some<infer T> ? T : never;
type None = {has: false};
type Some<T> = {has: true; type: T};
type Maybe<T> = None | Some<T>;

type ModuleSuperClassConstructor<
  Module extends Service<any, any>,
  MaybeRequirements extends Maybe<Service<any, any>[]> = None,
  MaybeError extends Maybe<any> = None
> = 
  (
    abstract new (initializer?: () => 
      fn.Return<
        MaybeRequirements extends None ?
          void : ExtractDependenciesObject<ExtractMaybeVal<MaybeRequirements>>,
        MaybeError extends None ?
          never : ExtractMaybeVal<MaybeError>, 
        MaybeRequirements extends None ?
          never : ExtractContext<ExtractMaybeVal<MaybeRequirements>>
      >
    ) => ModuleImplInstance<MaybeRequirements>
  ) &
  {
    Layer: Layer<
      Module["Identifier"],
      MaybeError extends None ?
        never : ExtractMaybeVal<MaybeError>,
      MaybeRequirements extends None ?
        never : ExtractContext<ExtractMaybeVal<MaybeRequirements>>
    >
    /**
     * Similar to Effect platform's [layerNoOp](https://effect.website/docs/platform/file-system/) method, where all
     * members are methods which return a die by default unless overwritten by the provided partial impl.
     * The layerNoOp for the platform services are hand-written whereas this method uses a Proxy for each member as
     * the module shape cannot be known at runtime. The implementation provided by mockLayer assumes all instance members
     * are functions which return an effect. If that's not the case make sure to explicitly mock that behavior.
     * 
     * @param partialImpl 
     */
    mockLayer(partialImpl?: Partial<Module["Service"]>): Layer<Module["Identifier"], never, never>
  }


type ModuleSuperClass<
  Module extends Service<any, any>,
  MaybeDependencies extends Maybe<Service<any, any>[]> = None,
  MaybeError extends Maybe<any> = None
> = 
  ModuleSuperClassConstructor<Module, MaybeDependencies, MaybeError>
  & (
    MaybeDependencies extends None ?
      {
        Uses: <
          FirstDependency extends Service<any, any>,
          OtherDependencies extends Service<any, any>[] = []
        >(
          // Require at least one dependency if Uses is invoked, also prevent inputs from being same as Module
          first: FirstDependency & (FirstDependency extends Module ? never : FirstDependency),
          ...others: {
            [K in keyof OtherDependencies]: OtherDependencies[K] extends Module ? never : OtherDependencies[K]
          }
        ) => ModuleSuperClass<Module, Some<[FirstDependency, ...OtherDependencies]>, MaybeError>
      }
      :
      {}
  )
  & (
    MaybeError extends None ?
      {Throws: <Error = never> () => ModuleSuperClass<Module, MaybeDependencies, Some<Error>>}
      :
      {}
  );

export const Implementing: <Module extends Service<any, any>> (module: Module) => ModuleSuperClass<Module> = (module) => {
  if (!isService(module)) {
    throw new EffectiveModulesError(
      EffectiveModulesErrorReason.PassedNonTagToImplementing,
      `Detected non-tag passed into Implementing: ${module.key}`
    );
  }
  return createModule(module, []) as any;
}

type StringEnum<Enum extends string> = {[key in Enum]: key};

export function interfaces<ModuleKeysEnum extends string, Interfaces extends {[moduleKey in ModuleKeysEnum]: any}>(moduleKeysEnum: StringEnum<ModuleKeysEnum>): {[moduleKey in ModuleKeysEnum]: Service<moduleKey, Interfaces[moduleKey]>} {
  // Verify input integrity
  for (const [k, v] of Object.entries(moduleKeysEnum)) {
    if (k !== v) {
      throw new EffectiveModulesError(
        EffectiveModulesErrorReason.PassedNonStringEnumToInterfaces,
        `In module keys enum, key '${k}' not equal to value '${v}'`
      );
    }
  }
  return Object.fromEntries(Object.keys(moduleKeysEnum)
    .map(k => [k, makeService(k)])) as any;
}
