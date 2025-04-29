import { FooError } from "../errors";

export function foo(): number | Throws<FooError> {
  if (Math.random() < 0.5) throw new FooError("oops");
  return 42;
}
