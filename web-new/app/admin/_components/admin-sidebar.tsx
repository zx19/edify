'use client'

import { useQuery } from '@tanstack/react-query'
import { Avatar } from '@xsl/lomva-ui/avatar'
import { cn } from '@xsl/lomva-ui/cn'
import { IconButton } from '@xsl/lomva-ui/icon-button'
import { useTranslation } from 'react-i18next'
import { userProfileQueryOptions } from '@/features/account-profile/client'
import Link from '@/next/link'
import { usePathname, useRouter } from '@/next/navigation'
import { useLogout } from '@/service/use-common'

function navLinkClassName(active: boolean) {
  return cn(
    'flex h-9 items-center rounded-lg px-3 text-sm text-text-secondary hover:bg-state-base-hover',
    active && 'bg-state-base-hover font-medium text-text-accent',
  )
}

export function AdminSidebar() {
  const { t } = useTranslation()
  const pathname = usePathname()
  const router = useRouter()
  const { data } = useQuery(userProfileQueryOptions())
  const { mutateAsync: logout, isPending: isLoggingOut } = useLogout()

  const handleLogout = async () => {
    await logout()
    router.replace('/signin')
  }

  const workspacesActive = pathname.startsWith('/admin/workspaces')
  const membersActive = pathname.startsWith('/admin/members')
  const adminsActive = pathname.startsWith('/admin/admins')
  const auditActive = pathname.startsWith('/admin/audit-logs')

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-divider-subtle bg-background-default-subtle">
      <div className="px-4 pt-4 pb-2 text-sm font-semibold text-text-primary">
        {t(($) => $.nav.title, { ns: 'admin' })}
      </div>
      <nav className="flex flex-col gap-0.5 px-2">
        <Link
          href="/admin/workspaces"
          aria-current={workspacesActive ? 'page' : undefined}
          className={navLinkClassName(workspacesActive)}
        >
          {t(($) => $.nav.workspaces, { ns: 'admin' })}
        </Link>
        <Link
          href="/admin/members"
          aria-current={membersActive ? 'page' : undefined}
          className={navLinkClassName(membersActive)}
        >
          {t(($) => $.nav.members, { ns: 'admin' })}
        </Link>
        <Link
          href="/admin/admins"
          aria-current={adminsActive ? 'page' : undefined}
          className={navLinkClassName(adminsActive)}
        >
          {t(($) => $.nav.admins, { ns: 'admin' })}
        </Link>
        <Link
          href="/admin/audit-logs"
          aria-current={auditActive ? 'page' : undefined}
          className={navLinkClassName(auditActive)}
        >
          {t(($) => $.nav.auditLogs, { ns: 'admin' })}
        </Link>
      </nav>
      <div className="mt-auto flex items-center gap-2 border-t border-divider-subtle p-3">
        <Avatar
          avatar={data?.profile.avatar_url ?? null}
          name={data?.profile.name ?? ''}
          size="sm"
          className="shrink-0"
        />
        <span className="min-w-0 grow truncate text-sm text-text-primary">
          {data?.profile.name}
        </span>
        <IconButton
          aria-label={t(($) => $['userProfile.logout'], { ns: 'common' })}
          disabled={isLoggingOut}
          onClick={() => void handleLogout()}
        >
          <span aria-hidden className="i-ri-logout-box-r-line size-4" />
        </IconButton>
      </div>
    </aside>
  )
}
