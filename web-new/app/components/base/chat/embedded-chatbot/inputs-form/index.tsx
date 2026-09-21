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

  // 双层：base = Dify 等效（try-app 无作用域），[.webapp-theme_&] = mockup 新视觉
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
          'w-full max-w-2xl rounded-2xl border-[0.5px] border-components-panel-border bg-components-panel-bg shadow-md',
          '[.webapp-theme_&]:rounded-[14px] [.webapp-theme_&]:border [.webapp-theme_&]:border-[var(--border)] [.webapp-theme_&]:bg-[var(--card)] [.webapp-theme_&]:shadow-[var(--shadow-sm)]',
          collapsed &&
            'border border-components-card-border bg-components-card-bg shadow-none [.webapp-theme_&]:border-[var(--border)] [.webapp-theme_&]:bg-[var(--card)]',
          isTryApp && 'max-w-[auto]',
        )}
      >
        <div
          className={cn(
            'flex items-center gap-3 rounded-t-2xl px-6 py-4 [.webapp-theme_&]:rounded-t-[14px]',
            !collapsed && 'border-b border-divider-subtle [.webapp-theme_&]:border-[var(--border)]',
            isMobile && 'px-4 py-3',
          )}
        >
          <div className="i-custom-public-other-message-3-fill size-6 shrink-0" />
          <div className="grow system-xl-semibold text-text-secondary [.webapp-theme_&]:text-[13px] [.webapp-theme_&]:font-semibold [.webapp-theme_&]:text-[var(--text-1)]">
            {t(($) => $['chat.chatSettingsTitle'], { ns: 'share' })}
          </div>
          {collapsed && (
            <Button
              className="text-text-tertiary uppercase"
              size="small"
              variant="ghost"
              onClick={() => setCollapsed(false)}
            >
              {t(($) => $['operation.edit'], { ns: 'common' })}
            </Button>
          )}
          {!collapsed && currentConversationId && (
            <Button
              className="text-text-tertiary uppercase"
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
          <div className={cn('p-6', isMobile && 'p-4')}>
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
