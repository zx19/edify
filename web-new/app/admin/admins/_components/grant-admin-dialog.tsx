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

type GrantAdminDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** 授予系统管理员(仅创始人可见):已注册直效;未注册 PENDING + 邀请链接降级 */
export function GrantAdminDialog({ open, onOpenChange }: GrantAdminDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pendingInvite, setPendingInvite] = useState<{ inviteUrl: string | null } | null>(null)

  const reset = () => {
    setEmail('')
    setPassword('')
    setPendingInvite(null)
  }

  const close = () => {
    onOpenChange(false)
    reset()
  }

  const grantMutation = useMutation({
    ...consoleQuery.admin.systemAdmins.post.mutationOptions(),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({
        queryKey: consoleQuery.admin.systemAdmins.get.key(),
      })
      if (res.pending) {
        setPendingInvite({ inviteUrl: res.invite_url ?? null })
      } else {
        toast.success(t(($) => $.admins.grantSuccess, { ns: 'admin' }))
        close()
      }
    },
    onError: () => {
      toast.error(t(($) => $.admins.grantFailed, { ns: 'admin' }))
    },
  })

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (grantMutation.isPending) return
    grantMutation.mutate({ body: { email: email.trim(), current_password: password } })
  }

  const absoluteInviteUrl = pendingInvite?.inviteUrl
    ? `${window.location.origin}${pendingInvite.inviteUrl}`
    : null

  const copyInvite = async () => {
    if (!absoluteInviteUrl) return
    await navigator.clipboard.writeText(absoluteInviteUrl)
    toast.success(t(($) => $.admins.copied, { ns: 'admin' }))
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="fixed top-1/2 left-1/2 w-120 max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 p-6">
          {pendingInvite === null && (
            <>
              <DialogTitle className="text-base font-semibold text-text-primary">
                {t(($) => $.admins.grantTitle, { ns: 'admin' })}
              </DialogTitle>
              <form className="mt-4 flex flex-col gap-4" onSubmit={onSubmit}>
                <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
                  {t(($) => $.admins.grantEmailLabel, { ns: 'admin' })}
                  <Input
                    required
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
                  {t(($) => $.admins.passwordLabel, { ns: 'admin' })}
                  <Input
                    required
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={t(($) => $.admins.passwordPlaceholder, { ns: 'admin' })}
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={close}>
                    {t(($) => $.admins.cancel, { ns: 'admin' })}
                  </Button>
                  <Button type="submit" variant="primary" disabled={grantMutation.isPending}>
                    {t(($) => $.admins.confirm, { ns: 'admin' })}
                  </Button>
                </div>
              </form>
            </>
          )}
          {pendingInvite !== null && (
            <>
              <DialogTitle className="text-base font-semibold text-text-primary">
                {t(($) => $.admins.grantPendingTitle, { ns: 'admin' })}
              </DialogTitle>
              <p className="mt-4 text-sm text-text-secondary">
                {t(($) => $.admins.grantPendingMailSent, { ns: 'admin' })}
              </p>
              {absoluteInviteUrl && (
                <div className="mt-3 flex flex-col gap-1.5">
                  <span className="text-sm text-text-secondary">
                    {t(($) => $.admins.inviteLinkLabel, { ns: 'admin' })}
                  </span>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 grow truncate rounded-lg bg-components-input-bg-normal px-3 py-2 text-xs text-text-primary">
                      {absoluteInviteUrl}
                    </code>
                    <Button type="button" variant="secondary" onClick={() => void copyInvite()}>
                      {t(($) => $.admins.copyLink, { ns: 'admin' })}
                    </Button>
                  </div>
                </div>
              )}
              <div className="mt-4 flex justify-end">
                <Button type="button" variant="primary" onClick={close}>
                  {t(($) => $.admins.done, { ns: 'admin' })}
                </Button>
              </div>
            </>
          )}
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
