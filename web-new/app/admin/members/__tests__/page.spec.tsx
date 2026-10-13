import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithConsoleQuery } from '@/test/console/query-data'
import AdminMembersPage from '../page'

// vi.hoisted:mock 工厂在模块图评估期运行,普通 const 尚未初始化
const { mockMembersQuery } = vi.hoisted(() => ({ mockMembersQuery: vi.fn() }))

vi.mock('react-i18next', async () => {
  const { createReactI18nextMock } = await import('@/test/i18n-mock')
  return createReactI18nextMock({
    'admin.members.searchPlaceholder': 'Search name/email',
    'admin.members.filterWorkspace': 'Workspace',
    'admin.members.filterWorkspaceAll': 'All workspaces',
    'admin.members.colName': 'Name',
    'admin.members.colEmail': 'Email',
    'admin.members.colWorkspaces': 'Workspaces',
    'admin.members.expand': 'Expand',
    'admin.members.collapse': 'Collapse',
    'admin.members.joinedAt': 'Joined at',
    'admin.members.empty': 'No members yet',
  })
})

vi.mock('@/service/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/service/client')>()
  // consoleQuery 是 oRPC proxy——展开会丢键,改用 Proxy 逐层拦截窄切片
  const adminOverride = new Proxy(actual.consoleQuery.admin, {
    get(target, prop, receiver) {
      if (prop === 'members') {
        return {
          get: {
            queryOptions: (opts?: { input?: { query?: Record<string, unknown> } }) => ({
              queryKey: ['admin', 'members', opts?.input?.query ?? {}],
              queryFn: mockMembersQuery,
            }),
          },
        }
      }
      if (prop === 'workspaces') {
        return new Proxy(target.workspaces, {
          get(wsTarget, wsProp, wsReceiver) {
            if (wsProp === 'get') {
              return {
                queryOptions: (opts?: { input?: { query?: Record<string, unknown> } }) => ({
                  queryKey: ['admin', 'workspaces', opts?.input?.query ?? {}],
                  queryFn: async () => ({
                    data: [{ id: 't-1', name: 'Alpha Space', status: 'normal' }],
                    has_more: false,
                    limit: 100,
                    page: 1,
                    total: 1,
                  }),
                }),
              }
            }
            return Reflect.get(wsTarget, wsProp, wsReceiver)
          },
        })
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

const memberWithManySpaces = {
  account_id: 'a-1',
  name: 'Alice',
  email: 'alice@example.com',
  memberships: [
    { workspace_id: 't-1', workspace_name: 'Alpha Space', role: 'owner', joined_at: 1750000000 },
    { workspace_id: 't-2', workspace_name: 'Beta Space', role: 'editor', joined_at: 1750000100 },
    { workspace_id: 't-3', workspace_name: 'Gamma Space', role: 'normal', joined_at: 1750000200 },
    { workspace_id: 't-4', workspace_name: 'Delta Space', role: 'normal', joined_at: 1750000300 },
  ],
}

describe('AdminMembersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMembersQuery.mockResolvedValue({
      data: [
        memberWithManySpaces,
        {
          account_id: 'a-2',
          name: 'Bob',
          email: 'bob@example.com',
          memberships: [
            {
              workspace_id: 't-1',
              workspace_name: 'Alpha Space',
              role: 'editor',
              joined_at: 1750000000,
            },
          ],
        },
      ],
      has_more: false,
      limit: 20,
      page: 1,
      total: 2,
    })
  })

  it('renders aggregate rows; badge group collapses beyond 3 with +N', async () => {
    renderWithConsoleQuery(<AdminMembersPage />)
    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    // 前 3 个空间徽标直出,第 4 个折叠为 +1
    expect(screen.getByText(/Alpha Space·owner/)).toBeInTheDocument()
    expect(screen.getByText(/Gamma Space·normal/)).toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()
    expect(screen.queryByText(/Delta Space·normal/)).not.toBeInTheDocument()
  })

  it('expands a row to reveal the full membership list', async () => {
    const user = userEvent.setup()
    renderWithConsoleQuery(<AdminMembersPage />)
    await screen.findByText('Alice')
    await user.click(screen.getAllByRole('button', { name: 'Expand' })[0] as HTMLElement)
    // 折叠态之外的 Delta 在展开区出现
    expect(await screen.findByText('Delta Space')).toBeInTheDocument()
    expect(screen.getAllByText(/Delta Space/).length).toBeGreaterThan(0)
  })

  it('passes keyword and workspace filter into the query', async () => {
    const user = userEvent.setup()
    renderWithConsoleQuery(<AdminMembersPage />)
    await screen.findByText('Alice')
    await user.type(screen.getByPlaceholderText('Search name/email'), 'ali')
    await waitFor(() => {
      expect(mockMembersQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: expect.arrayContaining([
            'admin',
            'members',
            expect.objectContaining({ keyword: 'ali' }),
          ]),
        }),
      )
    })
    await user.click(screen.getByRole('combobox', { name: 'Workspace' }))
    await user.click(screen.getByRole('option', { name: 'Alpha Space' }))
    await waitFor(() => {
      expect(mockMembersQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: expect.arrayContaining([
            'admin',
            'members',
            expect.objectContaining({ workspace_id: 't-1' }),
          ]),
        }),
      )
    })
  }, 10000)
})
