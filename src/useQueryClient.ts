import { getCurrentInstance, inject } from "vue";

import type { QueryClient } from "./core";
import { getClientKey } from "./utils";

export function useQueryClient(id = ""): QueryClient {
  const vm = getCurrentInstance()?.proxy

  if (!vm) {
    throw new Error(
      "Please invoke this hooks inside setup() function."
    )
  }

  const key = getClientKey(id)
  const queryClient = inject<QueryClient>(key)

  if (!queryClient) {
    throw new Error(
      "Now queryClient found in Vue context, use VueQueryPlugin to initialize queryClient."
    )
  }

  return queryClient;
}