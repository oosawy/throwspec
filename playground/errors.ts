export class FooError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "FooError";
  }
}
