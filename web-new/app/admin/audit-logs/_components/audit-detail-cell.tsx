'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export function AuditDetailCell({ detail }: { detail?: string | null }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  if (!detail) return <span className="text-text-quaternary">—</span>

  let pretty = detail
  try {
    pretty = JSON.stringify(JSON.parse(detail), null, 2)
  } catch {
    // detail 非 JSON 时原样展示
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className="w-fit text-xs text-text-accent hover:underline"
        onClick={() => setExpanded((v) => !v)}
      >
        {t(($) => $.audit.detailView, { ns: 'admin' })}
      </button>
      {expanded && (
        <pre className="max-w-md overflow-x-auto rounded-lg bg-components-input-bg-normal p-2 text-xs text-text-secondary">
          {pretty}
        </pre>
      )}
    </div>
  )
}
