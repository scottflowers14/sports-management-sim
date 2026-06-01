export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function success<T, E = string>(value: T): Result<T, E> {
  return { ok: true, value };
}

export function failure<E = string>(error: E): Result<never, E> {
  return { ok: false, error };
}
