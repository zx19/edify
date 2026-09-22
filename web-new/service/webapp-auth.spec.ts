import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { AccessMode } from '@/models/access-control'

const getPublicMock = vi.hoisted(() => vi.fn())

vi.mock('./base', () => ({
  getPublic: getPublicMock,
  postPublic: vi.fn(),
}))

const { getWebAppPassport, setWebAppPassport, webAppLoginStatus } = await import('./webapp-auth')

describe('webAppLoginStatus', () => {
  beforeEach(() => {
    getPublicMock.mockReset()
    getPublicMock.mockResolvedValue({ logged_in: true, app_logged_in: true })
    localStorage.clear()
  })

  it('keeps environment and ordinary passports for the same code separate', () => {
    const environment = { kind: 'environment' as const, code: 'workflow-app' }
    const ordinary = { kind: 'default' as const, code: 'workflow-app' }

    setWebAppPassport(environment, 'environment-passport')
    setWebAppPassport(ordinary, 'ordinary-passport')

    expect(getWebAppPassport(environment)).toBe('environment-passport')
    expect(getWebAppPassport(ordinary)).toBe('ordinary-passport')
  })

  it('keeps the ordinary webapp passport storage key unchanged', () => {
    const address = { kind: 'default' as const, code: 'workflow-app' }

    setWebAppPassport(address, 'passport')

    expect(localStorage.getItem('passport-workflow-app')).toBe('passport')
  })

  it('does not send an environment code to Dify login status', async () => {
    window.history.replaceState({}, '', '/env/workflow/workflow-app')

    await webAppLoginStatus('workflow-app', AccessMode.PUBLIC, 'user-1')

    expect(getPublicMock).toHaveBeenCalledWith('/login/status?user_id=user-1')
  })

  it('treats a public environment as logged in before its first passport', async () => {
    window.history.replaceState({}, '', '/env/workflow/workflow-app')
    getPublicMock.mockResolvedValue({ logged_in: false, app_logged_in: false })

    await expect(webAppLoginStatus('workflow-app', AccessMode.PUBLIC)).resolves.toEqual({
      userLoggedIn: true,
      appLoggedIn: false,
    })
  })

  it('trusts the remote login state for an sso verified environment', async () => {
    window.history.replaceState({}, '', '/env/workflow/workflow-app')
    getPublicMock.mockResolvedValue({ logged_in: true, app_logged_in: false })

    await expect(webAppLoginStatus('workflow-app', AccessMode.EXTERNAL_MEMBERS)).resolves.toEqual({
      userLoggedIn: true,
      appLoggedIn: false,
    })
  })

  it('requires a Dify login for a private environment', async () => {
    window.history.replaceState({}, '', '/env/workflow/workflow-app')
    getPublicMock.mockResolvedValue({ logged_in: false, app_logged_in: false })

    await expect(
      webAppLoginStatus('workflow-app', AccessMode.SPECIFIC_GROUPS_MEMBERS),
    ).resolves.toEqual({
      userLoggedIn: false,
      appLoggedIn: false,
    })
  })

  it('keeps the app code for ordinary webapps', async () => {
    window.history.replaceState({}, '', '/workflow/workflow-app')

    await webAppLoginStatus('workflow-app', AccessMode.PUBLIC)

    expect(getPublicMock).toHaveBeenCalledWith('/login/status?app_code=workflow-app')
  })
})

/** 测试用假 passport（payload 带 app_code 的 JWT 形态） */
const makePassport = (appCode: string) => {
  const b64url = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ app_code: appCode, app_id: 'app-id', end_user_id: 'u-1' })}.sig`
}

describe('getWebAppPassport 错配防护（2026-09-22 Safari对Chrome错案）', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('discards a passport whose app_code does not match the current address', () => {
    const address = { kind: 'default' as const, code: 'app-a' }
    setWebAppPassport(address, makePassport('app-b'))

    expect(getWebAppPassport(address)).toBe('')
    expect(localStorage.getItem('passport-app-a')).toBeNull()
  })

  it('keeps a passport whose app_code matches the current address', () => {
    const address = { kind: 'default' as const, code: 'app-a' }
    const token = makePassport('app-a')
    setWebAppPassport(address, token)

    expect(getWebAppPassport(address)).toBe(token)
  })

  it('keeps opaque legacy passports untouched（无 app_code 可判时不阻断）', () => {
    const address = { kind: 'default' as const, code: 'app-a' }
    setWebAppPassport(address, 'legacy-opaque-passport')

    expect(getWebAppPassport(address)).toBe('legacy-opaque-passport')
  })

  it('does not validate environment passports（结构未实证，暂不校验）', () => {
    const env = { kind: 'environment' as const, code: 'env-app' }
    const token = makePassport('some-other-app')
    setWebAppPassport(env, token)

    expect(getWebAppPassport(env)).toBe(token)
  })
})
