interface RetryerConfig<TData = unknown, TError = unknown> {
  fn: () => TData | Promise<TData>
  abort?: () => void
  onError?: (error: TError) => void
  onSuccess?: (data: TData) => void
  onFail?: (failureCount: number, error: TError) => void
  onPause?: () => void
  onContinue?: () => void
  retry?: RetryValue<TError>
  retryDelay?: RetryDelayValue<TError>
}

function defaultRetryDelay(failureCount: number) {
  return Math.min(1000 * 2 ** failureCount, 30000)
}

import type { 
  CancelOptions, 
  RetryValue,
  RetryDelayValue
} from "./types/retryerTypes"
import {
  CancelledError
} from "./types/retryerTypes"
import { isCancelable } from "./types/retryerTypes"
import { sleep } from "./utils"
import { focusManager } from "./focusManager"
import { onlineManager } from "./onlineManager"

export class Retryer<TData = unknown, TError = unknown> {
  cancel: (options?: CancelOptions) => void
  cancelRetry: () => void
  continue: () => void
  failureCount: number
  isPaused: boolean
  isResolved: boolean
  isTransportCancelable: boolean
  promise: Promise<TData>

  private abort?: () => void

  constructor(config: RetryerConfig<TData, TError>) {
    let cancelRetry = false
    let cancelFn: ((options?: CancelOptions) => void) | undefined
    let continueFn: ((value?: unknown) => void) | undefined
    let promiseResolve: (data: TData) => void
    let promiseReject: (error: TError) => void

    this.abort = config.abort
    this.cancel = cancelOptions => cancelFn?.(cancelOptions)
    this.cancelRetry = () => {
      cancelRetry = true
    }
    this.continue = () => continueFn?.()
    this.failureCount = 0
    this.isPaused = false
    this.isResolved = false
    this.isTransportCancelable = false
    this.promise = new Promise<TData>((outerResolve, outerReject) => {
      promiseResolve = outerResolve
      promiseReject = outerReject
    })

    const resolve = (value: any) => {
      if (!this.isResolved) {
        this.isResolved = true
        config.onSuccess?.(value)
        continueFn?.()
        promiseResolve(value)
      }
    }

    const reject = (value: any) => {
      if (!this.isResolved) {
        this.isResolved = true
        config.onError?.(value)
        continueFn?.()
        promiseReject(value)
      }
    }

    const pause = () => {
      return new Promise(continueResolve => {
        continueFn = continueResolve
        this.isPaused = true
        config.onPause?.()
      }).then(() => {
        continueFn = undefined
        this.isPaused = false
        config.onContinue?.()
      })
    }

    // main loop
    const run = () => {
      // resolved ????????????
      // Exit 1
      if (this.isResolved) {
        return
      }

      let promiseOrValue: any

      // ?????? query
      try {
        promiseOrValue = config.fn()
      } catch(error) {
        promiseOrValue = Promise.reject(error)
      }      

      cancelFn = cancelOptions => {
        if (!this.isResolved) {
          reject(new CancelledError(cancelOptions))

          this.abort?.()

          // ?????? Promise ????????????
          if (isCancelable(promiseOrValue)) {
            try {
              promiseOrValue.cancel()
            } catch (error) {
              // Do nothing
            }
          }
        }
      }

      // ???????????????????????????
      this.isTransportCancelable = isCancelable(promiseOrValue)

      // Exit 2
      Promise.resolve(promiseOrValue)
        .then(resolve)
        .catch(error => {
          // ???????????? resolved ??????
          // Exit 3
          if (this.isResolved) {
            return
          }

          // ?????????????????? retry
          const retry = config.retry ?? 3
          const retryDelay = config.retryDelay ?? defaultRetryDelay
          const delay = typeof retryDelay === 'function'
            ? retryDelay(this.failureCount, error)
            : retryDelay
          const shouldRetry = 
            retry === true ||
            (typeof retry === 'number' && this.failureCount < retry) ||
            (typeof retry === 'function' && retry(this.failureCount, error))
          if (cancelRetry || !shouldRetry) {
            // We are done if the query does not need to be retried
            // Exit 4
            reject(error)
            return
          }

          // ?????????????????? ??????????????????????????????
          this.failureCount++

          // ??????????????????notify
          config.onFail?.(this.failureCount, error)

          // Delay
          sleep(delay)
            // ?????? document ????????? ??? ????????????????????????(Pause)
            .then(() => {
              if (!focusManager.isFocused() || !onlineManager.isOnline()) {
                return pause()
              }
            })
            .then(() => {
              if (cancelRetry) {
                // Exit 5
                reject(error)
              } else {
                run()
              }
            })
        })
    }
    // execute Main loop
    run()
  }
}