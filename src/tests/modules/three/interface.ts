import { type fn } from "../../effect";

export interface IThree {
  hello(): fn.Return<"world">;
}
