/** Result<T> — explicit success/failure wrapper for use cases, avoiding thrown exceptions for expected failures. */
export class Result<T, E = string> {
  private constructor(
    private readonly _isSuccess: boolean,
    private readonly _value?: T,
    private readonly _error?: E,
  ) {}

  get isSuccess(): boolean {
    return this._isSuccess;
  }

  get isFailure(): boolean {
    return !this._isSuccess;
  }

  get value(): T {
    if (!this._isSuccess) {
      throw new Error('Cannot access value of a failed Result');
    }
    return this._value as T;
  }

  get error(): E {
    if (this._isSuccess) {
      throw new Error('Cannot access error of a successful Result');
    }
    return this._error as E;
  }

  static ok<T, E = string>(value: T): Result<T, E> {
    return new Result<T, E>(true, value, undefined);
  }

  static fail<T, E = string>(error: E): Result<T, E> {
    return new Result<T, E>(false, undefined, error);
  }
}
