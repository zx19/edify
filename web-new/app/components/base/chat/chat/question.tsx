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
  /** @deprecated D3 去头像：prop 仅保留签名兼容，不再渲染 */
  questionIcon?: ReactNode
  /** @deprecated createTheme 气泡着色已随双层时代退役（胶囊走 var(--bg-soft)/var(--text-1)），prop 仅保留签名兼容 */
  theme?: Theme | null | undefined
  enableEdit?: boolean
  switchSibling?: (siblingMessageId: string) => void
  /** @deprecated D3 去头像：prop 仅保留签名兼容，不再渲染 */
  hideAvatar?: boolean
}

/**
 * 用户消息（chat 单元回炉，mockup 类型1 消息区）：
 * - 右置浅灰胶囊：bg-soft / radius 12 / max-75% / text-1，单实现消费 var token（黑底气泡双层时代结束）
 * - D3 去头像：questionIcon/hideAvatar 契约暂留不渲染
 * - hover/focus 胶囊下出操作行（复制/编辑后重发 + 同问多答切换），编辑 → mockup edit-box 内联 textarea 保存重发
 * - 编辑逻辑（IME 组合输入处理）不动
 */
const Question: FC<QuestionProps> = ({ item, enableEdit = true, switchSibling }) => {
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
    <div className="group/question flex flex-col items-end">
      <div
        data-testid="question-content"
        className={cn(
          'text-[14px] leading-[1.65] text-[var(--text-1)]',
          !isEditing &&
            'w-fit max-w-[75%] rounded-[12px] bg-[var(--bg-soft)] px-3.5 py-2.5 whitespace-pre-wrap',
          // mockup edit-box：min(560px,100%) 边框卡，保存重发/取消
          isEditing &&
            'w-[min(560px,100%)] rounded-[12px] border border-[var(--border-strong)] bg-[var(--card)] px-3 py-2.5',
        )}
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
          <div className="flex flex-col gap-2">
            <div className="max-h-39.5 overflow-x-hidden overflow-y-auto pr-1">
              <Textarea
                className={cn(
                  'w-full resize-none bg-transparent p-0 leading-[1.6] text-[var(--text-1)] outline-hidden',
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
          className="mt-1.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/question:opacity-100 focus-within:opacity-100"
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
          <ContentSwitch
            count={item.siblingCount}
            currentIndex={item.siblingIndex}
            prevDisabled={!item.prevSibling}
            nextDisabled={!item.nextSibling}
            switchSibling={handleSwitchSibling}
          />
        </div>
      )}
    </div>
  )
}

export default memo(Question)
