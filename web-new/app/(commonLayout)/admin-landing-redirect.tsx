'use client'

import { useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { useEffect } from 'react'
import { currentWorkspaceAtom, currentWorkspaceLoadingAtom } from '@/context/workspace-state'
import { userProfileQueryOptions } from '@/features/account-profile/client'
import { useRouter } from '@/next/navigation'

/**
 * 无空间系统管理员兜底:登录落地 / 与误入普通控制台页两场景统一 → /admin。
 * 仅在 profile 与 workspace 两个 query 均落地后判定,避免加载期误跳。
 * 反向无循环:/admin 守卫对非管理员只渲染 403 视图、不重定向。
 */
export function AdminLandingRedirect() {
  const router = useRouter()
  const { data: profileData, isPending: profilePending } = useQuery(userProfileQueryOptions())
  const currentWorkspace = useAtomValue(currentWorkspaceAtom)
  const workspacePending = useAtomValue(currentWorkspaceLoadingAtom)

  useEffect(() => {
    if (profilePending || workspacePending) return
    if (profileData?.profile.is_system_admin && !currentWorkspace.id) router.replace('/admin')
  }, [profilePending, workspacePending, profileData, currentWorkspace.id, router])

  return null
}
