import type { Query } from './query'
import type { QueryKey, QueryOptions, EnsuredQueryKey } from './types/types'
import type { QueryObserverOptions } from './types/observerTypes'
import type { Updater } from './types/types'

/**
 * value 是数字，且大于0，且不是 Infinity
 * @param value 
 * @returns 
 */
export function isValidTimeout(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && value !== Infinity
}

export function isValidCacheTime(value: unknown): value is number {
  return typeof value === 'number' && value >=0 && value !== Infinity
}

export interface QueryFilters {
  /**
   * 是否包括活跃的 Query
   */
  isIncludeActiveQuery?: boolean
  /**
   * 是否按照 QueryKey 精准匹配
   */
  extectMatch?: boolean
  /**
   * 是否包括不活跃的 Query
   */
  isInIncludeInactiveQuery?: boolean
  /**
   * 过滤函数，返回 true 为符合条件的 Query
   * 
   */
  filterFn?: (query: Query) => boolean
  queryKey?: QueryKey
  isIncludeStaleQuery?: boolean
  isIncludeFetchingQuery?: boolean
}

export function sleep(timeout: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, timeout)
  })
}

// wired function
export function noop(): undefined {
  return undefined
}

export function hashQueryKeyByOptions<TQueryKey extends QueryKey = QueryKey>(
  queryKey: TQueryKey,
  options?: QueryOptions<any, any, any, TQueryKey>
): string {
  const hashFn = options?.queryKeyHashFn || hashQueryKey
  return hashFn(queryKey)
}

/**
 * Default query keys hash function.
 */
 export function hashQueryKey(queryKey: QueryKey): string {
  const asArray = ensureQueryKeyArray(queryKey)
  return stableValueHash(asArray)
}

export function isError(value: any): value is Error {
  return value instanceof Error
}

export function ensureQueryKeyArray<T extends QueryKey>(
  value: T
): EnsuredQueryKey<T> {
  return (Array.isArray(value)
    ? value
    : ([value] as unknown)) as EnsuredQueryKey<T>
}

/**
 * Hashes the value into a stable hash.
 */
 export function stableValueHash(value: any): string {
  return JSON.stringify(value, (_, val) =>
    isPlainObject(val)
      ? Object.keys(val)
          .sort()
          .reduce((result, key) => {
            result[key] = val[key]
            return result
          }, {} as any)
      : val
  )
}

export function isPlainObject(o: any): o is Object {
  if (!hasObjectPrototype(o)) {
    return false
  }

  // If has modified constructor
  const ctor = o.constructor
  if (typeof ctor === 'undefined') {
    return true
  }

  // If has modified prototype
  const prot = ctor.prototype
  if (!hasObjectPrototype(prot)) {
    return false
  }

  // If constructor does not have an Object-specific method
  if (!prot.hasOwnProperty('isPrototypeOf')) {
    return false
  }

  // Most likely a plain Object
  return true
}

function hasObjectPrototype(o: any): boolean {
  return Object.prototype.toString.call(o) === '[object Object]'
}

/**
 * Checks if key `b` partially matches with key `a`.
 */
 export function partialMatchKey(a: QueryKey, b: QueryKey): boolean {
  return partialDeepEqual(ensureQueryKeyArray(a), ensureQueryKeyArray(b))
}

/**
 * Checks if `b` partially matches with `a`.
 */
 export function partialDeepEqual(a: any, b: any): boolean {
  if (a === b) {
    return true
  }

  if (typeof a !== typeof b) {
    return false
  }

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    return !Object.keys(b).some(key => !partialDeepEqual(a[key], b[key]))
  }

  return false
}

export function getAbortController(): AbortController | undefined {
  if (typeof AbortController === 'function') {
    return new AbortController()
  }
}
/**
 * 
 * @param updatedAt 更新时刻
 * @param staleTime 过期时间
 * @returns 距离过期所剩时间
 */
export function timeUntilStale(updatedAt: number, staleTime?: number): number {
  return Math.max(updatedAt + (staleTime || 0) - Date.now(), 0)
}

export function shouldFetchOnMount(
  query: Query<any, any, any, any>,
  options: QueryObserverOptions<any, any, any, any, any>
): boolean {
  return (
    shouldLoadOnMount(query, options) || shouldRefetchOnMount(query, options)
  )
}

function shouldLoadOnMount(
  query: Query<any, any, any, any>,
  options: QueryObserverOptions<any, any, any, any>
): boolean {
  return (
    options.enabled !== false &&
    !query.state.dataUpdatedAt &&
    !(query.state.status === 'error' && options.retryOnMount === false)
  )
}

function shouldRefetchOnMount(
  query: Query<any, any, any, any>,
  options: QueryObserverOptions<any, any, any, any>
): boolean {
  return (
    options.enabled !== false &&
    query.state.dataUpdatedAt > 0 &&
    (options.refetchOnMount === 'always' ||
      (options.refetchOnMount !== false && isStale(query, options)))
  )
}

export function isStale(
  query: Query<any, any, any, any>,
  options: QueryObserverOptions<any, any, any, any, any>
): boolean {
  return query.isStaleByTime(options.staleTime)
}

export function shouldFetchOptionally(
  query: Query<any, any, any, any>,
  prevQuery: Query<any, any, any, any>,
  options: QueryObserverOptions<any, any, any, any, any>,
  prevOptions: QueryObserverOptions<any, any, any, any, any>
): boolean {
  return (
    options.enabled !== false &&
    (query !== prevQuery || prevOptions.enabled === false) &&
    (
      // !options.suspense ||
      query.state.status !== 'error' ||
      prevOptions.enabled === false) &&
    isStale(query, options)
  )
}

 export function replaceEqualDeep<T>(a: unknown, b: T): T
 export function replaceEqualDeep(a: any, b: any): any {
   if (a === b) {
     return a
   }
 
   const array = Array.isArray(a) && Array.isArray(b)
 
   if (array || (isPlainObject(a) && isPlainObject(b))) {
     const aSize = array ? a.length : Object.keys(a).length
     const bItems = array ? b : Object.keys(b)
     const bSize = bItems.length
     const copy: any = array ? [] : {}
 
     let equalItems = 0
 
     for (let i = 0; i < bSize; i++) {
       const key = array ? i : bItems[i]
       copy[key] = replaceEqualDeep(a[key], b[key])
       if (copy[key] === a[key]) {
         equalItems++
       }
     }
 
     return aSize === bSize && equalItems === aSize ? a : copy
   }
 
   return b
 }

 /**
 * Shallow compare objects. Only works with objects that always have the same properties.
 */
export function shallowEqualObjects<T>(a: T, b: T): boolean {
  if ((a && !b) || (b && !a)) {
    return false
  }

  for (const key in a) {
    if (a[key] !== b[key]) {
      return false
    }
  }

  return true
}

export type DataUpdateFunction<TInput, TOutput> = (input: TInput) => TOutput

export function functionalUpdate<TInput, TOutput>(
  updater: Updater<TInput, TOutput>,
  input: TInput
): TOutput {
  return typeof updater === 'function'
    ? (updater as DataUpdateFunction<TInput, TOutput>)(input)
    : updater
}