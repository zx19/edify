'use client'

import { useMutation } from '@tanstack/react-query'
import { Button } from '@xsl/lomva-ui/button'
import { Input } from '@xsl/lomva-ui/input'
import { toast } from '@xsl/lomva-ui/toast'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from '@/next/navigation'
import { consoleQuery } from '@/service/client'

export function AdminActivationForm({ token, email }: { token: string; email?: string | null }) {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mismatch, setMismatch] = useState(false)

  const activateMutation = useMutation({
    ...consoleQuery.admin.activation.post.mutationOptions(),
    onSuccess: () => {
      toast.success(t(($) => $.activate.success, { ns: 'admin' }))
      router.replace('/signin')
    },
    onError: () => {
      toast.error(t(($) => $.activate.failed, { ns: 'admin' }))
    },
  })

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password !== confirm) {
      setMismatch(true)
      return
    }
    setMismatch(false)
    activateMutation.mutate({
      body: { token, name: name.trim(), password, interface_language: i18n.language },
    })
  }

  return (
    <div className="flex flex-col md:w-100">
      <h2 className="text-[32px] font-bold text-text-primary">
        {t(($) => $.activate.title, { ns: 'admin' })}
      </h2>
      {email && <p className="mt-2 text-sm text-text-tertiary">{email}</p>}
      <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
        <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
          {t(($) => $.activate.nameLabel, { ns: 'admin' })}
          <Input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t(($) => $.activate.namePlaceholder, { ns: 'admin' })}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
          {t(($) => $.activate.passwordLabel, { ns: 'admin' })}
          <Input
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t(($) => $.activate.passwordPlaceholder, { ns: 'admin' })}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
          {t(($) => $.activate.confirmLabel, { ns: 'admin' })}
          <Input
            required
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder={t(($) => $.activate.confirmPlaceholder, { ns: 'admin' })}
          />
        </label>
        {mismatch && (
          <p role="alert" className="text-xs text-text-destructive">
            {t(($) => $.activate.passwordMismatch, { ns: 'admin' })}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={activateMutation.isPending}>
          {t(($) => $.activate.submit, { ns: 'admin' })}
        </Button>
      </form>
    </div>
  )
}
