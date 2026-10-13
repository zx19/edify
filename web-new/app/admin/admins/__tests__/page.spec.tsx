import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithConsoleQuery } from '@/test/console/query-data'
import AdminAdminsPage from '../page'

// vi.hoisted:mock 工厂在模块图评估期运行,普通 const 尚未初始化
const { mockList, mockGrant, mockRevoke, mockTransfer, mockToastSuccess } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockGrant: vi.fn(),
  mockRevoke: vi.fn(),
  mockTransfer: vi.fn(),
  mockToastSuccess: vi.fn(),
}))

vi.mock('react-i18next', async () => {
  const { createReactI18nextMock } = await import('@/test/i18n-mock')
  return createReactI18nextMock({
    'admin.admins.title': 'System Admins',
    'admin.admins.grantButton': 'Grant admin',
    'admin.admins.transferButton': 'Transfer founder',
    'admin.admins.colName': 'Name',
    'admin.admins.colEmail': 'Email',
    'admin.admins.colSource': 'Source',
    'admin.admins.colStatus': 'Status',
    'admin.admins.colGrantedAt': 'Granted at',
    'admin.admins.colActions': 'Actions',
    'admin.admins.sourceInstall': 'Install',
    'admin.admins.sourceEnv': 'Env',
    'admin.admins.sourceInvite': 'Invited',
    'admin.admins.sourceGrant': 'Granted',
    'admin.admins.statusActive': 'Active',
    'admin.admins.statusPending': 'Pending',
    'admin.admins.revoke': 'Revoke',
    'admin.admins.revokeTitle': 'Revoke system admin',
    'admin.admins.revokeDesc': 'The account will lose system admin privileges.',
    'admin.admins.revokeEnvHint': 'From env config',
    'admin.admins.grantTitle': 'Grant system admin',
    'admin.admins.grantEmailLabel': 'Email',
    'admin.admins.grantSuccess': 'Granted',
    'admin.admins.grantFailed': 'Failed',
    'admin.admins.grantPendingTitle': 'Invitation created',
    'admin.admins.grantPendingMailSent': 'Invitation email sent.',
    'admin.admins.transferTitle': 'Transfer founder',
    'admin.admins.transferDesc': 'You become a normal admin after transfer.',
    'admin.admins.transferTargetLabel': 'Transfer to',
    'admin.admins.transferSuccess': 'Transferred',
    'admin.admins.empty': 'No admins',
    'admin.admins.passwordLabel': 'Current password',
    'admin.admins.passwordPlaceholder': 'Enter password to confirm',
    'admin.admins.confirm': 'Confirm',
    'admin.admins.cancel': 'Cancel',
    'admin.admins.copyLink': 'Copy link',
    'admin.admins.copied': 'Copied',
    'admin.admins.done': 'Done',
    'admin.admins.inviteLinkLabel': 'Invite link',
  })
})

