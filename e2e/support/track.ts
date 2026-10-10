/**
 * Dual-track selection for E2E runs: the old track serves `web/` on :3000 and
 * the new track serves `web-new/` on :3001 against the same backend.
 *
 * `E2E_WEB_TRACK=old|new` selects the track. `E2E_TRACK` is accepted as an
 * alias for older references; `E2E_WEB_TRACK` wins when both are set. The
 * default track is `old`. Step definitions use `trackSelector` to fork
 * selectors between tracks while feature files stay shared.
 */
export const supportedWebTracks = ['old', 'new'] as const
export type E2EWebTrack = (typeof supportedWebTracks)[number]

export const oldTrackBaseURL = 'http://127.0.0.1:3000'
export const newTrackBaseURL = 'http://127.0.0.1:3001'

export const resolveWebTrack = (value: string | undefined): E2EWebTrack => {
  if (value === undefined || value.trim() === '') return 'old'

  const normalized = value.trim()
  if ((supportedWebTracks as readonly string[]).includes(normalized))
    return normalized as E2EWebTrack

  throw new Error(
    `Unsupported E2E web track "${value}". Expected one of: ${supportedWebTracks.join(', ')}.`,
  )
}

export const currentWebTrack = (env: NodeJS.ProcessEnv = process.env): E2EWebTrack =>
  resolveWebTrack(env.E2E_WEB_TRACK ?? env.E2E_TRACK)

export const defaultBaseURLForTrack = (track: E2EWebTrack): string =>
  track === 'new' ? newTrackBaseURL : oldTrackBaseURL

export const selectForTrack = <T>(track: E2EWebTrack, oldValue: T, newValue: T): T =>
  track === 'new' ? newValue : oldValue

export const trackSelector = <T>(oldSelector: T, newSelector: T): T =>
  selectForTrack(currentWebTrack(), oldSelector, newSelector)
