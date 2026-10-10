import type { AppDetailWithSite } from '@dify/contracts/api/console/apps/types.gen'
import { describe, expect, it } from 'vite-plus/test'
import { getAppSiteURL, toTrackWebAppURL } from '../support/api/web-apps'

const appDetail = (
  mode: AppDetailWithSite['mode'],
  site?: { app_base_url?: string; access_token?: string },
): AppDetailWithSite =>
  ({
    mode,
    site,
  }) as AppDetailWithSite

describe('getAppSiteURL', () => {
  it.each([
    ['chat', 'chat'],
    ['advanced-chat', 'chat'],
    ['agent-chat', 'chat'],
    ['completion', 'completion'],
    ['workflow', 'workflow'],
  ] as const)('maps %s apps to the /%s route', (mode, route) => {
    const detail = appDetail(mode, {
      app_base_url: 'http://localhost:3000',
      access_token: 'token123',
    })

    expect(getAppSiteURL(detail)).toBe(`http://localhost:3000/${route}/token123`)
  })

  it('rejects app details without a site URL', () => {
    expect(() => getAppSiteURL(appDetail('chat'))).toThrow(
      'App detail does not include a Web App URL.',
    )
    expect(() =>
      getAppSiteURL(appDetail('chat', { app_base_url: '', access_token: 'token123' })),
    ).toThrow('App detail does not include a Web App URL.')
  })

  it('rejects modes without a Web App route', () => {
    expect(() =>
      getAppSiteURL(
        appDetail('channel' as AppDetailWithSite['mode'], {
          app_base_url: 'http://localhost:3000',
          access_token: 'token123',
        }),
      ),
    ).toThrow('Unsupported Web App mode: channel')
  })
})

describe('toTrackWebAppURL', () => {
  it('re-roots the backend URL onto the old-track origin by default', () => {
    expect(toTrackWebAppURL('http://localhost:3000/chat/token123', 'http://127.0.0.1:3000')).toBe(
      'http://127.0.0.1:3000/chat/token123',
    )
  })

  it('re-roots the backend URL onto the new-track origin', () => {
    expect(toTrackWebAppURL('http://localhost:3000/chat/token123', 'http://127.0.0.1:3001')).toBe(
      'http://127.0.0.1:3001/chat/token123',
    )
  })

  it('preserves the path and query while replacing only the origin', () => {
    expect(
      toTrackWebAppURL('https://apps.example.com/chat/token123?view=full', 'http://127.0.0.1:3001'),
    ).toBe('http://127.0.0.1:3001/chat/token123?view=full')
  })
})
