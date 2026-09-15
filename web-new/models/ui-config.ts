/**
 * WebApp 应用级界面配置（design §2.1 sites.ui_config JSONB）。
 * 后端下发未就位（api 侧零实现，2026-09-15 实证）——前端先行：SiteInfo.ui_config 为可选字段，
 * 缺省/未下发 = 全默认值（全部显示，与现状一致）。
 */
export type WebAppUiConfig = {
  layout?: {
    show_conversation_sidebar?: boolean
    sidebar_width?: 'standard' | 'compact'
  }
  components?: {
    show_citation?: boolean
    show_message_actions?: boolean
    show_suggested_questions?: boolean
  }
  brand?: {
    footer_text?: string
    welcome_subtitle?: string
  }
}

export type ResolvedWebAppUiConfig = {
  layout: {
    show_conversation_sidebar: boolean
    sidebar_width: 'standard' | 'compact'
  }
  components: {
    show_citation: boolean
    show_message_actions: boolean
    show_suggested_questions: boolean
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
      sidebar_width: ui?.layout?.sidebar_width ?? 'standard',
    },
    components: {
      show_citation: ui?.components?.show_citation ?? true,
      show_message_actions: ui?.components?.show_message_actions ?? true,
      show_suggested_questions: ui?.components?.show_suggested_questions ?? true,
    },
    brand: {
      footer_text: ui?.brand?.footer_text ?? '',
      welcome_subtitle: ui?.brand?.welcome_subtitle ?? '',
    },
  }
}
