import type { 
  QueryKey, 
  QueryOptions, 
  QueryStatus, 
  InfiniteData, 
  FetchNextPageOptions, 
  FetchPreviousPageOptions 
} from "./types";
import type { Query, FetchOptions } from '../query'
import type { RefetchOptions, RefetchQueryFilters } from './types'

export type PlaceHolderDataFunction<TResult> = () => TResult | undefined

export interface InfiniteQueryObserverBaseResult<
  TData = unknown,
  TError = unknown
> extends QueryObserverBaseResult<InfiniteData<TData>, TError> {
  fetchNextPage: (
    options?: FetchNextPageOptions
  ) => Promise<InfiniteQueryObserverResult<TData, TError>>
  fetchPreviousPage: (
    options?: FetchPreviousPageOptions
  ) => Promise<InfiniteQueryObserverResult<TData, TError>>
  hasNextPage?: boolean
  hasPreviousPage?: boolean
  isFetchingNextPage: boolean
  isFetchingPreviousPage: boolean
}

export interface InfiniteQueryObserverIdleResult<
  TData = unknown,
  TError = unknown
> extends InfiniteQueryObserverBaseResult<TData, TError> {
  data: undefined
  error: null
  isError: false
  isIdle: true
  isLoading: false
  isLoadingError: false
  isRefetchError: false
  isSuccess: false
  status: 'idle'
}

export interface InfiniteQueryObserverLoadingResult<
  TData = unknown,
  TError = unknown
> extends InfiniteQueryObserverBaseResult<TData, TError> {
  data: undefined
  error: null
  isError: false
  isIdle: false
  isLoading: true
  isLoadingError: false
  isRefetchError: false
  isSuccess: false
  status: 'loading'
}

export interface InfiniteQueryObserverLoadingErrorResult<
  TData = unknown,
  TError = unknown
> extends InfiniteQueryObserverBaseResult<TData, TError> {
  data: undefined
  error: TError
  isError: true
  isIdle: false
  isLoading: false
  isLoadingError: true
  isRefetchError: false
  isSuccess: false
  status: 'error'
}

export interface InfiniteQueryObserverRefetchErrorResult<
  TData = unknown,
  TError = unknown
> extends InfiniteQueryObserverBaseResult<TData, TError> {
  data: InfiniteData<TData>
  error: TError
  isError: true
  isIdle: false
  isLoading: false
  isLoadingError: false
  isRefetchError: true
  isSuccess: false
  status: 'error'
}

export interface InfiniteQueryObserverSuccessResult<
  TData = unknown,
  TError = unknown
> extends InfiniteQueryObserverBaseResult<TData, TError> {
  data: InfiniteData<TData>
  error: null
  isError: false
  isIdle: false
  isLoading: false
  isLoadingError: false
  isRefetchError: false
  isSuccess: true
  status: 'success'
}

export type InfiniteQueryObserverResult<TData = unknown, TError = unknown> =
  | InfiniteQueryObserverIdleResult<TData, TError>
  | InfiniteQueryObserverLoadingErrorResult<TData, TError>
  | InfiniteQueryObserverLoadingResult<TData, TError>
  | InfiniteQueryObserverRefetchErrorResult<TData, TError>
  | InfiniteQueryObserverSuccessResult<TData, TError>

