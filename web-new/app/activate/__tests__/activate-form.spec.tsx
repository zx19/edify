import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithConsoleQuery } from '@/test/console/query-data'
import ActivateForm from '../activateForm'

// vi.hoisted:mock 工厂在模块图评估期运行,普通 const 尚未初始化
const { mockMemberCheck, mockAdminCheck, mockActivate, mockReplace } = vi.hoisted(() => ({
  mockMemberCheck: vi.fn(),
  mockAdminCheck: vi.fn(),
  mockActivate: vi.fn(),
  mockReplace: vi.fn(),
}))

vi.mock('react-i18next', async () => {
  const { createReactI18nextMock } = await import('@/test/i18n-mock')
  return createReactI18nextMock({
    'login.invalid': 'Invalid link',
    'login.setYourAccount': 'Set your account',
    'login.explore': 'Explore',
    'admin.activate.title': 'Activate system admin account',
    'admin.activate.nameLabel': 'Name',
    'admin.activate.namePlaceholder': 'Enter your name',
    'admin.activate.passwordLabel': 'Password',
    'admin.activate.passwordPlaceholder': 'Set a login password',
    'admin.activate.confirmLabel': 'Confirm password',
    'admin.activate.confirmPlaceholder': 'Enter the password again',
    'admin.activate.passwordMismatch': 'Passwords do not match',
    'admin.activate.submit': 'Activate',
    'admin.activate.success': 'Account activated. Please sign in.',
    'admin.activate.failed': 'Activation failed.',
  })
})

vi.mock('@/next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/next/navigation')>()
  return {
    ...actual,
    useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
    useSearchParams: () => new URLSearchParams('token=tok-1'),
  }
})

vi.mock('@/service/use-common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/service/use-common')>()
  return {
    ...actual,
    useInvitationCheck: (params?: unknown, enabled?: boolean) => mockMemberCheck(params, enabled),
  }
})

vi.mock('@/service/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/service/client')>()
  // consoleQuery 是 oRPC proxy——展开会丢键,改用 Proxy 逐层拦截窄切片
  const adminOverride = new Proxy(actual.consoleQuery.admin, {
    get(target, prop, receiver) {
      if (prop === 'activation') {
        return {
          check: {
            get: {
              queryOptions: (opts?: { enabled?: boolean }) => ({
                queryKey: ['admin', 'activation-check'],
                queryFn: mockAdminCheck,
                enabled: opts?.enabled ?? true,
              }),
            },
          },
          post: { mutationOptions: () => ({ mutationFn: mockActivate }) },
        }
      }
      return Reflect.get(target, prop, receiver)
    },
  })
  return {
    ...actual,
    consoleQuery: new Proxy(actual.consoleQuery, {
      get(target, prop, receiver) {
        if (prop === 'admin') return adminOverride
        return Reflect.get(target, prop, receiver)
      },
    }),
  }
})

describe('ActivateForm dual-namespace seam', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminCheck.mockResolvedValue({ is_valid: false, email: null })
  })

  it('member-valid: redirects to /signin exactly as before, admin check never fires', async () => {
    mockMemberCheck.mockReturnValue({
      data: {
        is_valid: true,
        data: { email: 'm@example.com', workspace_id: 't-1' },
        result: 'success',
      },
    })
    renderWithConsoleQuery(<ActivateForm />)
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('/signin')),
    )
    expect(mockAdminCheck).not.toHaveBeenCalled()
  })

  it('member-invalid + admin-valid: renders admin activation form and posts activation', async () => {
    const user = userEvent.setup()
    mockMemberCheck.mockReturnValue({ data: { is_valid: false, result: 'fail' } })
    mockAdminCheck.mockResolvedValue({ is_valid: true, email: 'admin@example.com' })
    mockActivate.mockResolvedValue({ result: 'success' })

    renderWithConsoleQuery(<ActivateForm />)
    expect(await screen.findByText('Activate system admin account')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Name'), 'New Admin')
    await user.type(screen.getByLabelText('Password'), 'Secret123!')
    await user.type(screen.getByLabelText('Confirm password'), 'Secret123!')
    await user.click(screen.getByRole('button', { name: 'Activate' }))

    await waitFor(() => {
      expect(mockActivate).toHaveBeenCalledWith(
        {
          body: expect.objectContaining({
            token: 'tok-1',
            name: 'New Admin',
            password: 'Secret123!',
          }),
        },
        expect.anything(),
      )
    })
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/signin'))
  })

  it('both invalid: shows the existing invalid view, no admin form', async () => {
    mockMemberCheck.mockReturnValue({ data: { is_valid: false, result: 'fail' } })
    renderWithConsoleQuery(<ActivateForm />)
    expect(await screen.findByText('Invalid link')).toBeInTheDocument()
    expect(screen.queryByText('Activate system admin account')).not.toBeInTheDocument()
  })
})
