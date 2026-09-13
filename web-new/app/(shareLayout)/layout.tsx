import type { FC, PropsWithChildren } from 'react'
import WebAppStoreProvider from '@/context/web-app-context'
import Splash from './components/splash'

/**
 * WebApp 壳层地基（3a 重写）：
 * - 根节点挂 .webapp-theme 作用域类——@xsl/lomva-tokens 新视觉变量在此作用域内生效
 * - dark 经根布局 next-themes 的 [data-theme='dark'] 属性通道命中（见 tokens.css 选择器组）
 * - 视觉壳层（chat-with-history / text-generation）不在此：按 v2 E.6 混合模式随 chat 单元 mockup 范本落地
 * - 认证页（webapp-signin/reset-password）不重写（3a 边界「不含认证」），挂类对其零视觉影响（不消费 token）
 */
const Layout: FC<PropsWithChildren> = ({ children }) => {
  return (
    <div className="webapp-theme h-full min-w-75 pb-[env(safe-area-inset-bottom)] [font-family:var(--font)]">
      <WebAppStoreProvider>
        <Splash>{children}</Splash>
      </WebAppStoreProvider>
    </div>
  )
}

export default Layout