export interface QueryObserverOptions<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
> extends QueryOptions<TQueryFnData, TError, TQueryData, TQueryKey> {
  // enable auto refetching on query mount/change key
  enabled?: boolean,
  staleTime?: number,
  refetchInterval?: number | false | ((data: TData | undefined, query: Query<TQueryFnData, TError, TQueryData, TQueryKey>) => number | false)
  refetchIntervalInBackground?: boolean
  refetchOnWindowFocus?: boolean | 'always'
  refetchOnReconnect?: boolean | 'always'
  refetchOnMount?: boolean | 'always'
  /**
   * ??? Query ??? Error ????????? retry
   * ?????? Error ?????? refetch
   */
  retryOnMount?: boolean
  /**
   * ?????????????????????????????????????????? properties ????????? re-render
   * `['data', 'error']`??????????????????????????????????????? properties ????????? re-render
   * `tracked` ?????????????????? properties ??????????????????????????????????????????????????? properties ????????? re-render
   */
  notifyOnChangeProps?: Array<keyof InfiniteQueryObserverResult> | 'tracked'
  /**
   * ????????????????????? properties ???????????????????????? re-render
   */
  notifyOnChangePropsExclusions?: Array<keyof InfiniteQueryObserverResult>
  onSuccess?: (data: TData) => void
  onError?: (err: TError) => void
  onSettled?: (data: TData | undefined, error: TError | null) => void
  /**
   * react ????????????????????????
   */
  // useErrorBoundary?: boolean | ((error: TError) => boolean)
  /**
   * ????????????????????? Query ????????? Data
   */
  select?: (data: TQueryData) => TData
  /**
   * React Experimental Only
   * ????????? true ??????Query ?????? `status === 'loading'` ?????????
   * ????????? error ??? `status === 'error'`
   * ????????? `false`
   */
  // suspense?: boolean
  /**
   * ????????? true ??????
   */
  keepPreviousData?: boolean
  placeholderData?: TQueryData | PlaceHolderDataFunction<TQueryData>
  /**
   * ????????? true???Observer ?????? Query ?????? fetch ?????????????????? Query ??? state
   * ???????????????????????????
   */
  optimisticResult?: boolean
}

export interface QueryObserverBaseResult<TData = unknown, TError = unknown> {
  data: TData | undefined
  dataUpdatedAt: number
  error: TError | null
  errorUpdatedAt: number
  failureCount: number
  isError: boolean
  isFetched: boolean
  isFetchedAfterMount: boolean
  isFetching: boolean
  isIdle: boolean
  isLoading: boolean
  isLoadingError: boolean
  isPlaceholderData: boolean
  isPreviousData: boolean
  isRefetchError: boolean
  isRefetching: boolean
  isStale: boolean
  isSuccess: boolean
  refetch: <TPageData>(
    options?: RefetchOptions & RefetchQueryFilters<TPageData>
  ) => Promise<QueryObserverResult<TData, TError>>
  remove: () => void
  status: QueryStatus
}

export interface QueryObserverIdleResult<TData = unknown, TError = unknown> extends QueryObserverBaseResult<TData, TError> {
  data: undefined
  error: null
  isError: false
  isIdle: true
  isLoading: false
  isLoadingError: false
  isRefetchError: false
  isSuccess: false
  statue: 'idle'
}

export interface QueryObserverLoadingResult<TData = unknown, TError = unknown>
  extends QueryObserverBaseResult<TData, TError> {
  data: undefined
  error: null
  isError: false
  isIdle: false
  isLoading: true
  isLoadingError: false
  isRefetchError: false
  isSuccess: false
  status: 'loading'
}

export interface QueryObserverLoadingErrorResult<
  TData = unknown,
  TError = unknown
> extends QueryObserverBaseResult<TData, TError> {
  data: undefined
  error: TError
  isError: true
  isIdle: false
  isLoading: false
  isLoadingError: true
  isRefetchError: false
  isSuccess: false
  status: 'error'
}

export interface QueryObserverRefetchErrorResult<
  TData = unknown,
  TError = unknown
> extends QueryObserverBaseResult<TData, TError> {
  data: TData
  error: TError
  isError: true
  isIdle: false
  isLoading: false
  isLoadingError: false
  isRefetchError: true
  isSuccess: false
  status: 'error'
}

export interface QueryObserverSuccessResult<TData = unknown, TError = unknown>
  extends QueryObserverBaseResult<TData, TError> {
  data: TData
  error: null
  isError: false
  isIdle: false
  isLoading: false
  isLoadingError: false
  isRefetchError: false
  isSuccess: true
  status: 'success'
}

export type QueryObserverResult<TData = unknown, TError = unknown> =
  QueryObserverIdleResult<TData, TError>
  | QueryObserverLoadingErrorResult<TData, TError>
  | QueryObserverLoadingResult<TData, TError>
  | QueryObserverRefetchErrorResult<TData, TError>
  | QueryObserverSuccessResult<TData, TError>

export type QueryObserverListener<TData, TError> = (
  result: QueryObserverResult<TData, TError>
) => void

export interface ObserverFetchOptions extends FetchOptions {
  throwOnError?: boolean
}

export interface NotifyOptions {
  cache?: boolean
  listeners?: boolean
  onError?: boolean
  onSuccess?: boolean
}