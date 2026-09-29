/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vite-plus/test'
import {
  getCookieHeaderValue,
  rewriteCookieHeaderForUpstream,
  rewriteSetCookieHeadersForLocal,
  toScopedLocalCookieName,
} from './cookies'

describe('dev proxy cookies', () => {
  // Scenario: cookie names should only receive secure host prefixes when configured.
  it('should rewrite configured cookie names for HTTPS upstream requests', () => {
    // Act
    const cookieHeader = rewriteCookieHeaderForUpstream(
      'access_token=abc; theme=dark; passport-app=def',
      {
        hostPrefixCookies: ['access_token', /^passport-/],
        useHostPrefix: true,
      },
    )

    // Assert
    expect(cookieHeader).toBe('__Host-access_token=abc; theme=dark; __Host-passport-app=def')
  })

  // Scenario: HTTP upstreams should keep local cookie names even when rewrite config exists.
  it('should keep local cookie names for HTTP upstream requests', () => {
    // Act
    const cookieHeader = rewriteCookieHeaderForUpstream('access_token=abc; refresh_token=def', {
      hostPrefixCookies: ['access_token', 'refresh_token'],
      useHostPrefix: false,
    })

    // Assert
    expect(cookieHeader).toBe('access_token=abc; refresh_token=def')
  })

  // Scenario: upstream set-cookie headers should be converted into localhost-safe cookies.
  it('should rewrite upstream set-cookie headers for local development', () => {
    // Act
    const cookies = rewriteSetCookieHeadersForLocal([
      '__Host-access_token=abc; Path=/console/api; Domain=cloud.example.com; Secure; SameSite=None; Partitioned',
    ])

    // Assert
    expect(cookies).toEqual(['access_token=abc; Path=/; SameSite=Lax'])
  })

  // Scenario: target-scoped cookies should isolate authentication state between upstream targets.
  it('should only forward auth cookies from the active local scope', () => {
    // Arrange
    const activeAccessTokenName = toScopedLocalCookieName('access_token', 'active')
    const otherAccessTokenName = toScopedLocalCookieName('access_token', 'other')

    // Act
    const cookieHeader = rewriteCookieHeaderForUpstream(
      [
        `${activeAccessTokenName}=active-token`,
        'access_token=legacy-token',
        `${otherAccessTokenName}=other-token`,
        'theme=dark',
      ].join('; '),
      {
        hostPrefixCookies: ['access_token'],
        localScopeKey: 'active',
        useHostPrefix: true,
      },
    )

    // Assert:scoped 名保留上游原名,回译原样奉还——上游是普通名就回普通名(qa-xai https 子路径场景),
    // 不再按协议加 __Host- 前缀(此前会回 __Host-access_token 致上游读不到 → 401)
    expect(cookieHeader).toBe('access_token=active-token; theme=dark')
  })

  // Scenario: scoped cookies preserve the __Host- prefix for root-deployed HTTPS upstreams (round-trip).
  it('should forward scoped cookies with their original __Host- prefix to HTTPS root upstreams', () => {
    // Arrange
    const scopedAccessTokenName = toScopedLocalCookieName('__Host-access_token', 'cloud')

    // Act
    const cookieHeader = rewriteCookieHeaderForUpstream(
      `${scopedAccessTokenName}=active-token; theme=dark`,
      {
        hostPrefixCookies: ['access_token'],
        localScopeKey: 'cloud',
        useHostPrefix: true,
      },
    )

    // Assert:__Host- 上游(根路径)原名带前缀,回译无损保留
    expect(cookieHeader).toBe('__Host-access_token=active-token; theme=dark')
  })

  // Scenario: upstream auth set-cookie headers should be stored under scoped local names (原名含前缀).
  it('should rewrite upstream set-cookie headers into target-scoped local cookies', () => {
    // Arrange:__Host- 上游的隔离名保留其 __Host- 前缀(无损往返的基础)
    const scopedAccessTokenName = toScopedLocalCookieName('__Host-access_token', 'cloud')

    // Act
    const cookies = rewriteSetCookieHeadersForLocal(
      [
        '__Host-access_token=abc; Path=/console/api; Domain=cloud.example.com; Secure; SameSite=None; Partitioned',
      ],
      {
        hostPrefixCookies: ['access_token'],
        localScopeKey: 'cloud',
      },
    )

    // Assert
    expect(cookies).toEqual([`${scopedAccessTokenName}=abc; Path=/; SameSite=Lax`])
  })

  // Scenario: request header helpers should read scoped CSRF cookies without exposing scope logic to callers.
  it('should read scoped cookie values from cookie headers', () => {
    // Arrange
    const scopedCsrfCookieName = toScopedLocalCookieName('csrf_token', 'cloud')

    // Act
    const csrfToken = getCookieHeaderValue(
      `${scopedCsrfCookieName}=csrf; csrf_token=legacy`,
      scopedCsrfCookieName,
    )

    // Assert
    expect(csrfToken).toBe('csrf')
  })
})
