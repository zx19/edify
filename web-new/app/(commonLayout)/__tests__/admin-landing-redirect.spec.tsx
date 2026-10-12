import type { ConsoleStateFixture } from '@/test/console/state-fixture'
import { renderWithConsoleQuery } from '@/test/console/query-data'
import { createWorkspaceStateModuleMock } from '@/test/console/state-fixture'
import { AdminLandingRedirect } from '../admin-landing-redirect'

// 可变 fixture:每个用例改 consoleState 即生效(provider 每次渲染重 seed)
let consoleState: ConsoleStateFixture = {}
vi.mock('@/context/workspace-state', () => createWorkspaceStateModuleMock(() => consoleState))

const mockReplace = vi.fn()
vi.mock('@/next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/next/navigation')>()
  return { ...actual, useRouter: () => ({ replace: mockReplace, push: vi.fn() }) }
})

// pending 用例:profile query 永不 settle 且不发真实 fetch(保真 queryKey,只换 queryFn)
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

describe('AdminLandingRedirect', () => {
  beforeEach(() => vi.clearAllMocks())

  it('redirects a workspace-less system admin to /admin', () => {
    consoleState = { currentWorkspace: { id: '' }, isLoadingCurrentWorkspace: false }
    renderWithConsoleQuery(<AdminLandingRedirect />, {
      accountProfile: { is_system_admin: true },
    })
    expect(mockReplace).toHaveBeenCalledWith('/admin')
  })

  it('does not redirect an admin who has a workspace', () => {
    consoleState = { currentWorkspace: { id: 't-1' }, isLoadingCurrentWorkspace: false }
    renderWithConsoleQuery(<AdminLandingRedirect />, {
      accountProfile: { is_system_admin: true },
    })
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('does not redirect a non-admin without workspace', () => {
    consoleState = { currentWorkspace: { id: '' }, isLoadingCurrentWorkspace: false }
    renderWithConsoleQuery(<AdminLandingRedirect />, {
      accountProfile: { is_system_admin: false },
    })
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('does not redirect while queries are still pending', () => {
    consoleState = { currentWorkspace: { id: '' }, isLoadingCurrentWorkspace: true }
    renderWithConsoleQuery(<AdminLandingRedirect />, { accountProfile: null })
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
