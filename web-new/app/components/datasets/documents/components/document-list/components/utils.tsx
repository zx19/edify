import type { ReactNode } from 'react'
import { cn } from '@xsl/lomva-ui/cn'
import s from '../../../style.module.css'

export const renderTdValue = (value: string | number | null, isEmptyStyle = false): ReactNode => {
  const className = cn(isEmptyStyle ? 'text-text-tertiary' : 'text-text-secondary', s.tdValue)

  return <div className={className}>{value ?? '-'}</div>
}
