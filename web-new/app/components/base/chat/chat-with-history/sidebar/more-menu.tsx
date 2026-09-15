'use client'
import type { FC } from 'react'
import type { SiteInfo } from '@/models/share'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@xsl/lomva-ui/dropdown-menu'
import { IconButton } from '@xsl/lomva-ui/icon-button'
import * as React from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ThemeSwitcher from '@/app/components/base/theme-switcher'
import InfoModal from '@/app/components/share/text-generation/info-modal'
import { useWebAppStore } from '@/context/web-app-context'
import { AccessMode } from '@/models/access-control'
import { usePathname, useRouter } from '@/next/navigation'
import { resolveWebAppAddress } from '@/service/webapp-address'
import { webAppLogout } from '@/service/webapp-auth'

type Props = Readonly<{
  data?: SiteInfo
  hideLogout?: boolean
}>

/**
 * chat 侧栏「更多」菜单（chat 单元重写，mockup 类型1 侧栏底部）：
 * 主题切换 / 隐私政策（site 配置才显示）/ 关于 / 退出登录（非 public 模式才显示）。
 * 自 text-generation/menu-dropdown 分出（该共享件归 text-generation 单元台账，不动）；
 * InfoModal 暂复用 text-generation 资产（同源，随其单元重写）。
 */
const MoreMenu: FC<Props> = ({ data, hideLogout }) => {
  const webAppAccessMode = useWebAppStore((s) => s.webAppAccessMode)
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useTranslation()

  const handleLogout = async () => {
    await webAppLogout(resolveWebAppAddress())
    router.replace(`/webapp-signin?redirect_url=${pathname}`)
  }

  const [showInfo, setShowInfo] = useState(false)
  const handleOpenInfoModal = () => {
    queueMicrotask(() => {
      setShowInfo(true)
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <IconButton
              aria-label={t(($) => $['operation.more'], { ns: 'common' })}
              className="data-popup-open:bg-[var(--bg-soft)]"
            >
              <span aria-hidden className="i-ri-more-fill size-4" />
            </IconButton>
          }
        />
        <DropdownMenuContent placement="top-end" sideOffset={8} className="w-[200px]">
          <div className="px-3 py-1.5">
            <div className="flex items-center gap-2">
              <div className="grow text-[13px] text-[var(--text-2)]">
                {t(($) => $['theme.theme'], { ns: 'common' })}
              </div>
              <ThemeSwitcher />
            </div>
          </div>
          <DropdownMenuSeparator className="my-0" />
          {data?.privacy_policy && (
            <DropdownMenuLinkItem
              className="px-3"
              href={data.privacy_policy}
              target="_blank"
              rel="noreferrer"
            >
              <span className="grow">
                {t(($) => $['chat.privacyPolicyMiddle'], { ns: 'share' })}
              </span>
            </DropdownMenuLinkItem>
          )}
          <DropdownMenuItem className="px-3" onClick={handleOpenInfoModal}>
            {t(($) => $['userProfile.about'], { ns: 'common' })}
          </DropdownMenuItem>
          {!(
            hideLogout ||
            webAppAccessMode === AccessMode.EXTERNAL_MEMBERS ||
            webAppAccessMode === AccessMode.PUBLIC
          ) && (
            <DropdownMenuItem className="px-3" onClick={handleLogout}>
              {t(($) => $['userProfile.logout'], { ns: 'common' })}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {showInfo && (
        <InfoModal
          isShow={showInfo}
          onClose={() => {
            setShowInfo(false)
          }}
          data={data}
        />
      )}
    </>
  )
}
export default React.memo(MoreMenu)
