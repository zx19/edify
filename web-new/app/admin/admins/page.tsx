'use client'

import type { AdminSystemAdminItemResponse } from '@dify/contracts/api/console/admin/types.gen'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@xsl/lomva-ui/button'
import { cn } from '@xsl/lomva-ui/cn'
import { toast } from '@xsl/lomva-ui/toast'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Loading from '@/app/components/base/loading'
import { userProfileQueryOptions } from '@/features/account-profile/client'
import useTimestamp from '@/hooks/use-timestamp'
import { consoleQuery } from '@/service/client'
import { GrantAdminDialog } from './_components/grant-admin-dialog'
import { PasswordConfirmDialog } from './_components/password-confirm-dialog'
import { TransferAdminDialog } from './_components/transfer-admin-dialog'

function SourceBadge({ source }: { source?: string | null }) {
  const { t } = useTranslation()
  const label = (() => {
    switch (source) {
      case 'install':
        return t(($) => $.admins.sourceInstall, { ns: 'admin' })
      case 'env':
        return t(($) => $.admins.sourceEnv, { ns: 'admin' })
      case 'invite':
        return t(($) => $.admins.sourceInvite, { ns: 'admin' })
      case 'grant':
        return t(($) => $.admins.sourceGrant, { ns: 'admin' })
      default:
        return source ?? '—'
    }
  })()
  return (
    <span className="inline-flex items-center rounded-md border border-divider-subtle px-1.5 py-0.5 text-xs text-text-secondary">
      {label}
    </span>
  )
}

function AdminStatusBadge({ pending }: { pending: boolean }) {
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border border-divider-subtle px-1.5 py-0.5 text-xs font-medium',
        pending ? 'text-text-warning' : 'text-text-success',
      )}
    >
      {pending
        ? t(($) => $.admins.statusPending, { ns: 'admin' })
        : t(($) => $.admins.statusActive, { ns: 'admin' })}
    </span>
  )
}

export default function AdminAdminsPage() {
  const { t } = useTranslation()
  const { formatTime } = useTimestamp()
  const queryClient = useQueryClient()
  const { data: profileData } = useQuery(userProfileQueryOptions())
  // 创始人(/install 激活,source=install)独占授予/撤销/转让;普通管理员全页只读
  const isFounder = profileData?.profile.system_admin_source === 'install'

  const { data, isPending } = useQuery(consoleQuery.admin.systemAdmins.get.queryOptions({}))
  const admins = data?.data ?? []

  const [grantOpen, setGrantOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<AdminSystemAdminItemResponse | null>(null)

  const revokeMutation = useMutation({
    ...consoleQuery.admin.systemAdmins.byAccountId.delete.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: consoleQuery.admin.systemAdmins.get.key(),
      })
      toast.success(t(($) => $.admins.revokeSuccess, { ns: 'admin' }))
      setRevokeTarget(null)
    },
    onError: () => {
      toast.error(t(($) => $.admins.revokeFailed, { ns: 'admin' }))
    },
  })

  const transferCandidates = admins.filter((a) => a.source !== 'install' && !a.pending)

  return (
    <div className="flex h-full flex-col p-6">
      <div className="flex items-center gap-3 pb-4">
        <h1 className="text-base font-semibold text-text-primary">
          {t(($) => $.admins.title, { ns: 'admin' })}
        </h1>
        <div className="grow" />
        {isFounder && (
          <>
            <Button variant="secondary" onClick={() => setTransferOpen(true)}>
              {t(($) => $.admins.transferButton, { ns: 'admin' })}
            </Button>
            <Button variant="primary" onClick={() => setGrantOpen(true)}>
              {t(($) => $.admins.grantButton, { ns: 'admin' })}
            </Button>
          </>
        )}
      </div>

      {isPending && (
        <div className="flex grow items-center justify-center">
          <Loading />
        </div>
      )}
      {!isPending && admins.length === 0 && (
        <div className="flex grow items-center justify-center text-sm text-text-tertiary">
          {t(($) => $.admins.empty, { ns: 'admin' })}
        </div>
      )}
      {!isPending && admins.length > 0 && (
        <div className="min-h-0 overflow-auto rounded-xl border border-divider-subtle">
          <table className="w-full table-fixed text-left system-sm-regular text-text-secondary">
            <thead className="sticky top-0 bg-components-panel-bg system-xs-semibold-uppercase text-text-tertiary">
              <tr className="border-b border-divider-regular">
                <th className="px-6 py-2" scope="col">
                  {t(($) => $.admins.colName, { ns: 'admin' })}
                </th>
                <th className="w-64 px-3 py-2" scope="col">
                  {t(($) => $.admins.colEmail, { ns: 'admin' })}
                </th>
                <th className="w-32 px-3 py-2" scope="col">
                  {t(($) => $.admins.colSource, { ns: 'admin' })}
                </th>
                <th className="w-28 px-3 py-2" scope="col">
                  {t(($) => $.admins.colStatus, { ns: 'admin' })}
                </th>
                <th className="w-44 px-3 py-2" scope="col">
                  {t(($) => $.admins.colGrantedAt, { ns: 'admin' })}
                </th>
                {isFounder && (
                  <th className="w-24 px-6 py-2" scope="col">
                    {t(($) => $.admins.colActions, { ns: 'admin' })}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => {
                const isFounderRow = admin.source === 'install'
                const isEnvRow = admin.source === 'env'
                return (
                  <tr className="border-b border-divider-regular last:border-b-0" key={admin.id}>
                    <td className="truncate px-6 py-2 font-medium text-text-primary">
                      {admin.name}
                    </td>
                    <td className="truncate px-3 py-2">{admin.email}</td>
                    <td className="px-3 py-2">
                      <SourceBadge source={admin.source} />
                    </td>
                    <td className="px-3 py-2">
                      <AdminStatusBadge pending={admin.pending} />
                    </td>
                    <td className="truncate px-3 py-2">
                      {admin.created_at
                        ? formatTime(Number(admin.created_at), 'YYYY-MM-DD HH:mm')
                        : '—'}
                    </td>
                    {isFounder && (
                      <td className="px-6 py-2">
                        {!isFounderRow && (
                          <Button
                            variant="secondary"
                            size="small"
                            disabled={isEnvRow}
                            title={
                              isEnvRow
                                ? t(($) => $.admins.revokeEnvHint, { ns: 'admin' })
                                : undefined
                            }
                            onClick={() => setRevokeTarget(admin)}
                          >
                            {t(($) => $.admins.revoke, { ns: 'admin' })}
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {isFounder && (
        <>
          <GrantAdminDialog open={grantOpen} onOpenChange={setGrantOpen} />
          <TransferAdminDialog
            open={transferOpen}
            onOpenChange={setTransferOpen}
            candidates={transferCandidates}
          />
          <PasswordConfirmDialog
            open={revokeTarget !== null}
            onOpenChange={(next) => {
              if (!next) setRevokeTarget(null)
            }}
            title={t(($) => $.admins.revokeTitle, { ns: 'admin' })}
            description={t(($) => $.admins.revokeDesc, { ns: 'admin' })}
            confirmLabel={t(($) => $.admins.confirm, { ns: 'admin' })}
            pending={revokeMutation.isPending}
            onConfirm={(password) => {
              if (!revokeTarget) return
              revokeMutation.mutate({
                params: { account_id: revokeTarget.id },
                body: { current_password: password },
              })
            }}
          />
        </>
      )}
    </div>
  )
}
