// oxlint-disable-next-line no-restricted-imports
import { request } from './base'
import { getWebAppPassport } from './webapp-auth'

vi.mock('./base', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./base')>()
  // 拒绝而非假 Response：断言点是 request 调用参数（路径/isPublicAPI/头），
  // 假 Response 会进入 oRPC 解码管线被 zod schema 拒，干扰断言目标
  return { ...actual, request: vi.fn().mockRejectedValue(new Error('stop-at-transport')) }
})
vi.mock('./webapp-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./webapp-auth')>()
  return { ...actual, getWebAppPassport: vi.fn().mockReturnValue('test-passport') }
})
vi.mock('./webapp-address', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./webapp-address')>()
  return { ...actual, resolveWebAppAddress: vi.fn().mockReturnValue(null) }
})

const mockRequest = vi.mocked(request)
const mockGetPassport = vi.mocked(getWebAppPassport)

describe('webappClient', () => {
  beforeEach(() => vi.clearAllMocks())

  it('site.get 走 base request 且 isPublicAPI', async () => {
    const { webappClient } = await import('./webapp-client')
    await expect(webappClient.site.get({})).rejects.toThrow('stop-at-transport')
    expect(mockRequest).toHaveBeenCalledTimes(1)
    const [url, , otherOptions] = mockRequest.mock.calls[0]!
    expect(url).toMatch(/\/site$/)
    expect(otherOptions).toMatchObject({ isPublicAPI: true })
  })

  it('有 passport 时注入 X-App-Passport 头', async () => {
    const { webappClient } = await import('./webapp-client')
    await expect(webappClient.site.get({})).rejects.toThrow('stop-at-transport')
    expect(mockGetPassport).toHaveBeenCalled()
    const [, options] = mockRequest.mock.calls[0]!
    const headers = new Headers((options as RequestInit)?.headers)
    expect(headers.get('X-App-Passport')).toBe('test-passport')
  })
})
