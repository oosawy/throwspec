declare global {
  type Throws<E> = never & { __throws?: E };
}

export const throws = <E = unknown, T = unknown>(value: T): T => value;
