import type { CSSProperties } from 'react'

/**
 * chat_color_theme → 作用域 accent 三档注入（替代 createTheme 内联样式机制，design §3.2）：
 * - 未配置 = 不注入，继承 tokens.css 作用域默认橙
 * - 配置后 = 壳层根 inline 覆盖 --accent/--accent-deep/--accent-soft，发送钮/CTA/选中态随之换色
 * - chat_color_theme_inverted：旧语义=定制色 header 白底反色；新 header 恒中性（mockup 扁平化），
 *   无视觉落点（功能对照表核销注记）
 * 消费方：chat-with-history（/chat 壳）、embedded-chatbot（/chatbot 壳）——两线同一机制。
 */
export function buildAccentStyle(
  chatColorTheme: string | null | undefined,
): CSSProperties | undefined {
  if (!chatColorTheme) return undefined
  return {
    '--accent': chatColorTheme,
    '--accent-deep': `color-mix(in srgb, ${chatColorTheme}, black 12%)`,
    '--accent-soft': `color-mix(in srgb, ${chatColorTheme} 10%, transparent)`,
    '--accent-pill-bg': `color-mix(in srgb, ${chatColorTheme} 12%, transparent)`,
    '--accent-pill-fg': `color-mix(in srgb, ${chatColorTheme}, black 12%)`,
  } as CSSProperties
}
