import type { 
  QueryKey,
  QueryOptions,
  EnsuredQueryKey,
  QueryStatus,
  QueryMeta,
  InitialDataFunction,
  QueryFunctionContext,
  Updater, 
  SetDataOptions
} from "./types/types"

import type { QueryCache } from "./queryCache"

import { 
  ensureQueryKeyArray,
  getAbortController,
  isValidCacheTime,
  noop,
  timeUntilStale,
  functionalUpdate,
  replaceEqualDeep
} from './utils'

import type { QueryObserver } from './queryObserver'

import type { CancelOptions } from "./types/retryerTypes"
import { isCancelledError } from "./types/retryerTypes"

import { Retryer } from "./retryer"
import { notifyManager } from "./notifyManager"
import { getLogger } from "./logger"

export interface FetchOptions {
  cancelRefetch?: boolean
  meta?: any
}

interface QueryConfig<
  TQueryFnData,
  TError,
  TData,
  TQueryKey extends QueryKey = QueryKey
> {
  cache: QueryCache
  queryKey: TQueryKey
  queryHash: string
  options?: QueryOptions<TQueryFnData, TError, TData, TQueryKey>
  defaultOptions?: QueryOptions<TQueryFnData, TError, TData, TQueryKey>
  state?: QueryState<TData, TError>
  meta: QueryMeta | undefined
}

// Describe the current state of a Query;
export interface QueryState<TData = unknown, TError = unknown> {
  data: TData | undefined
  dataUpdateCount: number
  dataUpdatedAt: number
  error: TError | null
  errorUpdateCount: number
  errorUpdatedAt: number
  fetchFailureCount: number
  fetchMeta: any
  isFetching: boolean
  isInvalidated: boolean
  isPaused: boolean
  status: QueryStatus
}

export interface FetchContext<
  TQueryFnData,
  TError,
  TData,
  TQueryKey extends QueryKey = QueryKey
> {
  fetchFn: () => unknown | Promise<unknown>
  fetchOptions?: FetchOptions
  options: QueryOptions<TQueryFnData, TError, TData, any>
  queryKey: EnsuredQueryKey<TQueryKey>
  state: QueryState<TData, TError>
  meta: QueryMeta | undefined
}

export interface QueryBehavior<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
> {
  onFetch: (
    context: FetchContext<TQueryFnData, TError, TData, TQueryKey>
  ) => void
}

interface FailedAction {
  type: 'failed'
}

interface FetchAction {
  type: 'fetch'
  meta?: any
}

interface SuccessAction<TData> {
  data: TData | undefined
  type: 'success'
  dataUpdatedAt?: number
}

interface ErrorAction<TError> {
  type: 'error'
  error: TError
}

interface InvalidateAction {
  type: 'invalidate'
}

interface PauseAction {
  type: 'pause'
}

interface ContinueAction {
  type: 'continue'
}

interface SetStateAction<TData, TError> {
  type: 'setState'
  state: QueryState<TData, TError>
  setStateOptions?: SetStateOptions
}

export type Action<TData, TError> =
  ContinueAction
  | ErrorAction<TError>
  | FailedAction
  | FetchAction
  | InvalidateAction
  | PauseAction
  | SetStateAction<TData, TError>
  | SuccessAction<TData>

export interface SetStateOptions {
  meta?: any
}

