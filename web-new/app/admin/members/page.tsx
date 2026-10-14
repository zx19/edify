'use client'

import type { AdminMemberAggregateItemResponse } from '@dify/contracts/api/console/admin/types.gen'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@xsl/lomva-ui/cn'
import { IconButton } from '@xsl/lomva-ui/icon-button'
import { Pagination } from '@xsl/lomva-ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '@xsl/lomva-ui/select'
import { useDebounce } from 'ahooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Loading from '@/app/components/base/loading'
import { SearchInput } from '@/app/components/base/search-input'
import useTimestamp from '@/hooks/use-timestamp'
import { consoleQuery } from '@/service/client'

const PAGE_SIZE = 20
const BADGE_LIMIT = 3

function MembershipBadges({
  memberships,
}: {
  memberships: AdminMemberAggregateItemResponse['memberships']
}) {
  const shown = memberships.slice(0, BADGE_LIMIT)
  const rest = memberships.length - shown.length
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((m) => (
        <span
          key={m.workspace_id}
          className="inline-flex items-center rounded-md border border-divider-subtle px-1.5 py-0.5 text-xs text-text-secondary"
        >
          {`${m.workspace_name}·${m.role}`}
        </span>
      ))}
      {rest > 0 && (
        <span className="inline-flex items-center rounded-md bg-state-base-hover px-1.5 py-0.5 text-xs text-text-tertiary">
          +{rest}
        </span>
      )}
    </span>
  )
}

function MemberRow({ member }: { member: AdminMemberAggregateItemResponse }) {
  const { t } = useTranslation()
  const { formatTime } = useTimestamp()
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr className="border-b border-divider-regular" key={`${member.account_id}-main`}>
        <td className="w-10 px-3 py-2">
          <IconButton
            size="sm"
            variant="ghost"
            aria-label={t(expanded ? ($) => $.members.collapse : ($) => $.members.expand, {
              ns: 'admin',
            })}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            <span
              aria-hidden
              className={cn(
                'size-4',
                expanded ? 'i-ri-arrow-down-s-line' : 'i-ri-arrow-right-s-line',
              )}
            />
          </IconButton>
        </td>
        <td className="truncate px-3 py-2 font-medium text-text-primary">{member.name}</td>
        <td className="truncate px-3 py-2">{member.email}</td>
        <td className="px-3 py-2">
          <MembershipBadges memberships={member.memberships} />
        </td>
      </tr>
      {expanded && (
        <tr
          className="border-b border-divider-regular bg-background-default-subtle"
          key={`${member.account_id}-detail`}
        >
          <td />
          <td colSpan={3} className="px-3 py-2">
            <div className="flex flex-col gap-1.5 py-1">
              {member.memberships.map((m) => (
                <div
                  key={m.workspace_id}
                  className="flex items-center gap-3 text-xs text-text-secondary"
                >
                  <span className="min-w-0 truncate font-medium text-text-primary">
                    {m.workspace_name}
                  </span>
                  <span className="inline-flex items-center rounded-md border border-divider-subtle px-1.5 py-0.5">
                    {m.role}
                  </span>
                  <span className="text-text-tertiary">
                    {t(($) => $.members.joinedAt, { ns: 'admin' })}{' '}
                    {m.joined_at ? formatTime(Number(m.joined_at), 'YYYY-MM-DD HH:mm') : '—'}
                  </span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function AdminMembersPage() {
  const { t } = useTranslation()
  const [searchInput, setSearchInput] = useState('')
  const keyword = useDebounce(searchInput, { wait: 300 })
  const [workspaceId, setWorkspaceId] = useState<'all' | string>('all')
  const [page, setPage] = useState(1)

  const { data, isPending } = useQuery(
    consoleQuery.admin.members.get.queryOptions({
      input: {
        query: {
          ...(keyword ? { keyword } : {}),
          ...(workspaceId !== 'all' ? { workspace_id: workspaceId } : {}),
          page,
          limit: PAGE_SIZE,
        },
      },
    }),
  )
  const { data: workspacesData } = useQuery(
    consoleQuery.admin.workspaces.get.queryOptions({ input: { query: { page: 1, limit: 100 } } }),
  )

  const rows = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex h-full flex-col p-6">
      <div className="flex flex-wrap items-center gap-3 pb-4">
        <div className="w-64">
          <SearchInput
            value={searchInput}
            onValueChange={(value) => {
              setSearchInput(value)
              setPage(1)
            }}
            placeholder={t(($) => $.members.searchPlaceholder, { ns: 'admin' })}
          />
        </div>
        <Select
          value={workspaceId}
          onValueChange={(value) => {
            setWorkspaceId(value ?? 'all')
            setPage(1)
          }}
          items={[
            { value: 'all', label: t(($) => $.members.filterWorkspaceAll, { ns: 'admin' }) },
            ...(workspacesData?.data ?? []).map((ws) => ({ value: ws.id, label: ws.name })),
          ]}
        >
          <SelectTrigger
            aria-label={t(($) => $.members.filterWorkspace, { ns: 'admin' })}
            className="w-44"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <SelectItemText>
                {t(($) => $.members.filterWorkspaceAll, { ns: 'admin' })}
              </SelectItemText>
            </SelectItem>
            {(workspacesData?.data ?? []).map((ws) => (
              <SelectItem value={ws.id} key={ws.id}>
                <SelectItemText>{ws.name}</SelectItemText>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isPending && (
        <div className="flex grow items-center justify-center">
          <Loading />
        </div>
      )}
      {!isPending && rows.length === 0 && (
        <div className="flex grow items-center justify-center text-sm text-text-tertiary">
          {t(($) => $.members.empty, { ns: 'admin' })}
        </div>
      )}
      {!isPending && rows.length > 0 && (
        <div className="min-h-0 overflow-auto rounded-xl border border-divider-subtle">
          <table className="w-full table-fixed text-left system-sm-regular text-text-secondary">
            <thead className="sticky top-0 bg-components-panel-bg system-xs-semibold-uppercase text-text-tertiary">
              <tr className="border-b border-divider-regular">
                <th className="w-10 px-3 py-2" scope="col">
                  <span className="sr-only">{t(($) => $.members.expand, { ns: 'admin' })}</span>
                </th>
                <th className="w-48 px-3 py-2" scope="col">
                  {t(($) => $.members.colName, { ns: 'admin' })}
                </th>
                <th className="w-64 px-3 py-2" scope="col">
                  {t(($) => $.members.colEmail, { ns: 'admin' })}
                </th>
                <th className="px-3 py-2" scope="col">
                  {t(($) => $.members.colWorkspaces, { ns: 'admin' })}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((member) => (
                <MemberRow key={member.account_id} member={member} />
              ))}
            </tbody>
          </table>
        </div>
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
