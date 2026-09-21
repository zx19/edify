import { cn } from '@xsl/lomva-ui/cn'
import { IconButton } from '@xsl/lomva-ui/icon-button'
import { Popover, PopoverContent, PopoverTrigger } from '@xsl/lomva-ui/popover'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import InputsFormContent from '@/app/components/base/chat/embedded-chatbot/inputs-form/content'

/**
 * 查看会话变量下拉。chatbot 单元重写：iconColor prop（createTheme 着色通道）随机制退役移除；
 * 浮层卡片双层：base = Dify 等效，[.webapp-theme_&] = 新视觉 token。
 */
const ViewFormDropdown = () => {
  const { t } = useTranslation()
  return (
    <Popover>
      <PopoverTrigger
        render={
          <IconButton
            aria-label={t(($) => $['chat.viewChatSettings'], { ns: 'share' })}
            size="lg"
            className="data-popup-open:bg-state-base-hover"
          >
            <span aria-hidden className="i-ri-chat-settings-line size-4 shrink-0" />
          </IconButton>
        }
      />
      <PopoverContent
        placement="bottom-end"
        sideOffset={4}
        alignOffset={4}
        className="border-none bg-transparent shadow-none"
      >
        <div
          data-testid="view-form-dropdown-content"
          className={cn(
            'w-100 rounded-2xl border-[0.5px] border-components-panel-border bg-components-panel-bg shadow-lg backdrop-blur-xs',
            '[.webapp-theme_&]:rounded-[14px] [.webapp-theme_&]:border [.webapp-theme_&]:border-[var(--border)] [.webapp-theme_&]:bg-[var(--card)] [.webapp-theme_&]:shadow-[var(--shadow-md)]',
          )}
        >
          <div className="flex items-center gap-3 rounded-t-2xl border-b border-divider-subtle px-6 py-4 [.webapp-theme_&]:rounded-t-[14px] [.webapp-theme_&]:border-[var(--border)]">
            <div className="i-custom-public-other-message-3-fill size-6 shrink-0" />
            <div className="grow system-xl-semibold text-text-secondary [.webapp-theme_&]:text-[13px] [.webapp-theme_&]:font-semibold [.webapp-theme_&]:text-[var(--text-1)]">
              {t(($) => $['chat.chatSettingsTitle'], { ns: 'share' })}
            </div>
          </div>
          <div className="p-6">
            <InputsFormContent />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default ViewFormDropdown
