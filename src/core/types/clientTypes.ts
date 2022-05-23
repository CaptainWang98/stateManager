import type { QueryCache } from "../queryCache"
import type { QueryKey, QueryOptions } from "./types"
import type { QueryObserverOptions } from './observerTypes'


export interface DefaultOptions<TError = unknown> {
  queries?: QueryObserverOptions<unknown, TError>
}

export interface QueryClientConfig {
  queryCache?: QueryCache
  defaultOptions?: DefaultOptions
}

export interface QueryDefaults {
  queryKey: QueryKey
  defaultOptions: QueryOptions<any, any, any>
}
