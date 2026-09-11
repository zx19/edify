'use client'

import type { AvatarSize } from '@xsl/lomva-ui/avatar'
import { AvatarFallback, AvatarRoot } from '@xsl/lomva-ui/avatar'
import { cn } from '@xsl/lomva-ui/cn'

export type WorkspaceAvatarSize = Extract<AvatarSize, 'xs' | 'sm' | 'lg' | '2xl'>

const workspaceAvatarClasses: Record<WorkspaceAvatarSize, { root: string; text: string }> = {
  xs: { root: 'rounded-md', text: 'text-[10px] leading-3' },
  sm: { root: 'rounded-md', text: 'text-[13px] leading-4' },
  lg: { root: 'rounded-lg', text: 'text-base leading-5' },
  '2xl': { root: 'rounded-xl', text: 'text-xl leading-7' },
}

export function WorkspaceAvatar({
  name,
  size = 'sm',
  className,
}: {
  name?: string
  size?: WorkspaceAvatarSize
  className?: string
}) {
  return (
    <AvatarRoot
      size={size}
      className={cn('shadow-xs', workspaceAvatarClasses[size].root, className)}
    >
      <AvatarFallback
        size={size}
        className={cn(
          'border border-divider-regular bg-components-icon-bg-orange-dark-solid bg-linear-to-br from-components-avatar-bg-mask-stop-0 to-components-avatar-bg-mask-stop-100 p-1',
        )}
      >
        <span
          className={cn(
            'bg-linear-to-r from-components-avatar-shape-fill-stop-0 to-components-avatar-shape-fill-stop-100 bg-clip-text font-semibold text-shadow-shadow-1 text-transparent uppercase opacity-90',
            workspaceAvatarClasses[size].text,
          )}
        >
          {name?.[0]?.toLocaleUpperCase() || '?'}
        </span>
      </AvatarFallback>
    </AvatarRoot>
  )
}
