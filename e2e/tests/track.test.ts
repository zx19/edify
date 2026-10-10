import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  currentWebTrack,
  defaultBaseURLForTrack,
  resolveWebTrack,
  selectForTrack,
  trackSelector,
} from '../support/track'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('resolveWebTrack', () => {
  it('defaults to the old track when no value is provided', () => {
    expect(resolveWebTrack(undefined)).toBe('old')
    expect(resolveWebTrack('')).toBe('old')
  })

  it.each(['old', 'new'] as const)('accepts %s', (track) => {
    expect(resolveWebTrack(track)).toBe(track)
  })

  it('rejects unsupported tracks', () => {
    expect(() => resolveWebTrack('future')).toThrow('Unsupported E2E web track "future".')
  })
})

describe('currentWebTrack', () => {
  it('reads E2E_WEB_TRACK first', () => {
    vi.stubEnv('E2E_WEB_TRACK', 'new')
    vi.stubEnv('E2E_TRACK', 'old')

    expect(currentWebTrack()).toBe('new')
  })

  it('accepts E2E_TRACK as an alias', () => {
    vi.stubEnv('E2E_TRACK', 'new')

    expect(currentWebTrack()).toBe('new')
  })

  it('defaults to old when neither variable is set', () => {
    vi.stubEnv('E2E_WEB_TRACK', '')
    vi.stubEnv('E2E_TRACK', '')

    expect(currentWebTrack()).toBe('old')
  })
})

describe('defaultBaseURLForTrack', () => {
  it('maps the old track to port 3000 and the new track to port 3001', () => {
    expect(defaultBaseURLForTrack('old')).toBe('http://127.0.0.1:3000')
    expect(defaultBaseURLForTrack('new')).toBe('http://127.0.0.1:3001')
  })
})

describe('track selectors', () => {
  it('selectForTrack picks the value for the given track', () => {
    expect(selectForTrack('old', 'old-selector', 'new-selector')).toBe('old-selector')
    expect(selectForTrack('new', 'old-selector', 'new-selector')).toBe('new-selector')
  })

  it('trackSelector resolves the current track from the environment', () => {
    vi.stubEnv('E2E_WEB_TRACK', 'new')

    expect(trackSelector('old-selector', 'new-selector')).toBe('new-selector')
  })

  it('trackSelector falls back to the old selector by default', () => {
    vi.stubEnv('E2E_WEB_TRACK', '')
    vi.stubEnv('E2E_TRACK', '')

    expect(trackSelector('old-selector', 'new-selector')).toBe('old-selector')
  })
})
