import type { FC, Ref } from 'react'
import type { Theme } from '../../embedded-chatbot/theme/theme'
import type { EnableType } from '../../types'
import type { FileUpload } from '@/app/components/base/features/types'
import { Button } from '@xsl/lomva-ui/button'
import { cn } from '@xsl/lomva-ui/cn'
import { IconButton } from '@xsl/lomva-ui/icon-button'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { FileUploaderInChatInput } from '@/app/components/base/file-uploader'

type OperationProps = {
  readonly?: boolean
  fileConfig?: FileUpload
  speechToTextConfig?: EnableType
  onShowVoiceInput?: () => void
  onSend: () => void
  sendButtonLabel?: string
  sendButtonLoading?: boolean
  disabled?: boolean
  /** @deprecated 发送钮配色改由作用域 accent 机制（.webapp-theme 下 var(--accent)），prop 仅保留签名兼容 */
  theme?: Theme | null
  ref?: Ref<HTMLDivElement>
}
const Operation: FC<OperationProps> = ({
  readonly,
  ref,
  fileConfig,
  speechToTextConfig,
  onShowVoiceInput,
  onSend,
  sendButtonLabel,
  sendButtonLoading,
  disabled,
}) => {
  const { t } = useTranslation()

  return (
    <div className={cn('flex shrink-0 items-center justify-end')}>
      <div className="flex items-center pl-1" ref={ref}>
        <div className="flex items-center gap-1">
          {fileConfig?.enabled && (
            <FileUploaderInChatInput readonly={readonly} fileConfig={fileConfig} />
          )}
          {speechToTextConfig?.enabled && onShowVoiceInput && (
            <IconButton
              className="shrink-0"
              size="lg"
              aria-label={t(($) => $['voiceInput.start'], { ns: 'common' })}
              disabled={readonly}
              onClick={onShowVoiceInput}
            >
              <span className="i-ri-mic-line size-5" aria-hidden="true" />
            </IconButton>
          )}
        </div>
        <Button
          aria-label={sendButtonLabel ? undefined : t(($) => $['operation.send'], { ns: 'common' })}
          className={cn(
            'ml-3 focus-visible:ring-inset',
            sendButtonLabel ? 'px-3' : 'w-8 px-0',
            // chat 单元重写：作用域内发送钮吃 accent（含 chat_color_theme 注入的覆盖值）；
            // 无作用域保持 variant primary 原样（console debug 面板零影响），createTheme 直改色值机制废弃
            '[.webapp-theme_&]:not-disabled:bg-[var(--accent)] [.webapp-theme_&]:not-disabled:hover:bg-[var(--accent-deep)]',
          )}
          variant="primary"
          disabled={readonly || disabled}
          loading={sendButtonLoading}
          onClick={onSend}
        >
          {sendButtonLabel || <span className="i-ri-send-plane-2-fill size-4" aria-hidden="true" />}
        </Button>
      </div>
    </div>
  )
}
Operation.displayName = 'Operation'

export default memo(Operation)
