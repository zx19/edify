'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@xsl/lomva-ui/button'
import {
  Dialog,
  DialogBackdrop,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '@xsl/lomva-ui/dialog'
import { Input } from '@xsl/lomva-ui/input'
import { toast } from '@xsl/lomva-ui/toast'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { consoleQuery } from '@/service/client'

type CreateWorkspaceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateWorkspaceDialog({ open, onOpenChange }: CreateWorkspaceDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  // PENDING 分支结果态:非 null 即展示邀请链接页
  const [pendingResult, setPendingResult] = useState<{ inviteUrl: string | null } | null>(null)

  const reset = () => {
    setName('')
    setOwnerEmail('')
    setPendingResult(null)
  }

  const close = () => {
    onOpenChange(false)
    reset()
  }

  const createMutation = useMutation({
    ...consoleQuery.admin.workspaces.post.mutationOptions(),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({
        queryKey: consoleQuery.admin.workspaces.get.key(),
      })
      if (res.owner_pending) {
        setPendingResult({ inviteUrl: res.invite_url ?? null })
      } else {
        toast.success(t(($) => $.workspaces.createSuccess, { ns: 'admin' }))
        close()
      }
    },
    onError: () => {
      toast.error(t(($) => $.workspaces.createFailed, { ns: 'admin' }))
    },
  })

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (createMutation.isPending) return
    createMutation.mutate({ body: { name: name.trim(), owner_email: ownerEmail.trim() } })
  }

  const absoluteInviteUrl = pendingResult?.inviteUrl
    ? `${window.location.origin}${pendingResult.inviteUrl}`
    : null

  const copyInvite = async () => {
    if (!absoluteInviteUrl) return
    await navigator.clipboard.writeText(absoluteInviteUrl)
    toast.success(t(($) => $.workspaces.copied, { ns: 'admin' }))
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="fixed top-1/2 left-1/2 w-120 max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 p-6">
          {pendingResult === null && (
            <>
              <DialogTitle className="text-base font-semibold text-text-primary">
                {t(($) => $.workspaces.createTitle, { ns: 'admin' })}
              </DialogTitle>
              <form className="mt-4 flex flex-col gap-4" onSubmit={onSubmit}>
                <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
                  {t(($) => $.workspaces.createNameLabel, { ns: 'admin' })}
                  <Input
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t(($) => $.workspaces.createNamePlaceholder, { ns: 'admin' })}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
                  {t(($) => $.workspaces.createOwnerLabel, { ns: 'admin' })}
                  <Input
                    required
                    type="email"
                    value={ownerEmail}
                    onChange={(event) => setOwnerEmail(event.target.value)}
                    placeholder={t(($) => $.workspaces.createOwnerPlaceholder, { ns: 'admin' })}
                  />
                </label>
                <p className="text-xs text-text-tertiary">
                  {t(($) => $.workspaces.createHint, { ns: 'admin' })}
                </p>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={close}>
                    {t(($) => $.workspaces.createCancel, { ns: 'admin' })}
                  </Button>
                  <Button type="submit" variant="primary" disabled={createMutation.isPending}>
                    {t(($) => $.workspaces.createSubmit, { ns: 'admin' })}
                  </Button>
                </div>
              </form>
            </>
          )}
          {pendingResult !== null && (
            <>
              <DialogTitle className="text-base font-semibold text-text-primary">
                {t(($) => $.workspaces.pendingTitle, { ns: 'admin' })}
              </DialogTitle>
              <p className="mt-4 text-sm text-text-secondary">
                {t(($) => $.workspaces.pendingMailSent, { ns: 'admin' })}
              </p>
              {absoluteInviteUrl && (
                <div className="mt-3 flex flex-col gap-1.5">
                  <span className="text-sm text-text-secondary">
                    {t(($) => $.workspaces.inviteLinkLabel, { ns: 'admin' })}
                  </span>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 grow truncate rounded-lg bg-components-input-bg-normal px-3 py-2 text-xs text-text-primary">
                      {absoluteInviteUrl}
                    </code>
                    <Button type="button" variant="secondary" onClick={() => void copyInvite()}>
                      {t(($) => $.workspaces.copyLink, { ns: 'admin' })}
                    </Button>
                  </div>
                </div>
              )}
              <div className="mt-4 flex justify-end">
                <Button type="button" variant="primary" onClick={close}>
                  {t(($) => $.workspaces.pendingDone, { ns: 'admin' })}
                </Button>
              </div>
            </>
          )}
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
