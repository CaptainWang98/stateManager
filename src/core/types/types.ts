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
   * ???????????? error ???????????????
   */
  throwOnError?: boolean
}

export interface RefetchOptions extends ResultOptions {
  /**
   * ??????????????????????????? Query ????????????????????? request
   */
  cancelRefetch?: boolean
}

/**
 * ???????????? infiniteQuery
 */
export interface RefetchPageFilters<TPageData = unknown> {
  /**
   * ???????????? refetch ?????? page ?????????????????????????????????
   */
  refetchPage?: (
    lastPage: TPageData,
    index: number,
    allPages: TPageData[]
  ) => boolean
}

/**
 * ????????? Query ??? InfiniteQuery ??? RefetchFilters
 */
export interface RefetchQueryFilters<TPageData = unknown> extends QueryFilters, RefetchPageFilters<TPageData> {}

export type DataUpdateFunction<TInput, TOutput> = (input: TInput) => TOutput

export type Updater<TInput, TOutput> =
  TOutput
  | DataUpdateFunction<TInput, TOutput>

export interface SetDataOptions {
  updatedAt?: number
}
