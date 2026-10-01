'use client'
import type { DropdownMenuContentProps } from '@xsl/lomva-ui/dropdown-menu'
import type { FC } from 'react'
import type { SiteInfo } from '@/models/share'
import { cn } from '@xsl/lomva-ui/cn'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@xsl/lomva-ui/dropdown-menu'
import { IconButton } from '@xsl/lomva-ui/icon-button'
import { useTheme } from 'next-themes'
import * as React from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWebAppStore } from '@/context/web-app-context'
import { AccessMode } from '@/models/access-control'
import { usePathname, useRouter } from '@/next/navigation'
import { resolveWebAppAddress } from '@/service/webapp-address'
import { webAppLogout } from '@/service/webapp-auth'
import InfoModal from './info-modal'

type Props = Readonly<
  Pick<DropdownMenuContentProps, 'placement'> & {
    data?: SiteInfo
    hideLogout?: boolean
  }
>

/**
 * text-gen 族 ⋯ 菜单（header 右唯一菜单落点，对照表 §3）：
 * 主题三态文字 segment（footer-menu 同款 var token；ThemeSwitcher icon 版退役出本族）
 * + 隐私政策（site 配置才显示）+ 关于（描述已并入弹窗）+ 退出登录（条件显隐沿用）
 */
const MenuDropdown: FC<Props> = ({ data, placement, hideLogout }) => {
  const webAppAccessMode = useWebAppStore((s) => s.webAppAccessMode)
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()

  const themeOptions = [
    { value: 'system', label: t(($) => $['theme.auto'], { ns: 'common' }) },
    { value: 'light', label: t(($) => $['theme.light'], { ns: 'common' }) },
    { value: 'dark', label: t(($) => $['theme.dark'], { ns: 'common' }) },
  ] as const

  const handleLogout = async () => {
    await webAppLogout(resolveWebAppAddress())
    router.replace(`/webapp-signin?redirect_url=${pathname}`)
  }

  const [show, setShow] = useState(false)
  const handleOpenInfoModal = () => {
    queueMicrotask(() => {
      setShow(true)
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <IconButton
              aria-label={t(($) => $['operation.more'], { ns: 'common' })}
              size="lg"
              className="data-popup-open:bg-[var(--bg-soft)]"
            >
              <span aria-hidden className="i-ri-more-fill size-4" />
            </IconButton>
          }
        />
        <DropdownMenuContent
          placement={placement || 'bottom-end'}
          sideOffset={4}
          className="w-[200px]"
        >
          <div className="px-2 py-1.5">
            <div
              role="group"
              aria-label={t(($) => $['theme.theme'], { ns: 'common' })}
              className="flex rounded-lg bg-[var(--bg-soft)] p-0.5"
            >
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={theme === option.value}
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    'h-[26px] flex-1 rounded-md text-xs font-medium text-[var(--text-3)] transition-colors',
                    theme === option.value &&
                      'bg-[var(--card)] font-semibold text-[var(--text-1)] shadow-[var(--shadow-xs)]',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <DropdownMenuSeparator className="my-0" />
          {data?.privacy_policy && (
            <DropdownMenuLinkItem
              className="px-3 system-md-regular"
              href={data.privacy_policy}
              target="_blank"
              rel="noreferrer"
            >
              <span className="grow">
                {t(($) => $['chat.privacyPolicyMiddle'], { ns: 'share' })}
              </span>
            </DropdownMenuLinkItem>
          )}
          <DropdownMenuItem className="px-3 system-md-regular" onClick={handleOpenInfoModal}>
            {t(($) => $['userProfile.about'], { ns: 'common' })}
          </DropdownMenuItem>
          {!(
            hideLogout ||
            webAppAccessMode === AccessMode.EXTERNAL_MEMBERS ||
            webAppAccessMode === AccessMode.PUBLIC
          ) && (
            <DropdownMenuItem className="px-3 system-md-regular" onClick={handleLogout}>
              {t(($) => $['userProfile.logout'], { ns: 'common' })}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {show && (
        <InfoModal
          isShow={show}
          onClose={() => {
            setShow(false)
          }}
          data={data}
        />
      )}
    </>
  )
}
export default React.memo(MenuDropdown)
