import { cn } from '@xsl/lomva-ui/cn'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import InputsFormContent from '@/app/components/base/chat/chat-with-history/inputs-form/content'
import { useChatWithHistoryContext } from '../context'

type Props = Readonly<{
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}>

/**
 * 变量表单卡（chat 单元重写，mockup 类型1 欢迎屏）：
 * - 卡片：token 边框/底色/radius 14；标题行可折叠
 * - 「开始聊天」accent 实心钮（吃壳层注入的 --accent；createTheme 直改色机制退役）
 */
const InputsFormNode = ({ collapsed, setCollapsed }: Props) => {
  const { t } = useTranslation()
  const { isMobile, currentConversationId, handleStartChat, allInputsHidden, inputsForms } =
    useChatWithHistoryContext()

  if (allInputsHidden || inputsForms.length === 0) return null

  return (
    <div className={cn('flex flex-col items-center px-4 pt-6', isMobile && 'pt-4')}>
      <div className="w-full max-w-2xl rounded-[14px] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <span aria-hidden className="i-ri-list-check size-4 text-[var(--text-3)]" />
          <div className="grow text-[13px] font-semibold text-[var(--text-1)]">
            {t(($) => $['chat.chatSettingsTitle'], { ns: 'share' })}
          </div>
          <button
            type="button"
            aria-expanded={!collapsed}
            className="grid size-6 place-items-center rounded-md text-[var(--text-3)] transition-colors hover:bg-[var(--bg-soft)] hover:text-[var(--text-1)]"
            onClick={() => setCollapsed(!collapsed)}
          >
            <span
              aria-hidden
              className={cn(
                'i-ri-arrow-down-s-line size-4 transition-transform',
                collapsed && '-rotate-90',
              )}
            />
          </button>
        </div>
        {!collapsed && (
          <div className={cn('border-t border-[var(--border)] px-4 pt-1 pb-4', isMobile && 'px-3')}>
            <InputsFormContent />
            {!currentConversationId && (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="inline-flex h-[34px] items-center gap-1.5 rounded-[9px] bg-[var(--accent)] px-4 text-[13px] font-semibold text-white shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--accent-deep)]"
                  onClick={() => handleStartChat(() => setCollapsed(true))}
                >
                  {t(($) => $['chat.startChat'], { ns: 'share' })}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default InputsFormNode
