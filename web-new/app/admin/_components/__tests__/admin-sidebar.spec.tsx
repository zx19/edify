import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithConsoleQuery } from '@/test/console/query-data'
import { AdminSidebar } from '../admin-sidebar'

const mockReplace = vi.fn()
const mockLogout = vi.fn()

vi.mock('react-i18next', async () => {
  const { createReactI18nextMock } = await import('@/test/i18n-mock')
  return createReactI18nextMock({
    'admin.nav.title': 'System Administration',
    'admin.nav.workspaces': 'Workspaces',
    'admin.nav.members': 'Members',
    'admin.nav.admins': 'System Admins',
    'admin.nav.auditLogs': 'Audit Logs',
    'common.userProfile.logout': 'Log out',
  })
})

vi.mock('@/next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/next/navigation')>()
  return {
    ...actual,
    usePathname: () => '/admin/workspaces',
    useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  }
})

vi.mock('@/next/link', () => ({
  default: ({
    children,
    href,
    className,
    'aria-current': ariaCurrent,
  }: {
    children: React.ReactNode
    href: string
    className?: string
    'aria-current'?: 'page' | undefined
  }) => (
    <a href={href} className={className} aria-current={ariaCurrent}>
      {children}
    </a>
  ),
}))

vi.mock('@/service/use-common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/service/use-common')>()
  return { ...actual, useLogout: () => ({ mutateAsync: mockLogout, isPending: false }) }
})

describe('AdminSidebar', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders four first-level nav items and highlights the current route', () => {
    renderWithConsoleQuery(<AdminSidebar />, {
      accountProfile: { is_system_admin: true, name: 'Root Admin', email: 'root@example.com' },
    })
    const workspaces = screen.getByRole('link', { name: 'Workspaces' })
    const members = screen.getByRole('link', { name: 'Members' })
    const admins = screen.getByRole('link', { name: 'System Admins' })
    const auditLogs = screen.getByRole('link', { name: 'Audit Logs' })
    expect(workspaces).toHaveAttribute('href', '/admin/workspaces')
    expect(members).toHaveAttribute('href', '/admin/members')
    expect(admins).toHaveAttribute('href', '/admin/admins')
    expect(auditLogs).toHaveAttribute('href', '/admin/audit-logs')
    expect(workspaces).toHaveAttribute('aria-current', 'page')
    expect(members).not.toHaveAttribute('aria-current')
    expect(admins).not.toHaveAttribute('aria-current')
    expect(auditLogs).not.toHaveAttribute('aria-current')
  })

  it('calls logout then redirects to /signin from the account row', async () => {
    const user = userEvent.setup()
    renderWithConsoleQuery(<AdminSidebar />, {
      accountProfile: { is_system_admin: true, name: 'Root Admin', email: 'root@example.com' },
    })
    await user.click(screen.getByRole('button', { name: 'Log out' }))
    expect(mockLogout).toHaveBeenCalled()
    expect(mockReplace).toHaveBeenCalledWith('/signin')
  })
})
