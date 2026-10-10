import type { AppDetailWithSite } from '@dify/contracts/api/console/apps/types.gen'
import { baseURL } from '../../test-env'

export function getAppSiteURL({ mode, site }: AppDetailWithSite): string {
  if (!site?.app_base_url || !site.access_token)
    throw new Error('App detail does not include a Web App URL.')

  const webAppMode = (() => {
    if (mode === 'completion' || mode === 'workflow') return mode
    if (mode === 'advanced-chat' || mode === 'agent-chat' || mode === 'chat') return 'chat'
    throw new Error(`Unsupported Web App mode: ${mode}`)
  })()

  return `${site.app_base_url}/${webAppMode}/${site.access_token}`
}

/**
 * Rewrites a backend-issued Web App URL onto the active track origin. The
 * backend derives `site.app_base_url` from `APP_WEB_URL` (the old-track
 * frontend), so dual-track runs must re-root the URL: the old track serves
 * `web/` on :3000 while the new track serves `web-new/` on :3001 against the
 * same backend. Defaults to the e2e `baseURL`, which already resolves
 * `E2E_BASE_URL` or the per-track default.
 */
export function toTrackWebAppURL(siteURL: string, trackBaseURL: string = baseURL): string {
  const url = new URL(siteURL)
  const track = new URL(trackBaseURL)
  url.protocol = track.protocol
  url.host = track.host

  return url.toString()
}
