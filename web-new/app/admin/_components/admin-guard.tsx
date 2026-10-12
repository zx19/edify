'use client'

import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import Loading from '@/app/components/base/loading'
import { userProfileQueryOptions } from '@/features/account-profile/client'
import Link from '@/next/link'
import { AdminShell } from './admin-shell'

export function AdminGuard({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { data, isPending } = useQuery(userProfileQueryOptions())

  if (isPending) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (!data?.profile.is_system_admin) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-xl font-semibold text-text-primary">
          {t(($) => $.guard.forbiddenTitle, { ns: 'admin' })}
        </h1>
        <p className="text-sm text-text-tertiary">
          {t(($) => $.guard.forbiddenDesc, { ns: 'admin' })}
        </p>
        <Link href="/" className="text-sm text-text-accent">
          {t(($) => $.guard.backHome, { ns: 'admin' })}
        </Link>
      </div>
    )
  }

  return <AdminShell>{children}</AdminShell>
}