vi.mock('@/service/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/service/client')>()
  // consoleQuery 是 oRPC proxy——展开会丢键,改用 Proxy 逐层拦截窄切片
  const systemAdminsOverride = {
    get: {
      queryOptions: () => ({ queryKey: ['admin', 'system-admins'], queryFn: mockList }),
      // invalidate 用 key():透传真实现(oRPC 链路无网络)
      key: () => actual.consoleQuery.admin.systemAdmins.get.key(),
    },
    post: { mutationOptions: () => ({ mutationFn: mockGrant }) },
    byAccountId: {
      delete: { mutationOptions: () => ({ mutationFn: mockRevoke }) },
    },
    transfer: {
      post: { mutationOptions: () => ({ mutationFn: mockTransfer }) },
    },
  }
  const adminOverride = new Proxy(actual.consoleQuery.admin, {
    get(target, prop, receiver) {
      if (prop === 'systemAdmins') return systemAdminsOverride
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

// 转让成功会 invalidate profile → active query 触发真 refetch(unexpected-fetch 守卫会判失败);
// 保留真 queryKey,queryFn 换为永不 resolve(seed 数据照常可读,refetch 空转)
vi.mock('@/features/account-profile/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/account-profile/client')>()
  return {
    ...actual,
    userProfileQueryOptions: () => ({
      ...actual.userProfileQueryOptions(),
      queryFn: () => new Promise(() => {}),
    }),
  }
})

const adminsFixture = [
  {
    id: 'a-root',
    email: 'root@x.com',
    name: 'Root',
    status: 'active',
    source: 'install',
    pending: false,
    created_at: 1750000000,
  },
  {
    id: 'a-env',
    email: 'env@x.com',
    name: 'EnvOps',
    status: 'active',
    source: 'env',
    pending: false,
    created_at: 1750000100,
  },
  {
    id: 'a-op',
    email: 'op@x.com',
    name: 'Operator',
    status: 'active',
    source: 'grant',
    pending: false,
    created_at: 1750000200,
  },
  {
    id: 'a-inv',
    email: 'inv@x.com',
    name: 'Pam',
    status: 'pending',
    source: 'invite',
    pending: true,
    created_at: 1750000300,
  },
]

const founderProfile = {
  accountProfile: {
    is_system_admin: true,
    system_admin_source: 'install',
    name: 'Root',
    email: 'root@x.com',
  },
}
const normalAdminProfile = {
  accountProfile: {
    is_system_admin: true,
    system_admin_source: 'grant',
    name: 'Op',
    email: 'op@x.com',
  },
}

describe('AdminAdminsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockList.mockResolvedValue({ data: adminsFixture })
  })

  it('founder sees grant/transfer actions; revoke hidden on founder row and disabled on env row', async () => {
    renderWithConsoleQuery(<AdminAdminsPage />, founderProfile)
    expect(await screen.findByText('Root')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Grant admin' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Transfer founder' })).toBeInTheDocument()

    // 创始人行无撤销(不可自撤)
    const founderRow = screen.getByText('Root').closest('tr') as HTMLElement
    expect(founderRow.querySelector('button')).toBeNull()
    // env 来源行撤销禁用
    const envRow = screen.getByText('EnvOps').closest('tr') as HTMLElement
    const envRevoke = envRow.querySelector('button') as HTMLButtonElement
    expect(envRevoke).toBeDisabled()
    // pending 行可撤销(作废邀请)
    const pendingRow = screen.getByText('Pam').closest('tr') as HTMLElement
    expect(pendingRow.querySelector('button')).not.toBeDisabled()
  })

  it('normal admin sees a read-only page (no action buttons at all)', async () => {
    renderWithConsoleQuery(<AdminAdminsPage />, normalAdminProfile)
    expect(await screen.findByText('Root')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Grant admin' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Transfer founder' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument()
  })

  it('grant: registered email → toast + invalidate + close', async () => {
    const user = userEvent.setup()
    mockGrant.mockResolvedValue({
      id: 'a-new',
      email: 'new@x.com',
      name: 'New',
      status: 'active',
      source: 'invite',
      pending: false,
      invite_url: null,
    })
    const { queryClient } = renderWithConsoleQuery(<AdminAdminsPage />, founderProfile)
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    await user.click(await screen.findByRole('button', { name: 'Grant admin' }))
    await user.type(await screen.findByLabelText('Email'), 'new@x.com')
    await user.type(screen.getByLabelText('Current password'), 'pw')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(mockGrant).toHaveBeenCalledWith(
        { body: { email: 'new@x.com', current_password: 'pw' } },
        expect.anything(),
      )
    })
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled())
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled())
  })

  it('grant: unregistered email → PENDING result shows invite link', async () => {
    const user = userEvent.setup()
    mockGrant.mockResolvedValue({
      id: 'a-p',
      email: 'p@x.com',
      name: 'p',
      status: 'pending',
      source: 'invite',
      pending: true,
      invite_url: '/activate?token=xyz',
    })
    renderWithConsoleQuery(<AdminAdminsPage />, founderProfile)

    await user.click(await screen.findByRole('button', { name: 'Grant admin' }))
    await user.type(await screen.findByLabelText('Email'), 'p@x.com')
    await user.type(screen.getByLabelText('Current password'), 'pw')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByText('Invitation created')).toBeInTheDocument()
    expect(screen.getByText(/activate\?token=xyz/)).toBeInTheDocument()
  })

  it('revoke: pending invite row → password confirm → delete with account_id', async () => {
    const user = userEvent.setup()
    mockRevoke.mockResolvedValue({ result: 'success' })
    const { queryClient } = renderWithConsoleQuery(<AdminAdminsPage />, founderProfile)
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const pendingRow = (await screen.findByText('Pam')).closest('tr') as HTMLElement
    await user.click(pendingRow.querySelector('button') as HTMLElement)
    await user.type(await screen.findByLabelText('Current password'), 'pw')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(mockRevoke).toHaveBeenCalledWith(
        { params: { account_id: 'a-inv' }, body: { current_password: 'pw' } },
        expect.anything(),
      )
    })
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled())
  })

  it('transfer: pick target + password → transfer → invalidate admins and profile', async () => {
    const user = userEvent.setup()
    mockTransfer.mockResolvedValue({ result: 'success' })
    const { queryClient } = renderWithConsoleQuery(<AdminAdminsPage />, founderProfile)
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    await user.click(await screen.findByRole('button', { name: 'Transfer founder' }))
    await user.click(await screen.findByRole('combobox', { name: 'Transfer to' }))
    await user.click(screen.getByRole('option', { name: /Operator/ }))
    await user.type(screen.getByLabelText('Current password'), 'pw')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(mockTransfer).toHaveBeenCalledWith(
        { body: { account_id: 'a-op', current_password: 'pw' } },
        expect.anything(),
      )
    })
    await waitFor(() => {
      const keys = invalidateSpy.mock.calls.map((call) => JSON.stringify(call[0]?.queryKey))
      // oRPC key 为驼峰路径(['console','admin','systemAdmins','get'] 形态)
      expect(keys.some((k) => k.includes('systemAdmins'))).toBe(true)
      expect(keys.some((k) => k.includes('profile'))).toBe(true)
    })
  })
})
