import type { FC } from 'react'
import { IconButton } from '@xsl/lomva-ui/icon-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@xsl/lomva-ui/tooltip'
import * as React from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AppIcon from '@/app/components/base/app-icon'
import ViewFormDropdown from '@/app/components/base/chat/embedded-chatbot/inputs-form/view-form-dropdown'
import { isClient } from '@/utils/client'
import { useEmbeddedChatbotContext } from '../context'

type IHeaderProps = {
  allowResetChat?: boolean
  onCreateNewChat?: () => void
}

/**
 * chatbot 单元重写（mockup 类型2，对照表 §2）：
 * - 白底中性 header 双端同构：左 AppIcon+标题（桌面补回），右功能钮组
 * - createTheme 着色 / customerIcon（isDify 恒假分支）/ 桌面 powered by 退役
 *   （powered by 移至外壳底部一行，见 ../index.tsx）
 * - iframe 通信协议【保留红线】逐字不动：
 *   上行 dify-chatbot-iframe-ready / dify-chatbot-expand-change；下行 dify-chatbot-config 钉 parentOrigin
 */
const Header: FC<IHeaderProps> = ({ allowResetChat, onCreateNewChat }) => {
  const { t } = useTranslation()
  const { appData, currentConversationId, inputsForms, allInputsHidden } =
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

  return (
    <div className="flex h-13 shrink-0 items-center gap-2.5 border-b border-[var(--border)] bg-[var(--bg)] px-3.5">
      <div className="flex min-w-0 grow items-center gap-2.5">
        <AppIcon
          size="small"
          iconType={appData?.site.icon_type}
          icon={appData?.site.icon}
          background={appData?.site.icon_background}
          imageUrl={appData?.site.icon_url}
        />
        <div className="truncate text-[13.5px] font-semibold text-[var(--text-1)]">
          {appData?.site.title || ''}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
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
        {currentConversationId && inputsForms.length > 0 && !allInputsHidden && (
          <ViewFormDropdown />
        )}
        {currentConversationId && allowResetChat && (
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
        )}
      </div>
    </div>
  )
}

export default React.memo(Header)
