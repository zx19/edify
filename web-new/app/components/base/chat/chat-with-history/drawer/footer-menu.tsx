'use client'
import type { FC } from 'react'
import type { AppData, SiteInfo } from '@/models/share'
import { cn } from '@xsl/lomva-ui/cn'
import { useTheme } from 'next-themes'
import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import InfoModal from '@/app/components/share/text-generation/info-modal'
import { useWebAppStore } from '@/context/web-app-context'
import { AccessMode } from '@/models/access-control'
import { resolveUiConfig } from '@/models/ui-config'
import { usePathname, useRouter } from '@/next/navigation'
import { resolveWebAppAddress } from '@/service/webapp-address'
import { webAppLogout } from '@/service/webapp-auth'

type Props = Readonly<{
  site?: SiteInfo
  customConfig?: AppData['custom_config']
  hideLogout?: boolean
}>

const menuItemClass =
  'flex w-full items-center gap-2 rounded-lg px-2 py-[7px] text-left text-[13px] text-[var(--text-2)] transition-colors hover:bg-[var(--bg-soft)] hover:text-[var(--text-1)]'

/**
 * 抽屉底部平铺菜单区（D11：header 无 ⋯，主题/隐私/关于/退出唯一落点）：
 * 主题三态 segment（next-themes）+ 隐私政策（site.privacy_policy 有才渲染）+ 关于（InfoModal
 * 暂复用 text-generation 资产）+ 退出登录（非 public 才显示，isInstalledApp 恒隐）+ 品牌行
 * （remove_webapp_brand 隐藏 → ui_config.brand.footer_text → replace_webapp_logo → 杏树林，
 * 链逻辑自 sidebar 迁移）。
 */
const FooterMenu: FC<Props> = ({ site, customConfig, hideLogout }) => {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const webAppAccessMode = useWebAppStore((s) => s.webAppAccessMode)
  const router = useRouter()
  const pathname = usePathname()
  const [showInfo, setShowInfo] = useState(false)

  const themeOptions = [
    { value: 'system', label: t(($) => $['theme.auto'], { ns: 'common' }) },
    { value: 'light', label: t(($) => $['theme.light'], { ns: 'common' }) },
    { value: 'dark', label: t(($) => $['theme.dark'], { ns: 'common' }) },
  ] as const

  const showLogout =
    !hideLogout &&
    webAppAccessMode !== AccessMode.EXTERNAL_MEMBERS &&
    webAppAccessMode !== AccessMode.PUBLIC

  const handleLogout = async () => {
    await webAppLogout(resolveWebAppAddress())
    router.replace(`/webapp-signin?redirect_url=${pathname}`)
  }

  const uiConfig = resolveUiConfig(site)
  const showBrand = !customConfig?.remove_webapp_brand

  return (
    <div className="flex shrink-0 flex-col gap-0.5 border-t border-[var(--border)] px-2.5 pt-2 pb-2.5">
      <div
        role="group"
        aria-label={t(($) => $['theme.theme'], { ns: 'common' })}
        className="mx-1.5 mt-0.5 mb-1.5 flex rounded-lg bg-[var(--bg-soft)] p-0.5"
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
      {site?.privacy_policy && (
        <a className={menuItemClass} href={site.privacy_policy} target="_blank" rel="noreferrer">
          <span aria-hidden className="i-ri-shield-check-line size-3.5 shrink-0" />
          <span className="grow">{t(($) => $['chat.privacyPolicyMiddle'], { ns: 'share' })}</span>
        </a>
      )}
      <button type="button" className={menuItemClass} onClick={() => setShowInfo(true)}>
        <span aria-hidden className="i-ri-information-line size-3.5 shrink-0" />
        <span className="grow">{t(($) => $['userProfile.about'], { ns: 'common' })}</span>
      </button>
      {showLogout && (
        <button type="button" className={menuItemClass} onClick={handleLogout}>
          <span aria-hidden className="i-ri-logout-box-r-line size-3.5 shrink-0" />
          <span className="grow">{t(($) => $['userProfile.logout'], { ns: 'common' })}</span>
        </button>
      )}
      {showBrand && (
        <div className="flex items-center gap-1 px-2 pt-2 text-[11.5px] whitespace-nowrap text-[var(--text-3)]">
          <span>{t(($) => $['chat.poweredBy'], { ns: 'share' })}</span>
          {uiConfig.brand.footer_text ? (
            <span className="truncate">{uiConfig.brand.footer_text}</span>
          ) : customConfig?.replace_webapp_logo ? (
            <img
              src={String(customConfig.replace_webapp_logo)}
              alt="logo"
              className="block h-5 w-auto"
            />
          ) : (
            <b className="font-semibold text-[var(--text-2)]">杏树林</b>
          )}
        </div>
      )}
      {showInfo && (
        <InfoModal
          isShow={showInfo}
          onClose={() => {
            setShowInfo(false)
          }}
          data={site}
        />
      )}
    </div>
  )
}

export default memo(FooterMenu)
