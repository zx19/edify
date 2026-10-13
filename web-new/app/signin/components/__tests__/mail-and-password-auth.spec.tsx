import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithConsoleQuery } from '@/test/console/query-data'
import MailAndPasswordAuth from '../mail-and-password-auth'

// 3b S1:login 分支行为锁(行为已在位,本文件是缺口回填——三分支分工见
// docs/superpowers/specs/2026-10-12-3b-控制台地基-design.md;分支C 由
// admin-landing-redirect.spec + 后端 login 预检单测覆盖)

const { mockLogin, mockReplace, mockReplaceLoginRedirect, mockToastError } = vi.hoisted(() => ({
  mockLogin: vi.fn(),
  mockReplace: vi.fn(),
  mockReplaceLoginRedirect: vi.fn(),
  mockToastError: vi.fn(),
}))

vi.mock('@/service/common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/service/common')>()),
  login: mockLogin,
}))

vi.mock('@/utils/encryption', () => ({ encryptPassword: (p: string) => p }))
vi.mock('@/app/components/base/amplitude', () => ({ trackEvent: vi.fn() }))
vi.mock('@/service/webapp-auth', () => ({ setWebAppAccessToken: vi.fn() }))
vi.mock('@/utils/login-redirect.client', () => ({ replaceLoginRedirect: mockReplaceLoginRedirect }))
vi.mock('@/context/i18n', () => ({ useLocale: () => 'en-US' }))

vi.mock('@/next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/next/navigation')>()),
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@xsl/lomva-ui/toast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xsl/lomva-ui/toast')>()
  return { ...actual, toast: { ...actual.toast, error: mockToastError, success: vi.fn() } }
})

const typeAndSubmit = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByPlaceholderText('login.emailPlaceholder'), 'a@example.com')
  await user.type(screen.getByPlaceholderText('login.passwordPlaceholder'), 'Secret123!')
  await user.click(screen.getByRole('button', { name: 'login.signBtn' }))
}

describe('MailAndPasswordAuth login branches (3b)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('branch A (success): resets profile query and delegates landing to replaceLoginRedirect', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValue({ result: 'success' })
    const { queryClient } = renderWithConsoleQuery(
      <MailAndPasswordAuth isInvite={false} isEmailSetup />,
    )
    const resetSpy = vi.spyOn(queryClient, 'resetQueries')

    await typeAndSubmit(user)

    await waitFor(() => expect(mockReplaceLoginRedirect).toHaveBeenCalled())
    expect(resetSpy).toHaveBeenCalled()
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('branch B (result=fail, no-workspace account): toasts backend guidance, no session, no redirect', async () => {
    const user = userEvent.setup()
    const guidance =
      'workspace not found, please contact system admin to invite you to join in a workspace'
    mockLogin.mockResolvedValue({ result: 'fail', data: guidance })
    const { queryClient } = renderWithConsoleQuery(
      <MailAndPasswordAuth isInvite={false} isEmailSetup />,
    )
    const resetSpy = vi.spyOn(queryClient, 'resetQueries')

    await typeAndSubmit(user)

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(guidance))
    expect(resetSpy).not.toHaveBeenCalled()
    expect(mockReplaceLoginRedirect).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
