import { QueryClient } from "./core/queryClient";

import type { QueryClientConfig } from "./core/types/clientTypes";
import type { Plugin } from 'vue'

import { getClientKey } from "./utils";

export interface AdditionalClient {
  queryClient: QueryClient;
  queryClientKey: string;
}

interface ConfigOptions {
  queryClientConfig?: QueryClientConfig;
  queryClientKey?: string;
  additionalClients?: AdditionalClient[];
}

interface ClientOptions {
  queryClient?: QueryClient;
  queryClientKey?: string;
  additionalClients?: AdditionalClient[];
}

export type VueQueryPluginOptions = ConfigOptions | ClientOptions;

export const VueQueryPlugin: Plugin = {
  install: (app, options: VueQueryPluginOptions = {}) => {
    const clientKey = getClientKey(options.queryClientKey)
    
    let client: QueryClient

    if ("queryClient" in options && options.queryClient) {
      client = options.queryClient
    } else {
      const clientConfig = "queryClientConfig" in options ? options.queryClientConfig : undefined;
      client = new QueryClient(clientConfig)
    }

    // initialize QueryClient
    client.mount()

    const cleanup = () => {
      client.unmount()
      options.additionalClients?.forEach(additionalClient => {
        additionalClient.queryClient.unmount()
      })
    }
    // @ts-expect-error onUnmounted is not released yet
    if (app.onUnmounted) {
      // @ts-expect-error onUnmounted is not released yet
      app.onUnmounted(cleanup)
    } else {
      const originalUnmount = app.unmount
      app.unmount = () => {
        cleanup()
        originalUnmount()
      }
    }

    // Vue3 only
    app.provide(clientKey, client)

    options.additionalClients?.forEach(additionalClient => {
      const key = getClientKey(additionalClient.queryClientKey)
      additionalClient.queryClient.mount()
      app.provide(key, additionalClient.queryClient)
    })
  }
}