import { type GenEffect } from "../../../"

export interface IThree {
  hello(): GenEffect<"world">;
}
