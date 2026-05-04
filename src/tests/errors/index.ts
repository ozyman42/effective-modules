import { TaggedError } from "../effect";

export class PossibleError extends TaggedError("PossibleError")<{}> {}
export class OtherError extends TaggedError("OtherError")<{}> {}
