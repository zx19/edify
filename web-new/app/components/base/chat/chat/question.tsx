import type { FC, ReactNode } from 'react'
import type { Theme } from '../embedded-chatbot/theme/theme'
import type { ChatItem } from '../types'
import { Button } from '@xsl/lomva-ui/button'
import { cn } from '@xsl/lomva-ui/cn'
import { IconButton } from '@xsl/lomva-ui/icon-button'
import { toast } from '@xsl/lomva-ui/toast'
import copy from 'copy-to-clipboard'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Textarea from 'react-textarea-autosize'
import { FileList } from '@/app/components/base/file-uploader'
import { Markdown } from '@/app/components/base/markdown'
import ContentSwitch from './content-switch'
import { useChatContext } from './context'

type QuestionProps = {
  item: ChatItem
  questionIcon?: ReactNode
  /** @deprecated createTheme 气泡着色已由 token 双层（--chat-bubble-user-bg/fg）替代，prop 仅保留签名兼容 */
  theme?: Theme | null | undefined
  enableEdit?: boolean
  switchSibling?: (siblingMessageId: string) => void
  hideAvatar?: boolean
}

/**
 * 用户消息气泡（chat 单元重写，mockup 类型1）：
 * - 气泡色走 token 双层：:root = Dify 蓝（#e1effe，console 不变）；.webapp-theme 作用域 = 黑底白字（dark 反色）
 * - hover 气泡下方出操作行（复制/编辑后重发），原绝对定位 + contentWidth 测量机废弃
 * - 编辑态内联 textarea + 保存重发/取消（IME 组合输入处理保留）
 */
const Question: FC<QuestionProps> = ({
  item,
  questionIcon,
  enableEdit = true,
  switchSibling,
  hideAvatar,
}) => {
  const { t } = useTranslation()

  const { content, message_files } = item

  const { onRegenerate } = useChatContext()
  const copyLabel = t(($) => $['operation.copy'], { ns: 'common' })
  const editLabel = t(($) => $['operation.edit'], { ns: 'common' })

  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(content)
  const isComposingRef = useRef(false)
  const compositionEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleEdit = useCallback(() => {
    setIsEditing(true)
    setEditedContent(content)
  }, [content])

  const handleResend = useCallback(() => {
    if (compositionEndTimerRef.current) {
      clearTimeout(compositionEndTimerRef.current)
      compositionEndTimerRef.current = null
    }
    isComposingRef.current = false
    setIsEditing(false)
    onRegenerate?.(item, { message: editedContent, files: message_files })
  }, [editedContent, message_files, item, onRegenerate])

  const handleCancelEditing = useCallback(() => {
    if (compositionEndTimerRef.current) {
      clearTimeout(compositionEndTimerRef.current)
      compositionEndTimerRef.current = null
    }
    isComposingRef.current = false
    setIsEditing(false)
    setEditedContent(content)
  }, [content])

  const handleEditInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== 'Enter' || e.shiftKey) return

      if (e.nativeEvent.isComposing) return

      if (isComposingRef.current) {
        e.preventDefault()
        return
      }

      e.preventDefault()
      handleResend()
    },
    [handleResend],
  )

  const clearCompositionEndTimer = useCallback(() => {
    if (!compositionEndTimerRef.current) return

    clearTimeout(compositionEndTimerRef.current)
    compositionEndTimerRef.current = null
  }, [])

  const handleCompositionStart = useCallback(() => {
    clearCompositionEndTimer()
    isComposingRef.current = true
  }, [clearCompositionEndTimer])

  const handleCompositionEnd = useCallback(() => {
    clearCompositionEndTimer()
    compositionEndTimerRef.current = setTimeout(() => {
      isComposingRef.current = false
      compositionEndTimerRef.current = null
    }, 50)
  }, [clearCompositionEndTimer])

  const handleSwitchSibling = useCallback(
    (direction: 'prev' | 'next') => {
      if (direction === 'prev') {
        if (item.prevSibling) switchSibling?.(item.prevSibling)
      } else {
        if (item.nextSibling) switchSibling?.(item.nextSibling)
      }
    },
    [switchSibling, item.prevSibling, item.nextSibling],
  )

  useEffect(() => {
    return () => {
      clearCompositionEndTimer()
    }
  }, [clearCompositionEndTimer])

  return (
    <div className="mb-2 flex justify-end last:mb-0">
      <div
        className={cn(
          'group mr-4 flex max-w-full flex-col items-end overflow-x-hidden pl-14',
          isEditing && 'flex-1',
        )}
      >
        <div
          data-testid="question-content"
          className={cn(
            'w-full px-4 py-3 text-sm',
            !isEditing && 'rounded-[14px_14px_4px_14px]',
            isEditing &&
              'rounded-2xl border-2 border-[color:var(--accent,var(--color-components-option-card-option-selected-border))] bg-components-panel-bg-blur shadow-lg',
          )}
          style={
            !isEditing
              ? { background: 'var(--chat-bubble-user-bg)', color: 'var(--chat-bubble-user-fg)' }
              : {}
          }
        >
          {!!message_files?.length && (
            <FileList
              className={cn(isEditing ? 'mb-3' : 'mb-2')}
              files={message_files}
              showDeleteAction={false}
              showDownloadAction={true}
            />
          )}
          {!isEditing ? (
            <Markdown content={content} />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="max-h-39.5 overflow-x-hidden overflow-y-auto pr-1">
                <Textarea
                  className={cn(
                    'w-full resize-none bg-transparent p-0 body-lg-regular leading-7 text-text-primary outline-hidden',
                  )}
                  autoFocus
                  minRows={1}
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  onKeyDown={handleEditInputKeyDown}
                  onCompositionStart={handleCompositionStart}
                  onCompositionEnd={handleCompositionEnd}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button className="min-w-24" onClick={handleCancelEditing}>
                  {t(($) => $['operation.cancel'], { ns: 'common' })}
                </Button>
                <Button className="min-w-24" variant="primary" onClick={handleResend}>
                  {t(($) => $['operation.save'], { ns: 'common' })}
                </Button>
              </div>
            </div>
          )}
        </div>
        {!isEditing && (
          <div
            data-testid="action-container"
            className="mt-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <IconButton
              aria-label={copyLabel}
              onClick={() => {
                copy(content)
                toast.success(t(($) => $['actionMsg.copySuccessfully'], { ns: 'common' }))
              }}
            >
              <div className="i-ri-clipboard-line size-4" aria-hidden="true" />
            </IconButton>
            {enableEdit && (
              <IconButton aria-label={editLabel} onClick={handleEdit}>
                <div className="i-ri-edit-line size-4" aria-hidden="true" />
              </IconButton>
            )}
          </div>
        )}
        {!isEditing && (
          <ContentSwitch
            count={item.siblingCount}
            currentIndex={item.siblingIndex}
            prevDisabled={!item.prevSibling}
            nextDisabled={!item.nextSibling}
            switchSibling={handleSwitchSibling}
          />
        )}
      </div>
      {!hideAvatar && (
        <div className="size-10 shrink-0">
          {questionIcon || (
            <div className="h-full w-full rounded-full border-[0.5px] border-black/5">
              <span
                aria-hidden
                className="question-default-user-icon i-custom-public-avatar-user size-full"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default memo(Question)
