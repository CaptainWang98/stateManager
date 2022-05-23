export interface CancelOptions {
  revert?: boolean
  silent?: boolean
}

export class CancelledError {
  revert?: boolean
  silent?: boolean
  constructor(options?: CancelOptions) {
    this.revert = options?.revert
    this.silent = options?.silent
  }
}

interface Cancelable {
  cancel(): void
}

export function isCancelable(value: any): value is Cancelable {
  return typeof value?.cancel === 'function'
}

export function isCancelledError(value: any): value is CancelledError {
  return value instanceof CancelledError
}

export type RetryValue<TError> = boolean | number | ShouldRetryFunction<TError>

type ShouldRetryFunction<TError = unknown> = (
  failureCount: number,
  error: TError
) => boolean

export type RetryDelayValue<TError> = number | RetryDelayFunction<TError>

type RetryDelayFunction<TError = unknown> = (
  failureCount: number,
  error: TError
) => number
