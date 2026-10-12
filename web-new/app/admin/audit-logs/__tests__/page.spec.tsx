import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithConsoleQuery } from '@/test/console/query-data'
import AdminAuditLogsPage from '../page'

// vi.hoisted:mock 工厂在模块图评估期运行,普通 const 尚未初始化
const { mockAuditQuery } = vi.hoisted(() => ({ mockAuditQuery: vi.fn() }))

vi.mock('react-i18next', async () => {
  const { createReactI18nextMock } = await import('@/test/i18n-mock')
  return createReactI18nextMock({
    'admin.audit.filterAction': 'Action',
    'admin.audit.filterActionAll': 'All actions',
    'admin.audit.filterWorkspace': 'Workspace',
    'admin.audit.filterWorkspaceAll': 'All workspaces',
    'admin.audit.filterActor': 'Actor ID',
    'admin.audit.filterActorPlaceholder': 'Account ID',
    'admin.audit.filterStart': 'Start date',
    'admin.audit.filterEnd': 'End date',
    'admin.audit.colTime': 'Time',
    'admin.audit.colActor': 'Actor',
    'admin.audit.colAction': 'Action',
    'admin.audit.colTarget': 'Target',
    'admin.audit.colDetail': 'Detail',
    'admin.audit.detailView': 'View',
    'admin.audit.empty': 'No audit logs yet',
    'admin.audit.actionWorkspaceCreate': 'Create workspace',
  })
})

vi.mock('@/service/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/service/client')>()
  // consoleQuery 是 oRPC proxy——展开会丢键,改用 Proxy 逐层拦截窄切片
  const adminOverride = new Proxy(actual.consoleQuery.admin, {
    get(target, prop, receiver) {
      if (prop === 'auditLogs') {
        return {
          get: {
            queryOptions: (opts?: { input?: { query?: Record<string, unknown> } }) => ({
              queryKey: ['admin', 'audit-logs', opts?.input?.query ?? {}],
              queryFn: mockAuditQuery,
            }),
          },
        }
      }
      if (prop === 'systemAdmins') {
        return {
          get: {
            queryOptions: () => ({
              queryKey: ['admin', 'system-admins'],
              queryFn: async () => ({
                data: [
                  {
                    id: 'a-root',
                    email: 'root@example.com',
                    name: 'Root Admin',
                    status: 'active',
                    pending: false,
                  },
                ],
              }),
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

describe('AdminAuditLogsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuditQuery.mockResolvedValue({
      data: [
        {
          id: 'log-1',
          action: 'workspace.create',
          actor_account_id: 'a-root',
          target_type: 'workspace',
          target_id: 't-1',
          workspace_id: 't-1',
          detail: '{"name":"Alpha Space"}',
          created_at: 1750000000,
        },
        {
          id: 'log-2',
          action: 'admin.grant_invite',
          actor_account_id: 'a-revoked',
          target_type: 'account',
          target_id: 'a-9',
          workspace_id: null,
          detail: null,
          created_at: 1750000100,
        },
      ],
      has_more: false,
      limit: 20,
      page: 1,
      total: 2,
    })
  })

  it('maps actor to admin name/email and workspace target to space name; falls back to id', async () => {
    renderWithConsoleQuery(<AdminAuditLogsPage />)
    expect(await screen.findByText('Root Admin')).toBeInTheDocument()
    expect(screen.getByText('root@example.com')).toBeInTheDocument()
    expect(screen.getByText('Alpha Space')).toBeInTheDocument()
    // 已撤销管理员不在名单 → 回退截断 ID
    expect(screen.getByText(/a-revoke/)).toBeInTheDocument()
  })

  it('expands detail JSON inline', async () => {
    const user = userEvent.setup()
    renderWithConsoleQuery(<AdminAuditLogsPage />)
    await screen.findByText('Root Admin')
    const detailButtons = screen.getAllByRole('button', { name: 'View' })
    expect(detailButtons.length).toBeGreaterThan(0)
    await user.click(detailButtons[0] as HTMLElement)
    expect(await screen.findByText(/"name": "Alpha Space"/)).toBeInTheDocument()
  })

  it('passes action filter into the query', async () => {
    const user = userEvent.setup()
    renderWithConsoleQuery(<AdminAuditLogsPage />)
    await screen.findByText('Root Admin')
    await user.click(screen.getByRole('combobox', { name: 'Action' }))
    await user.click(screen.getByRole('option', { name: 'Create workspace' }))
    await waitFor(() => {
      expect(mockAuditQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: expect.arrayContaining([
            'admin',
            'audit-logs',
            expect.objectContaining({ action: 'workspace.create' }),
          ]),
        }),
      )
    })
  })
})