export class Query<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
> {
  queryKey: TQueryKey
  queryHash: string
  options!: QueryOptions<TQueryFnData, TError, TData, TQueryKey>
  initialState: QueryState<TData, TError>
  revertState?: QueryState<TData, TError>
  state: QueryState<TData, TError>
  cacheTime!: number
  meta: QueryMeta | undefined

  private cache: QueryCache
  private promise?: Promise<TData>
  private gcTimer?: number
  private synchronizer?: Retryer<TData, TError>
  private observers: QueryObserver<any, any, any, any, any>[]
  private defaultOptions?: QueryOptions<TQueryFnData, TError, TData, TQueryKey>
  private abortSignalConsumed: boolean

  constructor(config: QueryConfig<TQueryFnData, TError, TData, TQueryKey>) {
    this.abortSignalConsumed = false;
    this.defaultOptions = config.defaultOptions
    this.setOptions(config.options)
    this.observers = []
    this.cache = config.cache
    this.queryKey = config.queryKey
    this.queryHash = config.queryHash
    this.initialState = config.state || this.getDefaultState(this.options)
    this.state = this.initialState
    this.meta = config.meta
    this.scheduleGc()
    console.log('Query initialized, ID: ' + this.queryKey)
  }

  private setOptions(
    options?: QueryOptions<TQueryFnData, TError, TData, TQueryKey>
  ): void {
    // 合并 defaultOptions 和 config.options 作为当前 options
    this.options = { ...this.defaultOptions, ...options}
    this.meta = options?.meta

    // 默认缓存事件为 5 分钟
    this.cacheTime = Math.max(
      this.cacheTime || 0,
      this.options.cacheTime ?? 0.5 * 60 * 1000
    )
  }

  private getDefaultState(
    options: QueryOptions<TQueryFnData, TError, TData, TQueryKey>
  ): QueryState<TData, TError> {
    const data = typeof options.initialData === 'function' 
      ? (options.initialData as InitialDataFunction<TData>)()
      : options.initialData;
    
    const hasInitialData = typeof options.initialData != 'undefined'

    // options.initialDataUpdateAt 可能是 function
    const initialDataUpdateAt = hasInitialData 
      ? typeof options.initialDataUpdateAt === 'function'
        ? (options.initialDataUpdateAt as () => number | undefined)()
        : options.initialDataUpdateAt
      : 0

    const hasData = typeof data !== 'undefined'

    return {
      data,
      dataUpdateCount: 0,
      dataUpdatedAt: hasData ? initialDataUpdateAt ?? Date.now() : 0,
      error: null,
      errorUpdateCount: 0,
      errorUpdatedAt: 0,
      fetchFailureCount: 0,
      fetchMeta: null,
      isFetching: false,
      isInvalidated: false,
      isPaused: false,
      status: hasData ? 'success' : 'idle',
    }
  }

  private scheduleGc(): void {
    this.clearGcTimer();
    console.log('Query Cached, ID: ', this.queryKey)
    
    if (isValidCacheTime(this.cacheTime)) {
      this.gcTimer = setTimeout(() => {
        this.optionalRemove()
        console.log('Query Stale, ID: ' + this.queryKey)
      }, this.cacheTime)
    }
  }

  private clearGcTimer() {
    clearTimeout(this.gcTimer)
    this.gcTimer = undefined
  }

  // 当没有 observer 且 当前 Query 不在 fetching 的时候可以清除 Query 缓存；
  private optionalRemove() {
    console.log('Query Cache removed, ID: ' + this.queryKey)
    if (!this.observers.length && !this.state.isFetching) {
      this.cache.remove(this)
    }
  }

  private dispatch(action: Action<TData, TError>): void {
    this.state = reducer(this.state, this.revertState, action)
  
    notifyManager.batch(() => {
      this.observers.forEach(observer => {
        observer.onQueryUpdate(action)
      })

      this.cache.notify({ query: this, type: 'queryUpdate', action})
      console.log('Query Update Type: ' + action.type + ', ID: ' + this.queryKey)
      
    })
  }

  setData(
    updater: Updater<TData | undefined, TData>,
    options?: SetDataOptions
  ): TData {
    const prevData = this.state.data

    // 获取新数据
    let data = functionalUpdate(updater, prevData)

    if (this.options.isDataEqual?.(prevData, data)) {
      data = prevData as TData
    } else if (this.options.structuralSharing !== false) {
      data = replaceEqualDeep(prevData, data)
    }

    // 设置数据，并标记缓存
    this.dispatch({
      data,
      type: 'success',
      dataUpdatedAt: options?.updatedAt
    })

    return data
  }

  addObserver(observer: QueryObserver<any, any, any, any, any>): void {
    if (this.observers.indexOf(observer) === -1) {
      this.observers.push(observer)

      // 清除缓存时间
      this.clearGcTimer()

      this.cache.notify({ type: 'queryObserverAdd', query: this, observer})
    }
  }

  removeObserver(observer: QueryObserver<any, any, any, any, any>): void {
    if (this.observers.indexOf(observer) !== -1) {
      this.observers = this.observers.filter(x => x !== observer)

      if (this.observers.length === 0) {
        // 如果完全没 observer 了，则取消请求，看是否支持传输层取消
        if (this.synchronizer) {
          if (this.synchronizer.isTransportCancelable || this.abortSignalConsumed) {
            this.synchronizer.cancel({ revert: true })
          } else {
            this.synchronizer.cancelRetry()
          }
        }

        // 重置缓存时间
        if (this.cacheTime) {
          this.scheduleGc()
        } else {
          this.cache.remove(this)
        }
      }

      this.cache.notify({ type: 'queryObserverRemove', query: this, observer})
    }
  }

  fetch(
    options?: QueryOptions<TQueryFnData, TError, TData, TQueryKey>,
    fetchOptions?: FetchOptions
  ): Promise<TData> | undefined {    
    if (this.state.isFetching) {
      // 如果配置中 cancelRefetch，则在 fetch 开始之前取消 refetch
      if (this.state.dataUpdatedAt && fetchOptions?.cancelRefetch) {
        this.cancel({ silent: true })
      } else if (this.promise) {
        // 如果不取消，则直接返回当前的 fetching Promise
        return this.promise
      }
    }

    // 如果有新的 option，要设置一下
    if (options) {
      this.setOptions(options)
    }    

    /**
     * 如果没有 queryFn，则寻找第一个带 queryFn 的 observer
     * 并传入配置
     */
    if (!this.options.queryFn) {
      const observer = this.observers.find(observer => observer.options.queryFn)
      if (observer) {
        this.setOptions(observer.options)
      }
    }

    const queryKey = ensureQueryKeyArray(this.queryKey)
    const abortController = getAbortController()

    const queryFnContext: QueryFunctionContext<TQueryKey> = {
      queryKey,
      meta: this.meta
    }

    Object.defineProperty(queryFnContext, 'signal', {
      enumerable: true,
      get: () => {
        if (abortController) {
          this.abortSignalConsumed = true
          return abortController.signal
        }
        return undefined
      }
    })

    const fetchFn = () => {
      if (!this.options.queryFn) {
        return Promise.reject('Missing queryFn!')
      }
      this.abortSignalConsumed = false
      return this.options.queryFn(queryFnContext)
    }

    // 调用 behavior hook 函数
    const context: FetchContext<TQueryFnData, TError, TData, TQueryKey> = {
      fetchOptions,
      options: this.options,
      queryKey: queryKey,
      state: this.state,
      fetchFn,
      meta: this.meta
    }

    if (this.options.behavior?.onFetch) {
      this.options.behavior?.onFetch(context)
    }

    // 更新 state 前保存 revertState
    this.revertState = this.state

    if (
      !this.state.isFetching ||
      this.state.fetchMeta !== context.fetchOptions?.meta
    ) {
      this.dispatch({ type: 'fetch', meta: context.fetchOptions?.meta})
    }

    this.synchronizer = new Retryer({
      fn: context.fetchFn as () => TData,
      abort: abortController?.abort.bind(abortController),
      onSuccess: (data: any) => {        
        this.setData(data as TData)        

        // Notify cache callback
        this.cache.config.onSuccess?.(data, this as Query<any, any, any, any>)

        // 判断是否需要移除缓存，即移除缓存的时机是请求完成后
        if (this.cacheTime === 0) {
          this.optionalRemove()
        }
      },
      onError: (error: TError | { silent?: boolean }) => {
        // Optimistically 的更新状态 state
        if (!(isCancelledError(error) && error.silent)) {
          this.dispatch({
            type: 'error',
            error: error as TError
          })
        }

        // 如果不是取消错误
        if (!isCancelledError(error)) {
          this.cache.config.onError?.(error, this as Query<any, any, any, any>)

          getLogger().error(error)
        }

        if (this.cacheTime === 0) {
          this.optionalRemove()
        }
      },
      onFail: () => {
        this.dispatch({ type: 'failed' })
      },
      onPause: () => {
        this.dispatch({ type: 'pause' })
      },
      onContinue: () => {
        this.dispatch({ type: 'continue' })
      },
      retry: context.options.retry,
      retryDelay: context.options.retryDelay,
    })

    this.promise = this.synchronizer.promise

    return this.promise
  }

  cancel(options?: CancelOptions): Promise<void> {
    const promise = this.promise
    this.synchronizer?.cancel(options)
    return promise ? promise.then(noop).catch(noop) : Promise.resolve()
  }

  destory(): void {
    this.clearGcTimer()
    this.cancel({ silent: true });
  }

  isStaleByTime(staleTime = 0): boolean {
    return (
      this.state.isInvalidated ||
      !this.state.dataUpdatedAt ||
      !timeUntilStale(this.state.dataUpdatedAt, staleTime)
    )
  }

  onFocus(): void {
    console.log('User Focus, ID: ', this.queryKey)
    
    const observer = this.observers.find(x => x.shouldFetchOnWindowFocus())
    
    if (observer) {
      observer.refetch()
    }

    // 如果目前 paused，则继续 refetch
    this.synchronizer?.continue()
  }

  onOnline(): void {
    const observer = this.observers.find(x => x.shouldFetchOnReconnect())

    if (observer) {
      observer.refetch()
    }

    // 如果目前 paused，则继续 refetch
    this.synchronizer?.continue()
  }
}

