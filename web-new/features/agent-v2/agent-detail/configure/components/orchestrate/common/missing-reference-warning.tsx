'use client'

import { cn } from '@xsl/lomva-ui/cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@xsl/lomva-ui/tooltip'

export function MissingReferenceWarning({
  className,
  label,
}: {
  className?: string
  label: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            className={cn(
              'flex size-5 shrink-0 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-state-accent-solid focus-visible:outline-hidden',
              className,
            )}
          >
            <span aria-hidden className="i-ri-alert-fill size-3.5 text-text-warning-secondary" />
          </button>
        }
      />
      <TooltipContent aria-label={label}>{label}</TooltipContent>
    </Tooltip>
  )
}
