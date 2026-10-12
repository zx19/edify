'use client'

import { cn } from '@xsl/lomva-ui/cn'
import { useTranslation } from 'react-i18next'

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  const isNormal = status === 'normal'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border border-divider-subtle px-1.5 py-0.5 text-xs font-medium',
        isNormal ? 'text-text-success' : 'text-text-tertiary',
      )}
    >
      {isNormal
        ? t(($) => $.workspaces.statusNormal, { ns: 'admin' })
        : t(($) => $.workspaces.statusArchive, { ns: 'admin' })}
    </span>
  )
}
