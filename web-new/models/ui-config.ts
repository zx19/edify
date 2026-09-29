/**
 * WebApp 应用级界面配置（design §2.1 sites.ui_config JSONB）。
 * 后端下发未就位（api 侧零实现，2026-09-15 实证）——前端先行：SiteInfo.ui_config 为可选字段，
 * 缺省/未下发 = 全默认值（全部显示，与现状一致）。
 */
export type WebAppUiConfig = {
  layout?: {
    show_conversation_sidebar?: boolean
    /** D9 退役：抽屉定宽（桌面 300px/移动 85%），键接收不渲染——仅为兼容旧配置不报错而保留 */
    sidebar_width?: 'standard' | 'compact'
  }
  components?: {
    show_citation?: boolean
    show_message_actions?: boolean
    show_suggested_questions?: boolean
    /** 批量运行 tab（text-generation 族）：默认隐藏，配置 true 才显示（2026-09-22 用户拍板） */
    show_batch_tab?: boolean
  }
  brand?: {
    footer_text?: string
    welcome_subtitle?: string
  }
}

export type ResolvedWebAppUiConfig = {
  layout: {
    show_conversation_sidebar: boolean
    /** D9 退役：解析落默认值为兼容旧配置，呈现层零消费（抽屉定宽） */
    sidebar_width: 'standard' | 'compact'
  }
  components: {
    show_citation: boolean
    show_message_actions: boolean
    show_suggested_questions: boolean
    show_batch_tab: boolean
  }
  brand: {
    footer_text: string
    welcome_subtitle: string
  }
}

type UiConfigCarrier = { ui_config?: WebAppUiConfig | null } | null | undefined

/** 默认值填充：NULL/未知键/缺字段 → 全默认（终端用户侧零逻辑，design §2.1） */
export function resolveUiConfig(site: UiConfigCarrier): ResolvedWebAppUiConfig {
  const ui = site?.ui_config
  return {
    layout: {
      show_conversation_sidebar: ui?.layout?.show_conversation_sidebar ?? true,
      // D9 退役：抽屉定宽，键接收不渲染（解析保留，呈现层零消费）
      sidebar_width: ui?.layout?.sidebar_width ?? 'standard',
    },
    components: {
      show_citation: ui?.components?.show_citation ?? true,
      show_message_actions: ui?.components?.show_message_actions ?? true,
      show_suggested_questions: ui?.components?.show_suggested_questions ?? true,
      show_batch_tab: ui?.components?.show_batch_tab ?? false,
    },
    brand: {
      footer_text: ui?.brand?.footer_text ?? '',
      welcome_subtitle: ui?.brand?.welcome_subtitle ?? '',
    },
  }
}
