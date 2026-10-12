import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithConsoleQuery } from '@/test/console/query-data'
import AdminWorkspacesPage from '../page'

const mockListQuery = vi.fn()

vi.mock('react-i18next', async () => {
  const { createReactI18nextMock } = await import('@/test/i18n-mock')
  return createReactI18nextMock({
    'admin.workspaces.searchPlaceholder': 'Search workspaces',
    'admin.workspaces.statusAll': 'All statuses',
    'admin.workspaces.statusNormal': 'Normal',
    'admin.workspaces.statusArchive': 'Archived',
    'admin.workspaces.colName': 'Name',
    'admin.workspaces.colOwner': 'Owner',
    'admin.workspaces.colMemberCount': 'Members',
    'admin.workspaces.colStatus': 'Status',
    'admin.workspaces.colCreatedAt': 'Created at',
    'admin.workspaces.empty': 'No workspaces yet',
    'admin.workspaces.createButton': 'Create workspace',
    'common.pagination.previous': 'Previous',
    'common.pagination.next': 'Next',
    'common.pagination.perPage': 'Per page',
    'common.pagination.pageNumber': 'Page',
  })
})

vi.mock('@/service/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/service/client')>()
  // consoleQuery 是 oRPC proxy——展开会丢键,改用 Proxy 逐层拦截窄切片
  const workspacesOverride = new Proxy(actual.consoleQuery.admin.workspaces, {
    get(target, prop, receiver) {
      if (prop === 'get') {
        return {
          queryOptions: (opts?: { input?: { query?: Record<string, unknown> } }) => ({
            queryKey: ['admin', 'workspaces', opts?.input?.query ?? {}],
            queryFn: mockListQuery,
          }),
        }
      }
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

vi.mock('../_components/create-workspace-dialog', () => ({
  CreateWorkspaceDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-dialog" /> : null,
}))

describe('AdminWorkspacesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListQuery.mockResolvedValue({
      data: [
        {
          id: 't-1',
          name: 'Alpha Space',
          status: 'normal',
          created_at: 1750000000,
          member_count: 3,
          owner: { id: 'a-1', name: 'Alice', email: 'alice@example.com' },
        },
      ],
      has_more: false,
      limit: 20,
      page: 1,
      total: 1,
    })
  })

  it('renders rows with owner and status badge', async () => {
    renderWithConsoleQuery(<AdminWorkspacesPage />)
    expect(await screen.findByText('Alpha Space')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('Normal')).toBeInTheDocument()
  })

  it('passes debounced keyword into the query', async () => {
    const user = userEvent.setup()
    renderWithConsoleQuery(<AdminWorkspacesPage />)
    await screen.findByText('Alpha Space')
    await user.type(screen.getByPlaceholderText('Search workspaces'), 'beta')
    await waitFor(() => {
      expect(mockListQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: expect.arrayContaining([
            'admin',
            'workspaces',
            expect.objectContaining({ keyword: 'beta' }),
          ]),
        }),
      )
    })
  }, 10000)

  it('passes status filter into the query', async () => {
    const user = userEvent.setup()
    renderWithConsoleQuery(<AdminWorkspacesPage />)
    await screen.findByText('Alpha Space')
    await user.click(screen.getByRole('combobox', { name: 'All statuses' }))
    await user.click(screen.getByRole('option', { name: 'Archived' }))
    await waitFor(() => {
      expect(mockListQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: expect.arrayContaining([
            'admin',
            'workspaces',
            expect.objectContaining({ status: 'archive' }),
          ]),
        }),
      )
    })
  })

  it('opens the create dialog from the toolbar button', async () => {
    const user = userEvent.setup()
    renderWithConsoleQuery(<AdminWorkspacesPage />)
    await screen.findByText('Alpha Space')
    await user.click(screen.getByRole('button', { name: 'Create workspace' }))
    expect(screen.getByTestId('create-dialog')).toBeInTheDocument()
  })
})
