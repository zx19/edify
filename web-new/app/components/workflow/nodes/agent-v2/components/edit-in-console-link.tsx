'use client'

import { useSuspenseQuery } from '@tanstack/react-query'
import { Button, buttonVariants } from '@xsl/lomva-ui/button'
import { cn } from '@xsl/lomva-ui/cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@xsl/lomva-ui/tooltip'
import { useTranslation } from 'react-i18next'
import { getAgentDetailPath } from '@/features/agent-v2/agent-detail/routes'
import { systemFeaturesQueryOptions } from '@/features/system-features/client'
import Link from '@/next/link'

const layoutClassName = 'min-w-0 flex-1 px-3'

export function EditInConsoleLink({
  agentId,
  canManageAgents,
}: {
  agentId: string
  canManageAgents: boolean
}) {
  const { t } = useTranslation()
  const { data: systemFeatures } = useSuspenseQuery(systemFeaturesQueryOptions())
  const label = t(($) => $['nodes.agent.roster.editInConsole'], { ns: 'workflow' })
  const disabledMessage = t(
    ($) =>
      $[
        systemFeatures.rbac_enabled
          ? 'nodes.agent.roster.editInConsoleDisabledRbac'
          : 'nodes.agent.roster.editInConsoleDisabled'
      ],
    { ns: 'workflow' },
  )

  const content = (
    <>
      <span aria-hidden className="i-ri-external-link-line size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </>
  )

  if (canManageAgents) {
    return (
      <Link
        className={cn(buttonVariants(), layoutClassName)}
        href={getAgentDetailPath(agentId, 'configure')}
        target="_blank"
        rel="noopener noreferrer"
      >
        {content}
      </Link>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button className={layoutClassName} disabled focusableWhenDisabled>
            {content}
          </Button>
        }
      />
      <TooltipContent role="tooltip">{disabledMessage}</TooltipContent>
    </Tooltip>
  )
}
