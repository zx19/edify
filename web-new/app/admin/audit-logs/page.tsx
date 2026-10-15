'use client'

import { useQuery } from '@tanstack/react-query'
import { Input } from '@xsl/lomva-ui/input'
import { Pagination } from '@xsl/lomva-ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '@xsl/lomva-ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@xsl/lomva-ui/table'
import { useDebounce } from 'ahooks'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Loading from '@/app/components/base/loading'
import useTimestamp from '@/hooks/use-timestamp'
import { consoleQuery } from '@/service/client'
import { AuditDetailCell } from './_components/audit-detail-cell'

const PAGE_SIZE = 20

const ACTION_VALUES = [
  'workspace.create',
  'workspace.archive',
  'workspace.unarchive',
  'admin.grant_invite',
  'admin.revoke',
  'admin.transfer',
] as const

type ActionValue = (typeof ACTION_VALUES)[number]

export default function AdminAuditLogsPage() {
  const { t } = useTranslation()
  const { formatTime } = useTimestamp()
  const [action, setAction] = useState<'all' | ActionValue>('all')
  const [workspaceId, setWorkspaceId] = useState<'all' | string>('all')
  const [actorInput, setActorInput] = useState('')
  const actor = useDebounce(actorInput, { wait: 300 })
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)

  const { data, isPending } = useQuery(
    consoleQuery.admin.auditLogs.get.queryOptions({
      input: {
        query: {
          ...(action !== 'all' ? { action } : {}),
          ...(workspaceId !== 'all' ? { workspace_id: workspaceId } : {}),
          ...(actor ? { actor } : {}),
          ...(startDate
            ? { start: Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000) }
            : {}),
          ...(endDate
            ? { end: Math.floor(new Date(`${endDate}T23:59:59Z`).getTime() / 1000) }
            : {}),
          page,
          limit: PAGE_SIZE,
        },
      },
    }),
  )

  // D6 名称映射:系统管理员名单(极小,一页拉全)+ 空间列表(过滤选项与目标列共用)
  const { data: adminsData } = useQuery(consoleQuery.admin.systemAdmins.get.queryOptions({}))
  const { data: workspacesData } = useQuery(
    consoleQuery.admin.workspaces.get.queryOptions({ input: { query: { page: 1, limit: 100 } } }),
  )

  const actorMap = useMemo(
    () => new Map((adminsData?.data ?? []).map((a) => [a.id, a])),
    [adminsData],
  )
  const workspaceMap = useMemo(
    () => new Map((workspacesData?.data ?? []).map((w) => [w.id, w.name])),
    [workspacesData],
  )

  const actionLabel = (value: string): string => {
    switch (value) {
      case 'workspace.create':
        return t(($) => $.audit.actionWorkspaceCreate, { ns: 'admin' })
      case 'workspace.archive':
        return t(($) => $.audit.actionWorkspaceArchive, { ns: 'admin' })
      case 'workspace.unarchive':
        return t(($) => $.audit.actionWorkspaceUnarchive, { ns: 'admin' })
      case 'admin.grant_invite':
        return t(($) => $.audit.actionAdminGrantInvite, { ns: 'admin' })
      case 'admin.revoke':
        return t(($) => $.audit.actionAdminRevoke, { ns: 'admin' })
      case 'admin.transfer':
        return t(($) => $.audit.actionAdminTransfer, { ns: 'admin' })
      default:
        return value
    }
  }

  const rows = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex h-full flex-col p-6">
      <div className="flex flex-wrap items-center gap-3 pb-4">
        <Select
          value={action}
          onValueChange={(value) => {
            setAction(value as 'all' | ActionValue)
            setPage(1)
          }}
          items={[
            { value: 'all', label: t(($) => $.audit.filterActionAll, { ns: 'admin' }) },
            ...ACTION_VALUES.map((value) => ({ value, label: actionLabel(value) })),
          ]}
        >
          <SelectTrigger
            aria-label={t(($) => $.audit.filterAction, { ns: 'admin' })}
            className="w-44"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <SelectItemText>{t(($) => $.audit.filterActionAll, { ns: 'admin' })}</SelectItemText>
            </SelectItem>
            {ACTION_VALUES.map((value) => (
              <SelectItem value={value} key={value}>
                <SelectItemText>{actionLabel(value)}</SelectItemText>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={workspaceId}
          onValueChange={(value) => {
            setWorkspaceId(value ?? 'all')
            setPage(1)
          }}
          items={[
            { value: 'all', label: t(($) => $.audit.filterWorkspaceAll, { ns: 'admin' }) },
            ...(workspacesData?.data ?? []).map((ws) => ({ value: ws.id, label: ws.name })),
          ]}
        >
          <SelectTrigger
            aria-label={t(($) => $.audit.filterWorkspace, { ns: 'admin' })}
            className="w-44"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <SelectItemText>
                {t(($) => $.audit.filterWorkspaceAll, { ns: 'admin' })}
              </SelectItemText>
            </SelectItem>
            {(workspacesData?.data ?? []).map((ws) => (
              <SelectItem value={ws.id} key={ws.id}>
                <SelectItemText>{ws.name}</SelectItemText>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="w-40">
          <Input
            value={actorInput}
            onChange={(event) => {
              setActorInput(event.target.value)
              setPage(1)
            }}
            placeholder={t(($) => $.audit.filterActorPlaceholder, { ns: 'admin' })}
            aria-label={t(($) => $.audit.filterActor, { ns: 'admin' })}
          />
        </div>
        <Input
          type="date"
          value={startDate}
          onChange={(event) => {
            setStartDate(event.target.value)
            setPage(1)
          }}
          aria-label={t(($) => $.audit.filterStart, { ns: 'admin' })}
          className="w-40"
        />
        <Input
          type="date"
          value={endDate}
          onChange={(event) => {
            setEndDate(event.target.value)
            setPage(1)
          }}
          aria-label={t(($) => $.audit.filterEnd, { ns: 'admin' })}
          className="w-40"
        />
      </div>

      {isPending && (
        <div className="flex grow items-center justify-center">
          <Loading />
        </div>
      )}
      {!isPending && rows.length === 0 && (
        <div className="flex grow items-center justify-center text-sm text-text-tertiary">
          {t(($) => $.audit.empty, { ns: 'admin' })}
        </div>
      )}
      {!isPending && rows.length > 0 && (
        <Table>
          <TableHeader sticky>
            <TableRow>
              <TableHead className="w-44 px-6">
                {t(($) => $.audit.colTime, { ns: 'admin' })}
              </TableHead>
              <TableHead className="w-52">{t(($) => $.audit.colActor, { ns: 'admin' })}</TableHead>
              <TableHead className="w-36">{t(($) => $.audit.colAction, { ns: 'admin' })}</TableHead>
              <TableHead>{t(($) => $.audit.colTarget, { ns: 'admin' })}</TableHead>
              <TableHead className="w-56 px-6">
                {t(($) => $.audit.colDetail, { ns: 'admin' })}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((log) => {
              const admin = actorMap.get(log.actor_account_id)
              const targetName = log.workspace_id ? workspaceMap.get(log.workspace_id) : undefined
              return (
                <TableRow className="align-top" key={log.id}>
                  <TableCell className="truncate px-6">
                    {log.created_at ? formatTime(Number(log.created_at), 'YYYY-MM-DD HH:mm') : '—'}
                  </TableCell>
                  <TableCell className="truncate">
                    {admin ? (
                      <span className="flex flex-col">
                        <span className="truncate text-text-primary">{admin.name}</span>
                        <span className="truncate text-xs text-text-tertiary">{admin.email}</span>
                      </span>
                    ) : (
                      <span className="font-mono text-xs">{log.actor_account_id.slice(0, 12)}</span>
                    )}
                  </TableCell>
                  <TableCell className="truncate">{actionLabel(log.action)}</TableCell>
                  <TableCell className="truncate">
                    {targetName ??
                      (log.target_id
                        ? `${log.target_type ?? ''}:${log.target_id.slice(0, 12)}`
                        : '—')}
                  </TableCell>
                  <TableCell className="px-6">
                    <AuditDetailCell detail={log.detail} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      {total > PAGE_SIZE && (
        <div className="flex justify-end pt-3">
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            labels={{
              previous: t(($) => $['pagination.previous'], { ns: 'common' }),
              next: t(($) => $['pagination.next'], { ns: 'common' }),
              editPageNumber: (p, tp) =>
                t(($) => $['pagination.editPageNumber'], { ns: 'common', page: p, totalPages: tp }),
              pageNumberInput: t(($) => $['pagination.pageNumber'], { ns: 'common' }),
            }}
          />
        </div>
      )}
    </div>
  )
}
