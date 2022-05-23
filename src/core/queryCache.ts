import { Subscribable } from './subscribable'
import type { QueryCacheNotifyEvent, CacheConfig, QueryHashMap } from './types/cacheTypes'
import { Query } from './query'
import type { QueryState } from './query'
import { notifyManager } from './notifyManager'
import type { QueryKey, QueryOptions } from './types/types'
import type { QueryClient } from './queryClient'
import { hashQueryKeyByOptions } from './utils'


type QueryCacheListener = (event?: QueryCacheNotifyEvent) => void

export class QueryCache extends Subscribable<QueryCacheListener> {
  config: CacheConfig

  private queries: Query<any, any, any, any>[]
  private queriesMap: QueryHashMap

  constructor(config?: CacheConfig) {
    super();
    this.config = config || {};
    this.queries = [];
    this.queriesMap = {};
  }

  build<TQueryFnData, TError, TData, TQueryKey extends QueryKey>(
    client: QueryClient,
    options: QueryOptions<TQueryFnData, TError, TData, TQueryKey>,
    state?: QueryState<TData, TError>
  ): Query<TQueryFnData, TError, TData, TQueryKey> {
    const queryKey = options.queryKey!
    const queryHash = options.queryHash ?? hashQueryKeyByOptions(queryKey, options)

    let query = this.get<TQueryFnData, TError, TData, TQueryKey>(queryHash)    

    if (!query) {
      query = new Query({
        cache: this,
        queryKey,
        queryHash,
        options: client.defaultQueryOptions(options),
        state,
        defaultOptions: client.getQueryDefaults(queryKey),
        meta: options.meta
      })
      this.add(query)
    }

    return query
  }

  add(query: Query<any, any, any, any>): void {
    if (!this.queriesMap[query.queryHash]) {
      /**
       * 为什么这里就确定 query 一定有 queryHash 呢
       * 因为在 build 创建 query 的时候就计算好 hash 了
       */
      this.queriesMap[query.queryHash] = query
      this.queries.push(query)
      this.notify({
        type: 'queryAdd',
        query
      })
    }
  }

  get<
    TQueryFnData = unknown,
    TError = unknown,
    TData = TQueryFnData,
    TQueryKey extends QueryKey = QueryKey
  >(
    queryHash: string
  ): Query<TQueryFnData, TError, TData, TQueryKey> | undefined {
    return this.queriesMap[queryHash]
  }

  notify(event: QueryCacheNotifyEvent) {
    notifyManager.batch(() => {
      this.listeners.forEach(listener => {
        listener(event)
      })
    })
  }

  remove(query: Query<any, any, any, any>): void {
    const isQueryInCache = this.queriesMap[query.queryHash];

    if (isQueryInCache) {
      query.destory();

      this.queries = this.queries.filter(q => q !== query);

      if (isQueryInCache === query) {
        delete this.queriesMap[query.queryHash];
      }

      this.notify({ type: 'queryRemove', query });
    }
  }

  onFocus(): void {
    notifyManager.batch(() => {
      this.queries.forEach(query => {        
        query.onFocus()
      })
    })
  }

  onOnline(): void {
    notifyManager.batch(() => {
      this.queries.forEach(query => {
        query.onOnline()
      })
    })
  }
}