function reducer<TData, TError>(
  state: QueryState<TData, TError>,
  revertState: QueryState<TData, TError> | undefined,
  action: Action<TData, TError>
): QueryState<TData, TError> {
  switch (action.type) {
    case 'failed':
      return {
        ...state,
        fetchFailureCount: state.fetchFailureCount + 1,
      }
    case 'pause':
      return {
        ...state,
        isPaused: true,
      }
    case 'continue':
      return {
        ...state,
        isPaused: false,
      }
    case 'fetch':
      return {
        ...state,
        fetchFailureCount: 0,
        fetchMeta: action.meta ?? null,
        isFetching: true,
        isPaused: false,
        status: !state.dataUpdatedAt ? 'loading' : state.status,
      }
    case 'success': 
      return {
        ...state,
        data: action.data,
        dataUpdateCount: state.dataUpdateCount + 1,
        dataUpdatedAt: action.dataUpdatedAt ?? Date.now(),
        error: null,
        fetchFailureCount: 0,
        isFetching: false,
        isInvalidated: false,
        isPaused: false,
        status: 'success',
      }
    case 'error':
      const error = action.error as unknown

      if (isCancelledError(error) && error.revert && revertState) {
        return {...revertState}
      }

      return {
        ...state,
        error: error as TError,
        errorUpdateCount: state.errorUpdateCount + 1,
        errorUpdatedAt: Date.now(),
        fetchFailureCount: state.fetchFailureCount + 1,
        isFetching: false,
        isPaused: false,
        status: 'error',
      }
    case 'invalidate':
      return {
        ...state,
        isInvalidated: true,
      }
    case 'setState':
      return {
        ...state,
        ...action.state,
      }
    default:
      return state
  }
}