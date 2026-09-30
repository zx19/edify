import { cn } from '@xsl/lomva-ui/cn'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import InputsFormContent from '@/app/components/base/chat/embedded-chatbot/inputs-form/content'
import { useEmbeddedChatbotContext } from '../context'

type Props = Readonly<{
  /** 初始展开：有必填字段时由调用方传 true（有必填默认展开 / 全选填折叠，chat 族同语义） */
  defaultOpen?: boolean
}>

/**
 * chatbot 变量表单卡（呈现层回炉 2026-09-30，mockup v2 类型2「聊天设置」卡，对照表 §5）：
 * - 折叠条族形态：卡头标题 + chevron 折叠钮（状态自治）；旧「编辑」「关闭」文字钮与
 *   底部渐变 Divider 装饰带退役；仅欢迎屏流内渲染（会话中变量查/改走 header ViewFormDropdown）
 * - 「开始对话」右下 accent CTA（吃壳层注入的 --accent；createTheme 直改色机制退役）
 * - 单实现消费 token（share 路由经 shareLayout、try-app 经容器挂类均有作用域）
 */
const InputsFormNode = ({ defaultOpen = false }: Props) => {
  const { t } = useTranslation()
  const { isMobile, currentConversationId, handleStartChat, allInputsHidden, inputsForms } =
    useEmbeddedChatbotContext()
  const [collapsed, setCollapsed] = React.useState(!defaultOpen)

  if (allInputsHidden || inputsForms.length === 0) return null

  return (
    <div data-testid="inputs-form-node" className="mt-6 w-full text-left">
      <div className="w-full rounded-[12px] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-xs)]">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <div className="grow text-[13px] font-semibold text-[var(--text-1)]">
            {t(($) => $['chat.chatSettingsTitle'], { ns: 'share' })}
          </div>
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-label={t(($) => $['chat.chatSettingsTitle'], { ns: 'share' })}
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
