import type { FC } from 'react'
import type { SiteInfo } from '@/models/share'
import AppIcon from '@/app/components/base/app-icon'
import { appDefaultIconBackground } from '@/config'
import MenuDropdown from './menu-dropdown'

type Props = Readonly<{
  siteInfo: SiteInfo
  hideLogout?: boolean
}>

/**
 * text-gen 族 40px 极薄 header（mockup v2 类型34，对照表 §2/§3）：
 * 左 = 22px 应用图标 + 应用名（弱化 text-2）；右 = ⋯ 菜单（主题/隐私/关于/退出唯一落点）。
 */
const Header: FC<Props> = ({ siteInfo, hideLogout }) => (
  <header className="flex h-10 shrink-0 items-center gap-2 px-4">
    <div className="flex min-w-0 grow items-center gap-2">
      <AppIcon
        size="small"
        iconType={siteInfo.icon_type}
        icon={siteInfo.icon}
        background={siteInfo.icon_background || appDefaultIconBackground}
        imageUrl={siteInfo.icon_url}
      />
      <span className="truncate text-[13px] font-semibold text-[var(--text-2)]">
        {siteInfo.title}
      </span>
    </div>
    <MenuDropdown hideLogout={hideLogout} data={siteInfo} />
  </header>
)

export default Header
