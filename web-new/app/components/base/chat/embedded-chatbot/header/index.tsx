import type { FC } from 'react'
import { cn } from '@xsl/lomva-ui/cn'
import { IconButton } from '@xsl/lomva-ui/icon-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@xsl/lomva-ui/tooltip'
import * as React from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AppIcon from '@/app/components/base/app-icon'
import ViewFormDropdown from '@/app/components/base/chat/embedded-chatbot/inputs-form/view-form-dropdown'
import { resolveUiConfig } from '@/models/ui-config'
import { isClient } from '@/utils/client'
import { useEmbeddedChatbotContext } from '../context'

type IHeaderProps = {
  allowResetChat?: boolean
  onCreateNewChat?: () => void
}

/** 桌面直连文字钮形态（mockup v2 形态一 .hd-btn）；view-form-dropdown text 变体同款（各自持有，防循环依赖） */
const headerTextBtnClass =
  'flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--bg-soft)] hover:text-[var(--text-1)]'

/**
 * chatbot 单元呈现层回炉（mockup v2 类型2，对照表 v2 §2）：
 * - 40px 极薄中性 header：左 AppIcon+应用名（弱化 text-2）；
 *   右 = 查看变量(条件) / 重置对话(条件) / 展开收起(iframe 条件链) / powered-by 小字
 * - 双形态判别 directFull = !isIframe && !isMobile：桌面直连 = 文字钮 + 品牌小字 +
 *   无 border-b；气泡窗/移动 = icon 钮 + border-b（品牌行落外壳 footer，见 ../index.tsx）
 * - createTheme 着色 / customerIcon（isDify 恒假分支）已退役；中性 token 着色
 * - iframe 通信协议【保留红线】逐字不动：
 *   上行 dify-chatbot-iframe-ready / dify-chatbot-expand-change；下行 dify-chatbot-config 钉 parentOrigin
 */
const Header: FC<IHeaderProps> = ({ allowResetChat, onCreateNewChat }) => {
  const { t } = useTranslation()
  const { appData, currentConversationId, inputsForms, allInputsHidden, isMobile } =
    useEmbeddedChatbotContext()

  // ===== iframe 通信（保留红线，逻辑逐字保全） =====
  const isIframe = isClient ? window.self !== window.top : false
  const [parentOrigin, setParentOrigin] = useState('')
  const [showToggleExpandButton, setShowToggleExpandButton] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const handleMessageReceived = useCallback(
    (event: MessageEvent) => {
      let currentParentOrigin = parentOrigin
      if (!currentParentOrigin && event.data.type === 'dify-chatbot-config') {
        currentParentOrigin = event.origin
        setParentOrigin(event.origin)
      }
      if (event.origin !== currentParentOrigin) return
      if (event.data.type === 'dify-chatbot-config')
        setShowToggleExpandButton(
          event.data.payload.isToggledByButton && !event.data.payload.isDraggable,
        )
    },
    [parentOrigin],
  )

  useEffect(() => {
    if (!isIframe) return

    const listener = (event: MessageEvent) => handleMessageReceived(event)
    window.addEventListener('message', listener)

    // Security: Use document.referrer to get parent origin
    const targetOrigin = document.referrer ? new URL(document.referrer).origin : '*'
    window.parent.postMessage({ type: 'dify-chatbot-iframe-ready' }, targetOrigin)

    return () => window.removeEventListener('message', listener)
  }, [isIframe, handleMessageReceived])

  const handleToggleExpand = useCallback(() => {
    if (!isIframe || !showToggleExpandButton) return
    setExpanded(!expanded)
    window.parent.postMessage(
      {
        type: 'dify-chatbot-expand-change',
      },
      parentOrigin,
    )
  }, [isIframe, parentOrigin, showToggleExpandButton, expanded])
  // ===== iframe 通信结束 =====

  const directFull = !isIframe && !isMobile
  const site = appData?.site
  const customConfig = appData?.custom_config
  const uiConfig = resolveUiConfig(site)
  const showBrand = !customConfig?.remove_webapp_brand
  const showViewForm = !!currentConversationId && inputsForms.length > 0 && !allInputsHidden
  const showReset = !!currentConversationId && allowResetChat

  return (
    <header
      className={cn(
        'flex h-10 shrink-0 items-center gap-2 px-3',
        !directFull && 'border-b border-[var(--border)]',
      )}
    >
      <div className="flex min-w-0 grow items-center gap-2">
        <AppIcon
          size="small"
          iconType={site?.icon_type}
          icon={site?.icon}
          background={site?.icon_background}
          imageUrl={site?.icon_url}
        />
        <span className="truncate text-[13px] font-semibold text-[var(--text-2)]">
          {site?.title || ''}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {showViewForm && <ViewFormDropdown variant={directFull ? 'text' : 'icon'} />}
        {showReset &&
          (directFull ? (
            <button type="button" className={headerTextBtnClass} onClick={onCreateNewChat}>
              <span aria-hidden className="i-ri-reset-left-line size-3.5" />
              {t(($) => $['chat.resetChat'], { ns: 'share' })}
            </button>
          ) : (
            <Tooltip>
              <TooltipTrigger
                render={
                  <IconButton
                    size="lg"
                    aria-label={t(($) => $['chat.resetChat'], { ns: 'share' })}
                    onClick={onCreateNewChat}
                  >
                    <div className="i-ri-reset-left-line size-4" aria-hidden="true" />
                  </IconButton>
                }
              />
              <TooltipContent>{t(($) => $['chat.resetChat'], { ns: 'share' })}</TooltipContent>
            </Tooltip>
          ))}
        {showToggleExpandButton && (
          <Tooltip>
            <TooltipTrigger
              render={
                <IconButton
                  size="lg"
                  aria-label={
                    expanded
                      ? t(($) => $['chat.collapse'], { ns: 'share' })
                      : t(($) => $['chat.expand'], { ns: 'share' })
                  }
                  onClick={handleToggleExpand}
                >
                  {expanded ? (
                    <div className="i-ri-collapse-diagonal-2-line size-4" aria-hidden="true" />
                  ) : (
                    <div className="i-ri-expand-diagonal-2-line size-4" aria-hidden="true" />
                  )}
                </IconButton>
              }
            />
            <TooltipContent>
              {expanded
                ? t(($) => $['chat.collapse'], { ns: 'share' })
                : t(($) => $['chat.expand'], { ns: 'share' })}
            </TooltipContent>
          </Tooltip>
        )}
        {directFull && showBrand && (
          <span className="ml-2 flex items-center gap-1 text-[11px] whitespace-nowrap text-[var(--text-3)]">
            {t(($) => $['chat.poweredBy'], { ns: 'share' })}
            {uiConfig.brand.footer_text ? (
              <span className="max-w-40 truncate">{uiConfig.brand.footer_text}</span>
            ) : customConfig?.replace_webapp_logo ? (
              <img
                src={`${customConfig.replace_webapp_logo}`}
                alt="logo"
                className="block h-4 w-auto"
              />
            ) : (
              <b className="font-semibold text-[var(--text-2)]">杏树林</b>
            )}
          </span>
        )}
      </div>
    </header>
  )
}

export default React.memo(Header)
