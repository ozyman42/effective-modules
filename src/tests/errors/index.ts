import { TaggedError } from "effect/Data";

export class PossibleError extends TaggedError("PossibleError")<{}> {}
export class OtherError extends TaggedError("OtherError")<{}> {}
