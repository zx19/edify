import type { ClientLink } from '@orpc/client'
import type { ContractRouterClient } from '@orpc/contract'
import type { JsonifiedClient } from '@orpc/openapi-client'
import { contract as webappContract } from '@dify/contracts/api/web/orpc.gen'
import { createORPCClient, onError } from '@orpc/client'
import { OpenAPILink } from '@orpc/openapi-client/fetch'
import { PASSPORT_HEADER_NAME, PUBLIC_API_PREFIX } from '@/config'
// oxlint-disable-next-line no-restricted-imports
import { request } from './base'
import { getBaseURL } from './client'
import { resolveWebAppAddress } from './webapp-address'
import { getWebAppPassport } from './webapp-auth'

/**
 * WebApp（share 路由族）数据层的 oRPC 契约 client（3a 地基）。
 *
 * 契约源 = @dify/contracts/api/web（生成聚合 router，/site /parameters /meta /webapp 等）。
 * transport 委托 base.ts request（isPublicAPI）：passport 注入、getWebAppPublicApiPath
 * 地址解析（env 形态）、401/webapp SSO 跳转等既有行为零漂移——与 console link 同款委托模式。
 *
 * 3a 范围：GET 无 body 形态（site/parameters/meta/access-mode）；POST body 透传与 SSE 留第 4 步扩展。
 */

type WebAppClientContext = {
  silent?: boolean
}

type WebAppClientLink = ClientLink<WebAppClientContext>

function createWebAppOpenAPILink(): WebAppClientLink {
  return new OpenAPILink<WebAppClientContext>(webappContract, {
    url: getBaseURL(PUBLIC_API_PREFIX),
    headers: () => {
      const passport = getWebAppPassport(resolveWebAppAddress())
      return passport ? { [PASSPORT_HEADER_NAME]: passport } : {}
    },
    fetch: async (input, _init, options) => {
      // 剥回契约相对路径交还 request：formatURL(isPublicAPI) 内部重做
      // PUBLIC_API_PREFIX 前缀 + getWebAppPublicApiPath 地址解析；query 串随路径透传
      const linkPathname = new URL(getBaseURL(PUBLIC_API_PREFIX)).pathname.replace(/\/$/, '')
      const inputURL = new URL(input.url)
      const path = inputURL.pathname.replace(linkPathname, '') + inputURL.search
      const hasBody = input.method !== 'GET' && input.method !== 'HEAD'
      return request(
        path,
        {
          headers: input.headers,
          method: input.method,
          body: hasBody ? await input.text() : undefined,
        },
        {
          isPublicAPI: true,
          fetchCompat: true,
          silent: options.context?.silent,
        },
      )
    },
    interceptors: [
      onError((error) => {
        console.error(error)
      }),
    ],
  })
}

export const webappClient: JsonifiedClient<
  ContractRouterClient<typeof webappContract, WebAppClientContext>
> = createORPCClient(createWebAppOpenAPILink())
