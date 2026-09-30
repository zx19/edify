import { IconButton } from '@xsl/lomva-ui/icon-button'
import { Popover, PopoverContent, PopoverTrigger } from '@xsl/lomva-ui/popover'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import InputsFormContent from '@/app/components/base/chat/embedded-chatbot/inputs-form/content'

type Props = Readonly<{
  /** 触发器形态：icon（气泡窗/移动，默认）| text（桌面直连，mockup v2 形态一文字钮） */
  variant?: 'icon' | 'text'
}>

/** 与 header 桌面直连文字钮同款（各自持有，防循环依赖） */
const textBtnClass =
  'flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--bg-soft)] hover:text-[var(--text-1)]'

/**
 * 查看会话变量下拉（可编辑，会话中变量查/改唯一入口——对照表 §2/§5）。
 * iconColor prop（createTheme 着色通道）随机制退役移除。
 */
const ViewFormDropdown = ({ variant = 'icon' }: Props) => {
  const { t } = useTranslation()
  return (
    <Popover>
      <PopoverTrigger
        render={
          variant === 'text' ? (
            <button type="button" className={textBtnClass}>
              <span aria-hidden className="i-ri-chat-settings-line size-3.5 shrink-0" />
              {t(($) => $['chat.viewChatSettings'], { ns: 'share' })}
            </button>
          ) : (
            <IconButton
              aria-label={t(($) => $['chat.viewChatSettings'], { ns: 'share' })}
              size="lg"
              className="data-popup-open:bg-state-base-hover"
            >
              <span aria-hidden className="i-ri-chat-settings-line size-4 shrink-0" />
            </IconButton>
          )
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
