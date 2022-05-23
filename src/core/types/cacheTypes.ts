import type { Query } from "../query"
import type { QueryObserver } from "../queryObserver"
import type { Action } from "../query"

export interface CacheConfig {
  onSuccess?: (data: unknown, query: Query<unknown, unknown, unknown>) => void
  onError?: (error: unknown, query: Query<unknown, unknown, unknown>) => void
}

export interface QueryHashMap {
  [hash: string]: Query<any, any, any, any>
}

interface QueryAddEvent {
  type: 'queryAdd'
  query: Query<any, any, any, any>
}

interface QueryRemoveEvent {
  type: 'queryRemove'
  query: Query<any, any, any, any>
}

interface QueryUpdateEvent {
  type: 'queryUpdate'
  query: Query<any, any, any, any>
  action: Action<any, any>
}

interface QueryAddObserverEvent {
  type: 'queryObserverAdd'
  query: Query<any, any, any, any>
  observer: QueryObserver<unknown, unknown, unknown>
}

interface QueryRemoveObserverEvent {
  type: 'queryObserverRemove'
  query: Query<any, any, any, any>
  observer: QueryObserver<unknown, unknown, unknown>
}

interface ObserverResultUpdateEvent {
  type: 'queryObserverResultUpdate'
  query: Query<any, any, any, any>
}

export type QueryCacheNotifyEvent = 
  QueryAddEvent
  | QueryRemoveEvent
  | QueryUpdateEvent
  | QueryAddObserverEvent
  | QueryRemoveObserverEvent
  | ObserverResultUpdateEvent

export type QueryCacheListener = (event?: QueryCacheNotifyEvent) => void