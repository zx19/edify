'use client'

import type { ReactNode } from 'react'
import { Button } from '@xsl/lomva-ui/button'
import {
  Dialog,
  DialogBackdrop,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '@xsl/lomva-ui/dialog'
import { Input } from '@xsl/lomva-ui/input'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

type PasswordConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel: string
  pending?: boolean
  onConfirm: (password: string) => void
  /** 额外表单字段(如转让的目标下拉),渲染在密码框之前 */
  children?: ReactNode
}

/** 高危操作密码确认弹窗(撤销/转让共用;授予因含结果态独立) */
export function PasswordConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
  children,
}: PasswordConfirmDialogProps) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')

  const handleOpenChange = (next: boolean) => {
    if (!next) setPassword('')
    onOpenChange(next)
  }

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending || !password) return
    onConfirm(password)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="fixed top-1/2 left-1/2 w-120 max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 p-6">
          <DialogTitle className="text-base font-semibold text-text-primary">{title}</DialogTitle>
          {description && <p className="mt-2 text-sm text-text-tertiary">{description}</p>}
          <form className="mt-4 flex flex-col gap-4" onSubmit={onSubmit}>
            {children}
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
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                {t(($) => $.admins.cancel, { ns: 'admin' })}
              </Button>
              <Button type="submit" variant="primary" disabled={pending}>
                {confirmLabel}
              </Button>
            </div>
          </form>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
