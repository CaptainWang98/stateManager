import type { QueryKey, QueryObserverOptions } from "./core";
import type { Ref } from "vue";

export type MaybeRef<T> = Ref<T> | T;

export type WithQueryClientKey<T> = T & { queryClientKey?: string };

export type VueQueryObserverOptions<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
> = {
  [Property in keyof QueryObserverOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >]: MaybeRef<
    QueryObserverOptions<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey
    >[Property]
  >;
};