import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithConsoleQuery } from '@/test/console/query-data'
import { CreateWorkspaceDialog } from '../create-workspace-dialog'

// vi.hoisted:mock 工厂会在模块图评估期(toast ← service/base 传递链)就跑,普通 const 尚未初始化
const { mockCreate, mockToastSuccess } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockToastSuccess: vi.fn(),
}))

vi.mock('react-i18next', async () => {
  const { createReactI18nextMock } = await import('@/test/i18n-mock')
  return createReactI18nextMock({
    'admin.workspaces.createTitle': 'Create workspace',
    'admin.workspaces.createNameLabel': 'Workspace name',
    'admin.workspaces.createOwnerLabel': 'Owner email',
    'admin.workspaces.createHint': 'hint',
    'admin.workspaces.createSubmit': 'Create',
    'admin.workspaces.createCancel': 'Cancel',
    'admin.workspaces.createSuccess': 'Workspace created',
    'admin.workspaces.createFailed': 'Failed',
    'admin.workspaces.pendingTitle': 'Workspace created, pending owner activation',
    'admin.workspaces.pendingMailSent': 'Invitation email sent.',
    'admin.workspaces.inviteLinkLabel': 'Invite link',
    'admin.workspaces.copyLink': 'Copy link',
    'admin.workspaces.copied': 'Copied',
    'admin.workspaces.pendingDone': 'Done',
  })
})

vi.mock('@/service/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/service/client')>()
  // consoleQuery 是 oRPC proxy——展开会丢键,改用 Proxy 逐层拦截窄切片
  const workspacesOverride = new Proxy(actual.consoleQuery.admin.workspaces, {
    get(target, prop, receiver) {
      if (prop === 'post') return { mutationOptions: () => ({ mutationFn: mockCreate }) }
      return Reflect.get(target, prop, receiver)
    },
  })
  const adminOverride = new Proxy(actual.consoleQuery.admin, {
    get(target, prop, receiver) {
      if (prop === 'workspaces') return workspacesOverride
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

vi.mock('@xsl/lomva-ui/toast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xsl/lomva-ui/toast')>()
  return { ...actual, toast: { ...actual.toast, success: mockToastSuccess, error: vi.fn() } }
})

describe('CreateWorkspaceDialog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates directly for a registered owner: toast + close + invalidate', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    mockCreate.mockResolvedValue({
      id: 't-1',
      name: 'Beta',
      owner_pending: false,
      invite_url: null,
    })
    const { queryClient } = renderWithConsoleQuery(
      <CreateWorkspaceDialog open onOpenChange={onOpenChange} />,
    )
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    await user.type(screen.getByLabelText('Workspace name'), 'Beta')
    await user.type(screen.getByLabelText('Owner email'), 'bob@example.com')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        { body: { name: 'Beta', owner_email: 'bob@example.com' } },
        expect.anything(),
      )
    })
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled())
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled())
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows the invite link result state for a PENDING owner', async () => {
    const user = userEvent.setup()
    mockCreate.mockResolvedValue({
      id: 't-2',
      name: 'Gamma',
      owner_pending: true,
      invite_url: '/activate?token=abc',
    })
    renderWithConsoleQuery(<CreateWorkspaceDialog open onOpenChange={vi.fn()} />)

    await user.type(screen.getByLabelText('Workspace name'), 'Gamma')
    await user.type(screen.getByLabelText('Owner email'), 'new@example.com')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(
      await screen.findByText('Workspace created, pending owner activation'),
    ).toBeInTheDocument()
    expect(screen.getByText(/activate\?token=abc/)).toBeInTheDocument()
  })
})
