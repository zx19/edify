import type { CookieRewriteOptions } from './types'

const SECURE_COOKIE_PREFIX_PATTERN = /^__(Host|Secure)-/
const LOCAL_SCOPED_COOKIE_PREFIX = 'dev_proxy'
const SAME_SITE_NONE_PATTERN = /^samesite=none$/i
const COOKIE_PATH_PATTERN = /^path=/i
const COOKIE_DOMAIN_PATTERN = /^domain=/i
const COOKIE_SECURE_PATTERN = /^secure$/i
const COOKIE_PARTITIONED_PATTERN = /^partitioned$/i

const stripSecureCookiePrefix = (cookieName: string) =>
  cookieName.replace(SECURE_COOKIE_PREFIX_PATTERN, '')

const matchesCookieName = (cookieName: string, matcher: string | RegExp) =>
  typeof matcher === 'string' ? matcher === cookieName : matcher.test(cookieName)

const hashScope = (scope: string) => {
  let hash = 0x811c9dc5

  for (let index = 0; index < scope.length; index += 1) {
    hash ^= scope.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(36)
}

const shouldUseHostPrefix = (cookieName: string, options: CookieRewriteOptions) => {
  const normalizedCookieName = stripSecureCookiePrefix(cookieName)

  return (
    options.hostPrefixCookies?.some((matcher) =>
      matchesCookieName(normalizedCookieName, matcher),
    ) || false
  )
}

const toUpstreamCookieName = (cookieName: string, options: CookieRewriteOptions) => {
  if (cookieName.startsWith('__Host-')) return cookieName

  if (cookieName.startsWith('__Secure-')) return `__Host-${stripSecureCookiePrefix(cookieName)}`

  if (!shouldUseHostPrefix(cookieName, options)) return cookieName

  return `__Host-${cookieName}`
}

export const toLocalCookieName = (cookieName: string) => stripSecureCookiePrefix(cookieName)

export const resolveCookieRewriteLocalScopeKey = (
  options: CookieRewriteOptions,
  targetUrl: URL,
) => {
  if (options.localCookieScope === 'target-origin') return hashScope(targetUrl.origin)

  return undefined
}

export const toScopedLocalCookieName = (cookieName: string, localScopeKey: string) =>
  // 隔离名原样保留上游真实 cookie 名(含 __Host-/__Secure- 与否)——回译时无损奉还,
  // 不依赖协议猜测前缀:https 子路径上游(api token.py:子路径不用 __Host-)发的是普通名,
  // 回译也必须回普通名,否则上游读不到 → 401 死循环(2026-09-29 qa-xai 实证)
  `${LOCAL_SCOPED_COOKIE_PREFIX}_${localScopeKey}_${cookieName}`

const fromScopedLocalCookieName = (cookieName: string, localScopeKey: string) => {
  const scopedPrefix = `${LOCAL_SCOPED_COOKIE_PREFIX}_${localScopeKey}_`
  if (!cookieName.startsWith(scopedPrefix)) return undefined

  return cookieName.slice(scopedPrefix.length)
}

const isScopedLocalCookieName = (cookieName: string) =>
  cookieName.startsWith(`${LOCAL_SCOPED_COOKIE_PREFIX}_`)

const parseCookieHeader = (cookieHeader: string | undefined) => {
  if (!cookieHeader) return []

  return cookieHeader
    .split(/;\s*/)
    .filter(Boolean)
    .map((cookie) => {
      const separatorIndex = cookie.indexOf('=')
      if (separatorIndex === -1) return { name: cookie, value: undefined }

      return {
        name: cookie.slice(0, separatorIndex).trim(),
        value: cookie.slice(separatorIndex + 1),
      }
    })
}

export const getCookieHeaderValue = (cookieHeader: string | undefined, cookieName: string) => {
  const cookie = parseCookieHeader(cookieHeader).find((cookie) => cookie.name === cookieName)
  return cookie?.value
}

export const rewriteCookieHeaderForUpstream = (
  cookieHeader: string | undefined,
  options: CookieRewriteOptions & { useHostPrefix?: boolean; localScopeKey?: string },
) => {
  if (!cookieHeader) return cookieHeader

  const { useHostPrefix = true } = options

  return parseCookieHeader(cookieHeader)
    .map((cookie) => {
      if (cookie.value === undefined) return cookie.name

      const scopedCookieName = options.localScopeKey
        ? fromScopedLocalCookieName(cookie.name, options.localScopeKey)
        : undefined

      if (scopedCookieName) {
        // 无损奉还原名:scopedCookieName 即上游真实 cookie 名(隔离名保留了前缀信息),
        // 不再过 toUpstreamCookieName 的协议启发式——上游发什么名就还什么名
        return `${scopedCookieName}=${cookie.value}`
      }

      if (
        options.localScopeKey &&
        (isScopedLocalCookieName(cookie.name) || shouldUseHostPrefix(cookie.name, options))
      )
        return undefined

      const upstreamCookieName = useHostPrefix
        ? toUpstreamCookieName(cookie.name, options)
        : cookie.name

      return `${upstreamCookieName}=${cookie.value}`
    })
    .filter((cookie): cookie is string => Boolean(cookie))
    .join('; ')
}

const rewriteSetCookieValueForLocal = (
  setCookieValue: string,
  options?: CookieRewriteOptions & { localScopeKey?: string },
) => {
  const [rawCookiePair, ...rawAttributes] = setCookieValue.split(';')
  const separatorIndex = rawCookiePair!.indexOf('=')

  if (separatorIndex === -1) return setCookieValue

  const cookieName = rawCookiePair!.slice(0, separatorIndex).trim()
  const cookieValue = rawCookiePair!.slice(separatorIndex + 1)
  const localCookieName = toLocalCookieName(cookieName)
  const shouldScopeCookie = Boolean(
    options?.localScopeKey && shouldUseHostPrefix(cookieName, options),
  )
  const rewrittenCookieName = shouldScopeCookie
    ? toScopedLocalCookieName(cookieName, options!.localScopeKey!)
    : localCookieName
  const rewrittenAttributes = rawAttributes
    .map((attribute) => attribute.trim())
    .filter(
      (attribute) =>
        !COOKIE_DOMAIN_PATTERN.test(attribute) &&
        !COOKIE_SECURE_PATTERN.test(attribute) &&
        !COOKIE_PARTITIONED_PATTERN.test(attribute),
    )
    .map((attribute) => {
      if (SAME_SITE_NONE_PATTERN.test(attribute)) return 'SameSite=Lax'

      if (COOKIE_PATH_PATTERN.test(attribute)) return 'Path=/'

      return attribute
    })

  return [`${rewrittenCookieName}=${cookieValue}`, ...rewrittenAttributes].join('; ')
}

export const rewriteSetCookieHeadersForLocal = (
  setCookieHeaders: readonly string[],
  options?: CookieRewriteOptions & { localScopeKey?: string },
) => setCookieHeaders.map((cookie) => rewriteSetCookieValueForLocal(cookie, options))
