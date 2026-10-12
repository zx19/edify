import { screen } from '@testing-library/react'
import { renderWithConsoleQuery } from '@/test/console/query-data'
import { AdminGuard } from '../admin-guard'

vi.mock('react-i18next', async () => {
  const { createReactI18nextMock } = await import('@/test/i18n-mock')
  return createReactI18nextMock({
    'admin.guard.forbiddenTitle': 'Access denied',
    'admin.guard.forbiddenDesc': 'Admins only.',
    'admin.guard.backHome': 'Back to home',
  })
})

// pending 用例需要 profile query 永不 settle 且不发真实 fetch
// (vitest.setup.ts 的 unexpected-fetch 守卫会判失败)——保留真 queryKey,替换 queryFn
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

// 隔离壳:守卫测试不渲染侧栏
vi.mock('../admin-shell', () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="admin-shell">{children}</div>
  ),
}))

vi.mock('@/next/link', () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode
    href: string
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

describe('AdminGuard', () => {
  it('shows loading while the profile query is pending', () => {
    renderWithConsoleQuery(
      <AdminGuard>
        <div>secret</div>
      </AdminGuard>,
      { accountProfile: null },
    )
    expect(screen.queryByTestId('admin-shell')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument() // Loading 组件 role="status"
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })

  it('renders 403 view for non-admin users', () => {
    renderWithConsoleQuery(
      <AdminGuard>
        <div>secret</div>
      </AdminGuard>,
      { accountProfile: { is_system_admin: false, name: 'Normal', email: 'n@example.com' } },
    )
    expect(screen.getByText('Access denied')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/')
    expect(screen.queryByTestId('admin-shell')).not.toBeInTheDocument()
  })

  it('renders the shell with children for system admins (workspace-less allowed)', () => {
    renderWithConsoleQuery(
      <AdminGuard>
        <div>secret</div>
      </AdminGuard>,
      {
        accountProfile: { is_system_admin: true, name: 'Root', email: 'root@example.com' },
        currentWorkspace: null,
      },
    )
    expect(screen.getByTestId('admin-shell')).toBeInTheDocument()
    expect(screen.getByText('secret')).toBeInTheDocument()
  })
})
