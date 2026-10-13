'use client'

import type { AdminSystemAdminItemResponse } from '@dify/contracts/api/console/admin/types.gen'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '@xsl/lomva-ui/select'
import { toast } from '@xsl/lomva-ui/toast'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { consoleQuery } from '@/service/client'
import { PasswordConfirmDialog } from './password-confirm-dialog'

type TransferAdminDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 可受让目标:非创始人、非待激活 */
  candidates: AdminSystemAdminItemResponse[]
}

/** 转让创始人身份(仅创始人):成功后当前用户变普通管理员,本页随之只读 */
export function TransferAdminDialog({ open, onOpenChange, candidates }: TransferAdminDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [targetId, setTargetId] = useState('')

  const transferMutation = useMutation({
    ...consoleQuery.admin.systemAdmins.transfer.post.mutationOptions(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: consoleQuery.admin.systemAdmins.get.key() }),
        // 当前用户身份已变(创始人→普通):profile 重新拉取,页面随之只读
        queryClient.invalidateQueries({ queryKey: consoleQuery.account.profile.get.key() }),
      ])
      toast.success(t(($) => $.admins.transferSuccess, { ns: 'admin' }))
      onOpenChange(false)
    },
    onError: () => {
      toast.error(t(($) => $.admins.transferFailed, { ns: 'admin' }))
    },
  })

  return (
    <PasswordConfirmDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setTargetId('')
      }}
      title={t(($) => $.admins.transferTitle, { ns: 'admin' })}
      description={t(($) => $.admins.transferDesc, { ns: 'admin' })}
      confirmLabel={t(($) => $.admins.confirm, { ns: 'admin' })}
      pending={transferMutation.isPending}
      onConfirm={(password) => {
        if (!targetId) return
        transferMutation.mutate({ body: { account_id: targetId, current_password: password } })
      }}
    >
      <div className="flex flex-col gap-1.5 text-sm text-text-secondary">
        <span>{t(($) => $.admins.transferTargetLabel, { ns: 'admin' })}</span>
        <Select value={targetId} onValueChange={(value) => setTargetId(value ?? '')}>
          <SelectTrigger
            aria-label={t(($) => $.admins.transferTargetLabel, { ns: 'admin' })}
            className="w-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((admin) => (
              <SelectItem value={admin.id} key={admin.id}>
                <SelectItemText>{`${admin.name} (${admin.email})`}</SelectItemText>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </PasswordConfirmDialog>
  )
}
