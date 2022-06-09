import { QueryCache } from "./queryCache";
import type { DefaultOptions, QueryClientConfig, QueryDefaults } from "./types/clientTypes";
import type { QueryObserverOptions } from "./types/observerTypes";
import { hashQueryKeyByOptions, partialMatchKey } from "./utils";
import type { QueryKey } from "./types/types";
import { focusManager } from "./focusManager";
import { onlineManager } from "./onlineManager";

export class QueryClient {
  private queryCache: QueryCache
  private defaultOptions: DefaultOptions
  private queryDefaults: QueryDefaults[]
  private unsubscribeFocus?: () => void
  private unsubscribeOnline?: () => void

  constructor(config: QueryClientConfig = {}) {
    this.queryCache = config.queryCache || new QueryCache();
    this.defaultOptions = config.defaultOptions || {};
    this.queryDefaults = [];
  }

  mount(): void {
    this.unsubscribeFocus = focusManager.subscribe(() => {
      if (focusManager.isFocused() && onlineManager.isOnline()) {        
        this.queryCache.onFocus()
      }
    })
    this.unsubscribeOnline = focusManager.subscribe(() => {
      if (focusManager.isFocused() && onlineManager.isOnline()) {
        this.queryCache.onOnline()
      }
    })
  }

  unmount(): void {
    this.unsubscribeFocus?.()
    this.unsubscribeOnline?.()
  }

  defaultQueryOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey extends QueryKey
  >(
    options?: QueryObserverOptions<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >
  ): QueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey> {
    if (options?._defaulted) {
      return options
    }

    const defaultedOptions = {
      ...this.defaultOptions.queries,
      ...this.getQueryDefaults(options?.queryKey),
      ...options,
      _defaulted: true,
    } as QueryObserverOptions<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >

    // 这这里设置计算 queryhash
    if (!defaultedOptions.queryHash && defaultedOptions.queryKey) {
      defaultedOptions.queryHash = hashQueryKeyByOptions(
        defaultedOptions.queryKey,
        defaultedOptions
      )
    }

    return defaultedOptions
  }

  getQueryDefaults(
    queryKey?: QueryKey
  ): QueryObserverOptions<any, any, any, any, any> | undefined {
    return queryKey
      ? this.queryDefaults.find(x => partialMatchKey(queryKey, x.queryKey))
          ?.defaultOptions
      : undefined
  }

  getQueryCache(): QueryCache {
    return this.queryCache
  }

  defaultQueryObserverOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey extends QueryKey
  >(
    options?: QueryObserverOptions<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >
  ): QueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey> {
    return this.defaultQueryOptions(options)
  }
  
}