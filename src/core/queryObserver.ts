import { Subscribable } from "./subscribable";
import type { QueryKey, QueryOptions, RefetchOptions, RefetchQueryFilters } from "./types/types";
import type { 
  QueryObserverBaseResult, 
  QueryObserverListener, 
  QueryObserverOptions, 
  QueryObserverResult, 
  ObserverFetchOptions
} from './types/observerTypes'
import type { Action, Query, QueryState } from "./query";
import type { QueryClient } from "./queryClient";
import type { NotifyOptions } from "./types/observerTypes";
import { isCancelledError } from "./types/retryerTypes";
import { 
  isValidCacheTime,
  timeUntilStale,
  shouldFetchOnMount,
  shouldFetchOptionally,
  replaceEqualDeep,
  isStale,
  shallowEqualObjects,
  noop,
  isValidTimeout
} from "./utils";
import { getLogger } from "./logger";
import { notifyManager } from "./notifyManager";
import { focusManager } from "./focusManager";

export class QueryObserver<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
> extends Subscribable<QueryObserverListener<TData, TError>> {
  options: QueryObserverOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >

  private client: QueryClient
  private currentQuery!: Query<TQueryFnData, TError, TQueryData, TQueryKey>
  private currentQueryInitialState!: QueryState<TQueryData, TError>
  private currentResult!: QueryObserverResult<TData, TError>
  private currentResultState?: QueryState<TQueryData, TError>
  private currentResultOptions?: QueryObserverOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >
  private previousQueryResult?: QueryObserverResult<TData, TError>
  private previousSelectError: Error | null
  private staleTimeoutId?: number
  private refetchIntervalId: number | undefined
  private currentRefetchInterval?: number | false
  private trackedProps!: Array<keyof QueryObserverResult>

  constructor(
    client: QueryClient,
    options: QueryObserverOptions<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >
  ) {
    super();

    this.client = client;
    this.options = options;
    this.trackedProps = [];
    this.previousSelectError = null;
    this.bindMethods();
    this.setOptions(options);
  }

  setOptions(
    options?: QueryObserverOptions<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >,
    notifyOptions?: NotifyOptions
  ): void {
    const prevOptions = this.options
    const prevQuery = this.currentQuery

    this.options = this.client.defaultQueryObserverOptions(options)

    if (
      typeof this.options.enabled !== 'undefined'
      && typeof this.options.enabled !== 'boolean'
    ) {
      throw new Error('Expected enabled to be a boolean!')
    }

    if (!this.options.queryKey) {
      this.options.queryKey = prevOptions.queryKey
    }

    this.updateQuery()    

    const mounted = this.hasListeners()

    // 如果有订阅者，执行 Fetch
    if (
      mounted
      && shouldFetchOptionally(
        this.currentQuery,
        prevQuery,
        this.options,
        prevOptions
      )
    ) {      
      this.executeFetch()
    }

    // 更新 Result
    this.updateResult(notifyOptions)

    // 更新 stale Interval
    if (
      mounted
      && (this.currentQuery !== prevQuery
          || this.options.enabled !== prevOptions.enabled
          || this.options.staleTime !== prevOptions.staleTime)
    ) {
      this.updateStaleTimers()
    }

    const nextRefetchInterval = this.computeRefetchInterval()

    // 更新 refetch Interval
    if (
      mounted
      && (this.currentQuery !== prevQuery
          || this.options.enabled !== prevOptions.enabled
          || nextRefetchInterval !== this.currentRefetchInterval)
    ) {
      this.updateRefetchInterval(nextRefetchInterval)
    }
  }

  remove(): void {
    this.client.getQueryCache().remove(this.currentQuery);
  }

  refetch<TPageData>(
    options?: RefetchOptions & RefetchQueryFilters<TPageData>
  ): Promise<QueryObserverResult<TData, TError>> {
    return this.fetch({
      ...options
      // meta: { refetchPage: options?.refetchPage }
    })
  }

  // 在 query 更新时，根据更新动作触发回调函数
  onQueryUpdate(action: Action<TData, TError>): void {    
    const notifyOptions: NotifyOptions = {}

    if (action.type === 'success') {
      notifyOptions.onSuccess = true
    } else if (action.type === 'error' && !isCancelledError(action.error)) {
      notifyOptions.onError = true
    }

    this.updateResult(notifyOptions)

    if (this.hasListeners()) {
      this.updateTimers()
    }
  }
  /**
   * 判断是否需要更新 result，及是否需要 notify
   * @param notifyOptions 
   * @returns 
   */
  updateResult(notifyOptions?: NotifyOptions): void {
    const prevResult = this.currentResult as QueryObserverResult<TData, TError> | undefined    
    this.currentResult = this.createResult(this.currentQuery, this.options)    
    this.currentResultState = this.currentQuery.state
    this.currentResultOptions = this.options

    if (shallowEqualObjects(this.currentResult, prevResult)) {
      return
    }

    // 条件判断，调用回调函数
    const defaultNotifyOptions: NotifyOptions = { cache: true }

    if (
      notifyOptions?.listeners !== false
      && this.shouldNotifyListeners(this.currentResult, prevResult)
    ) {
      defaultNotifyOptions.listeners = true
    }

    this.notify({...defaultNotifyOptions, ...notifyOptions})
  }


  protected bindMethods(): void {
    this.remove = this.remove.bind(this);
    this.refetch = this.refetch.bind(this);
  }

  // 在订阅时调用，开始观察 currentQuery 并判断是否 refetch，更新 timer
  protected onSubscribe(): void { 
    if (this.listeners.length === 1) {
      this.currentQuery.addObserver(this)

      if (shouldFetchOnMount(this.currentQuery, this.options)) {        
        this.executeFetch()
      }      

      this.updateTimers()
    }
  }

  // 在解除订阅时 destory()
  protected onUnsubscribe(): void {
    if (!this.listeners.length) {
      this.destroy()
    }
  }

  destroy(): void {
    this.listeners = []
    this.clearTimers()
    this.currentQuery.removeObserver(this)
  }

  protected createResult(
    query: Query<TQueryFnData, TError, TQueryData, TQueryKey>,
    options: QueryObserverOptions<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >
  ): QueryObserverResult<TData, TError> {    
    const prevQuery = this.currentQuery
    const prevOptions = this.options
    const prevResult = this.currentResult
    const prevResultState = this.currentResultState
    const prevResultOptions = this.currentResultOptions
    const queryChange = query !== prevQuery
    const queryInitialState = queryChange
      ? query.state
      : this.currentQueryInitialState
    const prevQueryResult = queryChange
      ? this.currentResult
      : this.previousQueryResult

    const { state } = query
    let { dataUpdatedAt, error, errorUpdatedAt, isFetching, status } = state
    let isPreviousData = false
    let isPlaceholderData = false
    let data: TData | undefined

    // 提前设置 result
    if (options.optimisticResult) {
      const mounted = this.hasListeners()

      // 是否在 mount 阶段 fetch
      const fetchOnMount = !mounted && shouldFetchOnMount(query, options)

      // 是否fetch
      const fetchOptionally = mounted && shouldFetchOptionally(query, prevQuery, options, prevOptions)

      if (fetchOnMount || fetchOptionally) {
        isFetching = true
        if (!dataUpdatedAt) {
          status = 'loading'
        }
      }
    }

    // 保存先前数据
    if (
      options.keepPreviousData
      && !state.dataUpdateCount
      && prevQueryResult?.isSuccess
      && status !== 'error'
    ) {
      data = prevQueryResult.data
      dataUpdatedAt = prevQueryResult.dataUpdatedAt
      status = prevQueryResult.status
      // 临时变量 data 是否是先前数据
      isPreviousData = true
    } else if (options.select && typeof state.data !== 'undefined') {
      // 筛选数据
      // 优化，如果相同则直接传值
      if (
        prevResult
        && state.data === prevResultState?.data
        && options.select === prevResultOptions?.select
        && !this.previousSelectError
      ) {
        data = prevResult.data
      } else {
        try {
          data = options.select(state.data)
          if (options.structuralSharing !== false) {
            data = replaceEqualDeep(prevResult?.data, data)
          }
          this.previousSelectError = null
        } catch (selectError) {
          getLogger().error(selectError)
          // @ts-ignore
          error = selectError
          // @ts-ignore
          this.previousSelectError = selectError
          errorUpdatedAt = Date.now()
          status = 'error'
        }
      }
    } else {
      // 未设置 select，则直接使用 data
      data = (state.data as unknown) as TData
    }

    const result: QueryObserverBaseResult<TData, TError> = {
      status,
      isLoading: status === 'loading',
      isSuccess: status === 'success',
      isError: status === 'error',
      isIdle: status === 'idle',
      data,
      dataUpdatedAt,
      error,
      errorUpdatedAt,
      failureCount: state.fetchFailureCount,
      isFetched: state.dataUpdateCount > 0 || state.errorUpdateCount > 0,
      isFetchedAfterMount:
        state.dataUpdateCount > queryInitialState.dataUpdateCount ||
        state.errorUpdateCount > queryInitialState.errorUpdateCount,
      isFetching,
      isRefetching: isFetching && status !== 'loading',
      isLoadingError: status === 'error' && state.dataUpdatedAt === 0,
      isPlaceholderData,
      isPreviousData,
      isRefetchError: status === 'error' && state.dataUpdatedAt !== 0,
      isStale: isStale(query, options),
      refetch: this.refetch,
      remove: this.remove,
    }
    
    return result as QueryObserverResult<TData, TError>
  }

  protected updateQuery(): void {
    const query = this.client
      .getQueryCache()
      .build(
        this.client,
        this.options as QueryOptions<
          TQueryFnData,
          TError,
          TQueryData,
          TQueryKey
        >
      )
    
    if (query === this.currentQuery) {
      return
    }    

    const prevQuery = this.currentQuery
    this.currentQuery = query
    this.currentQueryInitialState = query.state
    this.previousQueryResult = this.currentResult

    // If it is not the frist listener, add to Observer
    // 烂代码，为了在第一次执行的时候 让 mounted 为 false，这样状态就是 Idle
    if (this.hasListeners()) {
      prevQuery?.removeObserver(this)
      query.addObserver(this)
    }
  }

  protected fetch(
    fetchOptions?: ObserverFetchOptions
  ): Promise<QueryObserverResult<TData, TError>> {
    return this.executeFetch(fetchOptions).then(() => {
      this.updateResult()
      return this.currentResult
    })
  }

  private executeFetch(
    fetchOptions?: ObserverFetchOptions
  ): Promise<TQueryData | undefined> {
    this.updateQuery()

    let promise: Promise<TQueryData | undefined> = this.currentQuery.fetch(
      this.options as QueryOptions<TQueryFnData, TError, TQueryData, TQueryKey>,
      fetchOptions
    )

    if (!fetchOptions?.throwOnError) {
      promise = promise.catch(noop)
    }    
    return promise
  }

  private updateTimers(): void {
    this.updateStaleTimers()
    this.updateRefetchInterval(this.computeRefetchInterval())
  }

  private clearStaleTimers(): void {
    clearTimeout(this.staleTimeoutId)
    this.staleTimeoutId = undefined
  }

  private updateStaleTimers(): void {
    this.clearStaleTimers() 

    // 如果目前已经是过期 timer ｜ 设置不正确，直接返回
    if (this.currentResult.isStale || !isValidCacheTime(this.options.staleTime)) {
      return
    }

    const time = timeUntilStale(this.currentResult.dataUpdatedAt, this.options.staleTime)

    const timeout = time + 1

    this.staleTimeoutId = setTimeout(() => {
      if (!this.currentResult.isStale) {
        this.updateResult()
      }
    }, timeout)
  }

  private clearRefetchInterval(): void {
    clearInterval(this.refetchIntervalId)
    this.refetchIntervalId = undefined
  }

  private clearTimers(): void {
    this.clearStaleTimers()
    this.clearRefetchInterval()
  }

  private computeRefetchInterval() {
    return typeof this.options.refetchInterval === 'function'
      ? this.options.refetchInterval(this.currentResult.data, this.currentQuery)
      : this.options.refetchInterval ?? false
  }

  private updateRefetchInterval(nextInterval: number | false): void {
    this.clearRefetchInterval()
    
    this.currentRefetchInterval = nextInterval

    if (
      this.options.enabled === false
      || !isValidTimeout(this.currentRefetchInterval)
      || this.currentRefetchInterval === 0
    ) {
      return
    }

    this.refetchIntervalId = setInterval(() => {
      if (
        this.options.refetchIntervalInBackground
        || focusManager.isFocused()
      ) {
        this.executeFetch()
      }
    }, this.currentRefetchInterval)
  }

  private shouldNotifyListeners(
    result: QueryObserverResult,
    prevResult?: QueryObserverResult
  ): boolean {
    if (!prevResult) {
      return true
    }

    const { notifyOnChangeProps, notifyOnChangePropsExclusions } = this.options

    if (!notifyOnChangeProps && !notifyOnChangePropsExclusions) {
      return true
    }

    if (notifyOnChangeProps === 'tracked' && !this.trackedProps.length) {
      return true
    }

    const includedProps =
      notifyOnChangeProps === 'tracked'
        ? this.trackedProps
        : notifyOnChangeProps

    return Object.keys(result).some(key => {
      const typedKey = key as keyof QueryObserverResult
      const changed = result[typedKey] !== prevResult[typedKey]
      const isIncluded = includedProps?.some(x => x === key)
      const isExcluded = notifyOnChangePropsExclusions?.some(x => x === key)
      return changed && !isExcluded && (!includedProps || isIncluded)
    })
  }

  private notify(notifyOptions: NotifyOptions): void {
    notifyManager.batch(() => {
      // 先执行配置中的 callback 函数
      if (notifyOptions.onSuccess) {
        this.options.onSuccess?.(this.currentResult.data!)
        this.options.onSettled?.(this.currentResult.data!, null)
      } else if (notifyOptions.onError) {
        this.options.onError?.(this.currentResult.error!)
        this.options.onSettled?.(undefined, this.currentResult.error!)
      }

      // 然后 notify listeners
      if (notifyOptions.listeners) {
        this.listeners.forEach(listener => {
          listener(this.currentResult)
        })
      }

      // 最后 notify cache 的 listeners
      if (notifyOptions.cache) {
        this.client
          .getQueryCache()
          .notify({ query: this.currentQuery, type: 'queryObserverResultUpdate'})
      }
    })
  }

  shouldFetchOnWindowFocus(): boolean {
    return shouldFetchOnWindowFocus(this.currentQuery, this.options)
  }

  shouldFetchOnReconnect(): boolean {
    return shouldFetchOnReconnect(this.currentQuery, this.options)
  }

  getCurrentResult(): QueryObserverResult<TData, TError> {
    return this.currentResult
  }
}

function shouldFetchOnWindowFocus(
  query: Query<any, any, any, any>,
  options: QueryObserverOptions<any, any, any, any, any>
): boolean {
  return (
    options.enabled !== false &&
    (options.refetchOnWindowFocus === 'always' ||
      (options.refetchOnWindowFocus !== false && isStale(query, options)))
  )
}

function shouldFetchOnReconnect(
  query: Query<any, any, any, any>,
  options: QueryObserverOptions<any, any, any, any, any>
): boolean {
  return (
    options.enabled !== false &&
    (options.refetchOnReconnect === 'always' ||
      (options.refetchOnReconnect !== false && isStale(query, options)))
  )
}