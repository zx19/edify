'use client'

import { useQuery } from '@tanstack/react-query'
import { Button } from '@xsl/lomva-ui/button'
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
import { StatusBadge } from '../_components/status-badge'
import { CreateWorkspaceDialog } from './_components/create-workspace-dialog'

const PAGE_SIZE = 20

export default function AdminWorkspacesPage() {
  const { t } = useTranslation()
  const { formatTime } = useTimestamp()
  const [searchInput, setSearchInput] = useState('')
  const keyword = useDebounce(searchInput, { wait: 300 })
  const [status, setStatus] = useState<'all' | 'normal' | 'archive'>('all')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)

  const { data, isPending } = useQuery(
    consoleQuery.admin.workspaces.get.queryOptions({
      input: {
        query: {
          ...(keyword ? { keyword } : {}),
          ...(status !== 'all' ? { status } : {}),
          page,
          limit: PAGE_SIZE,
        },
      },
    }),
  )

  const rows = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex h-full flex-col p-6">
      <div className="flex items-center gap-3 pb-4">
        <div className="w-64">
          <SearchInput
            value={searchInput}
            onValueChange={(value) => {
              setSearchInput(value)
              setPage(1)
            }}
            placeholder={t(($) => $.workspaces.searchPlaceholder, { ns: 'admin' })}
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as 'all' | 'normal' | 'archive')
            setPage(1)
          }}
          items={[
            { value: 'all', label: t(($) => $.workspaces.statusAll, { ns: 'admin' }) },
            { value: 'normal', label: t(($) => $.workspaces.statusNormal, { ns: 'admin' }) },
            { value: 'archive', label: t(($) => $.workspaces.statusArchive, { ns: 'admin' }) },
          ]}
        >
          <SelectTrigger
            aria-label={t(($) => $.workspaces.statusAll, { ns: 'admin' })}
            className="w-40"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <SelectItemText>{t(($) => $.workspaces.statusAll, { ns: 'admin' })}</SelectItemText>
            </SelectItem>
            <SelectItem value="normal">
              <SelectItemText>
                {t(($) => $.workspaces.statusNormal, { ns: 'admin' })}
              </SelectItemText>
            </SelectItem>
            <SelectItem value="archive">
              <SelectItemText>
                {t(($) => $.workspaces.statusArchive, { ns: 'admin' })}
              </SelectItemText>
            </SelectItem>
          </SelectContent>
        </Select>
        <div className="grow" />
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          {t(($) => $.workspaces.createButton, { ns: 'admin' })}
        </Button>
      </div>

      {isPending && (
        <div className="flex grow items-center justify-center">
          <Loading />
        </div>
      )}
      {!isPending && rows.length === 0 && (
        <div className="flex grow items-center justify-center text-sm text-text-tertiary">
          {t(($) => $.workspaces.empty, { ns: 'admin' })}
        </div>
      )}
      {!isPending && rows.length > 0 && (
        <div className="min-h-0 overflow-auto rounded-xl border border-divider-subtle">
          <table className="w-full table-fixed text-left system-sm-regular text-text-secondary">
            <thead className="sticky top-0 bg-components-panel-bg system-xs-semibold-uppercase text-text-tertiary">
              <tr className="border-b border-divider-regular">
                <th className="px-6 py-2" scope="col">
                  {t(($) => $.workspaces.colName, { ns: 'admin' })}
                </th>
                <th className="w-56 px-3 py-2" scope="col">
                  {t(($) => $.workspaces.colOwner, { ns: 'admin' })}
                </th>
                <th className="w-24 px-3 py-2" scope="col">
                  {t(($) => $.workspaces.colMemberCount, { ns: 'admin' })}
                </th>
                <th className="w-28 px-3 py-2" scope="col">
                  {t(($) => $.workspaces.colStatus, { ns: 'admin' })}
                </th>
                <th className="w-44 px-6 py-2" scope="col">
                  {t(($) => $.workspaces.colCreatedAt, { ns: 'admin' })}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((ws) => (
                <tr className="border-b border-divider-regular last:border-b-0" key={ws.id}>
                  <td className="truncate px-6 py-2 font-medium text-text-primary">{ws.name}</td>
                  <td className="truncate px-3 py-2">
                    {ws.owner ? (
                      <span className="flex flex-col">
                        <span className="truncate text-text-primary">{ws.owner.name}</span>
                        <span className="truncate text-xs text-text-tertiary">
                          {ws.owner.email}
                        </span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2">{ws.member_count ?? 0}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={ws.status} />
                  </td>
                  <td className="truncate px-6 py-2">
                    {ws.created_at ? formatTime(Number(ws.created_at), 'YYYY-MM-DD HH:mm') : '—'}
                  </td>
                </tr>
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

      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
