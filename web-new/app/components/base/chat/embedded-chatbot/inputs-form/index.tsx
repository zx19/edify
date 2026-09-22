import { Button } from '@xsl/lomva-ui/button'
import { cn } from '@xsl/lomva-ui/cn'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import InputsFormContent from '@/app/components/base/chat/embedded-chatbot/inputs-form/content'
import Divider from '@/app/components/base/divider'
import { AppSourceType } from '@/service/share'
import { useEmbeddedChatbotContext } from '../context'

type Props = Readonly<{
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}>

/**
 * chatbot 变量表单卡（重写 2026-09-22，mockup 类型2）：
 * 单实现消费 token（share 路由经 shareLayout、try-app 经容器挂类均有作用域）。
 * 交互不变：collapsed 态「编辑」/ 展开态（有会话）「关闭」/ 新会话「开始对话」。
 */
const InputsFormNode = ({ collapsed, setCollapsed }: Props) => {
  const { t } = useTranslation()
  const {
    appSourceType,
    isMobile,
    currentConversationId,
    handleStartChat,
    allInputsHidden,
    inputsForms,
  } = useEmbeddedChatbotContext()
  const isTryApp = appSourceType === AppSourceType.tryApp

  if (allInputsHidden || inputsForms.length === 0) return null

  return (
    <div
      data-testid="inputs-form-node"
      className={cn(
        'mb-6 flex flex-col items-center px-4 pt-6',
        isMobile && 'mb-4 pt-4',
        isTryApp && 'mb-0 px-0',
      )}
    >
      <div
        className={cn(
          'w-full max-w-2xl rounded-[14px] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-sm)]',
          collapsed && 'shadow-none',
          isTryApp && 'max-w-[auto]',
        )}
      >
        <div
          className={cn(
            'flex items-center gap-3 rounded-t-[14px] px-6 py-4',
            !collapsed && 'border-b border-[var(--border)]',
            isMobile && 'px-4 py-3',
          )}
        >
          <div className="i-custom-public-other-message-3-fill size-6 shrink-0" />
          <div className="grow text-[13px] font-semibold text-[var(--text-1)]">
            {t(($) => $['chat.chatSettingsTitle'], { ns: 'share' })}
          </div>
          {collapsed && (
            <Button
              className="text-[var(--text-3)] uppercase"
              size="small"
              variant="ghost"
              onClick={() => setCollapsed(false)}
            >
              {t(($) => $['operation.edit'], { ns: 'common' })}
            </Button>
          )}
          {!collapsed && currentConversationId && (
            <Button
              className="text-[var(--text-3)] uppercase"
              size="small"
              variant="ghost"
              onClick={() => setCollapsed(true)}
            >
              {t(($) => $['operation.close'], { ns: 'common' })}
            </Button>
          )}
        </div>
        {!collapsed && (
          <div className={cn('p-6', isMobile && 'p-4')}>
            <InputsFormContent />
          </div>
        )}
        {!collapsed && !currentConversationId && (
          <div className={cn('px-6 pb-6', isMobile && 'px-4 pb-4')}>
            <Button
              variant="primary"
              className="w-full"
              onClick={() => handleStartChat(() => setCollapsed(true))}
            >
              {t(($) => $['chat.startChat'], { ns: 'share' })}
            </Button>
          </div>
        )}
      </div>
      {collapsed && (
        <div className="flex w-full max-w-180 items-center py-4">
          <Divider bgStyle="gradient" className="h-px basis-1/2 rotate-180" />
          <Divider bgStyle="gradient" className="h-px basis-1/2" />
        </div>
      )}
    </div>
  )
}

export default InputsFormNode
