'use client'
import { useQuery } from '@tanstack/react-query'
import { buttonVariants } from '@xsl/lomva-ui/button'
import { cn } from '@xsl/lomva-ui/cn'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Loading from '@/app/components/base/loading'
import useDocumentTitle from '@/hooks/use-document-title'
import { useRouter, useSearchParams } from '@/next/navigation'
import { consoleQuery } from '@/service/client'
import { useInvitationCheck } from '@/service/use-common'
import { AdminActivationForm } from './admin-activation-form'

const ActivateForm = () => {
  const router = useRouter()
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const workspaceID = searchParams.get('workspace_id')
  const email = searchParams.get('email')
  const token = searchParams.get('token')

  // 第一跳:成员邀请命名空间(member_invite:token),含空间 owner PENDING 邀请
  const { data: checkRes } = useInvitationCheck(
    {
      ...(workspaceID && { workspace_id: workspaceID }),
      ...(email && { email }),
      token: token || undefined,
    },
    true,
  )

  // 第二跳:系统管理员邀请命名空间(admin_invite:token)——成员 check 判无效才补试
  const adminCheckEnabled = checkRes?.is_valid === false && !!token
  const { data: adminCheckRes, isError: adminCheckError } = useQuery(
    consoleQuery.admin.activation.check.get.queryOptions({
      input: { query: { token: token ?? '' } },
      enabled: adminCheckEnabled,
    }),
  )

  const showAdminForm = adminCheckEnabled && adminCheckRes?.is_valid === true
  const showInvalid =
    checkRes?.is_valid === false &&
    (!adminCheckEnabled || adminCheckRes?.is_valid === false || adminCheckError)

  useDocumentTitle(
    showInvalid
      ? t(($) => $.invalid, { ns: 'login' })
      : showAdminForm
        ? t(($) => $.activate.title, { ns: 'admin' })
        : t(($) => $.setYourAccount, { ns: 'login' }),
  )

  useEffect(() => {
    if (checkRes?.is_valid) {
      const params = new URLSearchParams(searchParams)
      const { email, workspace_id } = checkRes.data
      params.set('email', encodeURIComponent(email))
      params.set('workspace_id', encodeURIComponent(workspace_id))
      params.set('invite_token', encodeURIComponent(token as string))
      router.replace(`/signin?${params.toString()}`)
    }
  }, [checkRes, router, searchParams, token])

  return (
    <div
      className={cn('flex w-full grow flex-col items-center justify-center', 'px-6', 'md:px-27')}
    >
      {!checkRes && <Loading />}
      {showAdminForm && token && <AdminActivationForm token={token} email={adminCheckRes?.email} />}
      {showInvalid && (
        <div className="flex flex-col md:w-100">
          <div className="mx-auto w-full">
            <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-[20px] border border-divider-regular bg-components-option-card-option-bg p-5 text-[40px] font-bold shadow-lg">
              🤷‍♂️
            </div>
            <h2 className="text-[32px] font-bold text-text-primary">
              {t(($) => $.invalid, { ns: 'login' })}
            </h2>
          </div>
          <div className="mx-auto mt-6 w-full">
            <a
              href="https://dify.ai"
              className={cn(buttonVariants({ variant: 'primary' }), 'w-full text-sm!')}
            >
              {t(($) => $.explore, { ns: 'login' })}
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

export default ActivateForm
