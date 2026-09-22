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
          className="w-100 rounded-[14px] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-md)] backdrop-blur-xs"
        >
          <div className="flex items-center gap-3 rounded-t-[14px] border-b border-[var(--border)] px-6 py-4">
            <div className="i-custom-public-other-message-3-fill size-6 shrink-0" />
            <div className="grow text-[13px] font-semibold text-[var(--text-1)]">
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
