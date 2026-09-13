'use client'
import { useTranslation } from 'react-i18next'

/**
 * WebApp 壳层加载态（3a 新视觉首消费点）：accent 橙环 + 三级灰文案。
 * 供 Splash 与 WebAppStoreProvider 的 access-mode 门共用（两道门任一拦截时视觉一致）。
 * 注意：border/text 的 var() 任意值必须带 color 类型提示——tailwind v4 裸 var() 有歧义不生成规则。
 */
export default function SplashSpinner() {
  const { t } = useTranslation()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-y-3">
      <div
        className="size-8 animate-spin rounded-full border-2 border-[color:var(--border)] border-t-[color:var(--accent)]"
        role="status"
        aria-label={t(($) => $['splash.loading'], { ns: 'share' })}
      />
      <span className="text-[13px] text-[color:var(--text-3)]">
        {t(($) => $['splash.loading'], { ns: 'share' })}
      </span>
    </div>
  )
}
