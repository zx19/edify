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
  /** D4 发送键双态：响应中且带停止句柄 → 发送键变形 ■（同键位 发送⇄停止）；缺句柄时保持发送语义 */
  isResponding?: boolean
  onStopResponding?: () => void
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
  isResponding,
  onStopResponding,
  sendButtonLabel,
  sendButtonLoading,
  disabled,
}) => {
  const { t } = useTranslation()
  const isStop = !!isResponding && !!onStopResponding

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
          aria-label={
            isStop
              ? t(($) => $['operation.stopResponding'], { ns: 'appDebug' })
              : sendButtonLabel
                ? undefined
                : t(($) => $['operation.send'], { ns: 'common' })
          }
          className={cn(
            'ml-3 focus-visible:ring-inset',
            sendButtonLabel && !isStop ? 'px-3' : 'w-8 px-0',
            // chat 单元重写：作用域内发送钮吃 accent（含 chat_color_theme 注入的覆盖值）；
            // 无作用域保持 variant primary 原样（console debug 面板零影响），createTheme 直改色值机制废弃
            '[.webapp-theme_&]:not-disabled:bg-[var(--accent)] [.webapp-theme_&]:not-disabled:hover:bg-[var(--accent-deep)]',
            // 禁用态（mockup .send-btn[disabled]）：浅灰底三级灰图标（variant primary 的蓝色调禁用态在作用域内覆盖）
            '[.webapp-theme_&]:disabled:bg-[var(--bg-soft)] [.webapp-theme_&]:disabled:text-[var(--text-3)]',
            // mockup .send-btn 30×30（size medium 的 32px 在作用域内收一档；停止态同色底仅换 ■ 图标）
            '[.webapp-theme_&]:size-[30px]',
          )}
          variant="primary"
          disabled={readonly || (!isStop && disabled)}
          loading={!isStop && sendButtonLoading}
          onClick={isStop ? onStopResponding : onSend}
        >
          {isStop ? (
            <span className="size-3 rounded-[2.5px] bg-current" aria-hidden="true" />
          ) : (
            sendButtonLabel || (
              <>
                {/* mockup 发送钮 ↑（作用域内）；无作用域沿用 paper-plane（console 零影响） */}
                <span
                  className="i-ri-arrow-up-line hidden size-4 [.webapp-theme_&]:block"
                  aria-hidden="true"
                />
                <span
                  className="i-ri-send-plane-2-fill size-4 [.webapp-theme_&]:hidden"
                  aria-hidden="true"
                />
              </>
            )
          )}
        </Button>
      </div>
    </div>
  )
}
Operation.displayName = 'Operation'

export default memo(Operation)
