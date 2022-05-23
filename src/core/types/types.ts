import type { QueryBehavior } from "../query"
import type { QueryFilters } from '../utils'
import type { RetryDelayValue, RetryValue } from "./retryerTypes"

export type QueryKey = string | readonly unknown[]

// Ensure that all QueryKey in runtime is Array.
export type EnsuredQueryKey<T extends QueryKey> = T extends string ? [T] : Exclude<T, string>

export type QueryFunction<
  T = unknown,
  TQueryKey extends QueryKey = QueryKey
> = (context: QueryFunctionContext<TQueryKey>) => T | Promise<T>

export interface QueryFunctionContext<
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = any
> {
  queryKey: EnsuredQueryKey<TQueryKey>,
  signal?: AbortSignal,
  // pageParam?: 
  meta: QueryMeta | undefined
}

export type QueryMeta = Record<string, unknown>

// 4 types statues of Query: idle / loading / error / success
export type QueryStatus = 'idle' | 'loading' | 'error' | 'success'

export type HashFunction<TQueryKey extends QueryKey> = (
  queryKey: TQueryKey
) => string

export interface InfiniteData<TData> {
  pages: TData[]
  pageParams: unknown[]
}

export interface FetchNextPageOptions extends ResultOptions {
  cancelRefetch?: boolean
  pageParam?: unknown
}

export interface FetchPreviousPageOptions extends ResultOptions {
  cancelRefetch?: boolean
  pageParam?: unknown
}

export type InitialDataFunction<T> = () => T | undefined

export interface QueryOptions<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
> {
  retry?: RetryValue<TError>
  retryDelay?: RetryDelayValue<TError>
  cacheTime?: number
  isDataEqual?: (oldData: TData | undefined, newData: TData) => boolean
  queryFn?: QueryFunction<TQueryFnData, TQueryKey>
  queryHash?: string
  queryKey?: TQueryKey
  queryKeyHashFn?: HashFunction<TQueryKey>
  initialData?: TData | InitialDataFunction<TData>
  initialDataUpdateAt?: number | (() => number | undefined)
  behavior?: QueryBehavior<TQueryFnData, TError, TData>
  /**
   * If structural share data between two Queries.
   */
  structuralSharing?: boolean
  // getPreviousPageParam?: 
  // getNextPageParam
  _defaulted?: boolean
  meta?: QueryMeta
}

export interface ResultOptions {
  /**
   * 是否在出 error 时抛出错误
   */
  throwOnError?: boolean
}

export interface RefetchOptions extends ResultOptions {
  /**
   * 是否在开始一个新的 Query 之前取消当前的 request
   */
  cancelRefetch?: boolean
}

/**
 * 只适用于 infiniteQuery
 */
export interface RefetchPageFilters<TPageData = unknown> {
  /**
   * 当只需要 refetch 某些 page 时，用这个函数确定条件
   */
  refetchPage?: (
    lastPage: TPageData,
    index: number,
    allPages: TPageData[]
  ) => boolean
}

/**
 * 适用于 Query 和 InfiniteQuery 的 RefetchFilters
 */
export interface RefetchQueryFilters<TPageData = unknown> extends QueryFilters, RefetchPageFilters<TPageData> {}

export type DataUpdateFunction<TInput, TOutput> = (input: TInput) => TOutput

export type Updater<TInput, TOutput> =
  TOutput
  | DataUpdateFunction<TInput, TOutput>

export interface SetDataOptions {
  updatedAt?: number
}
