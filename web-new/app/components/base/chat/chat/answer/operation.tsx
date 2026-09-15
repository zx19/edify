import type { ReactElement, ReactNode } from 'react'
import type { ChatItem, Feedback } from '../../types'
import { Button } from '@xsl/lomva-ui/button'
import { cn } from '@xsl/lomva-ui/cn'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@xsl/lomva-ui/dialog'
import { IconButton } from '@xsl/lomva-ui/icon-button'
import { Textarea } from '@xsl/lomva-ui/textarea'
import { toast } from '@xsl/lomva-ui/toast'
import { Toggle } from '@xsl/lomva-ui/toggle'
import { Tooltip, TooltipContent, TooltipTrigger } from '@xsl/lomva-ui/tooltip'
import copy from 'copy-to-clipboard'
import { memo, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import EditReplyModal from '@/app/components/app/annotation/edit-annotation-modal'
import Log from '@/app/components/base/chat/chat/log'
import AnnotationCtrlButton from '@/app/components/base/features/new-feature-panel/annotation-reply/annotation-ctrl-button'
import NewAudioButton from '@/app/components/base/new-audio-button'
import { useChatContext } from '../context'

type OperationProps = {
  item: ChatItem
  question: string
  index: number
  showPromptLog?: boolean
  noChatInput?: boolean
}

/** @deprecated chat 单元重写后操作条固定为回答左下流内行，不再支持定位（保留导出兼容 ChatProps 签名） */
export type AnswerActionPosition = 'auto' | 'below'

type FeedbackTooltipProps = {
  content: ReactNode
  children: ReactElement
}

const feedbackTooltipClassName = 'max-w-[260px]'
const accentPressedClassName =
  'data-pressed:bg-state-accent-active data-pressed:text-text-accent data-pressed:hover:bg-state-accent-active-alt'
const destructivePressedClassName =
  'data-pressed:bg-state-destructive-hover data-pressed:text-text-destructive data-pressed:hover:bg-state-destructive-hover data-pressed:hover:text-text-destructive'

function joinPublicContent(blocks: Array<string | undefined>) {
  return blocks.filter((block): block is string => !!block?.trim()).join('\n\n')
}

function getPublicResponseContent(item: ChatItem) {
  if (item.content.trim()) return item.content

  const responseContent = joinPublicContent(
    item.agent_response_parts?.map((part) =>
      part.type === 'message' ? part.content : undefined,
    ) ?? [],
  )
  if (responseContent) return responseContent

  return joinPublicContent(item.agent_thoughts?.map((thought) => thought.answer) ?? [])
}

const FeedbackTooltip = ({ content, children }: FeedbackTooltipProps) => {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent className={feedbackTooltipClassName}>{content}</TooltipContent>
    </Tooltip>
  )
}

/**
 * 消息操作条（chat 单元重写，mockup 类型1 消息区）：
 * 回答左下流内行——赞同/反对（反馈弹窗）、复制、重新生成、朗读（TTS 开启时）、标注、日志；
 * 原绝对定位 + 宽度计算机（operationWidth/positionRight）随 mockup 行式布局废弃。
 * 交互行为全保留（反馈覆盖态/tooltip/弹窗/复制 toast/标注流）。
 */
function Operation({ item, question, index, showPromptLog, noChatInput }: OperationProps) {
  const { t } = useTranslation()
  const {
    config,
    onAnnotationAdded,
    onAnnotationEdited,
    onAnnotationRemoved,
    onFeedback,
    onRegenerate,
    showRegenerate,
    readonly,
  } = useChatContext()
  const [isShowReplyModal, setIsShowReplyModal] = useState(false)
  const [isShowFeedbackModal, setIsShowFeedbackModal] = useState(false)
  const [feedbackContent, setFeedbackContent] = useState('')
  const { id, isOpeningStatement, annotation, feedback, adminFeedback, humanInputFormDataList } =
    item
  const [userFeedbackOverride, setUserFeedbackOverride] = useState<Feedback>()
  const [adminFeedbackOverride, setAdminFeedbackOverride] = useState<Feedback>()
  const [feedbackTarget, setFeedbackTarget] = useState<'user' | 'admin'>('user')
  const feedbackTextareaId = useId()

  const content = getPublicResponseContent(item)
  const hasPublicContent = !!content.trim()

  const displayUserFeedback = userFeedbackOverride ?? feedback
  const displayAdminFeedback = adminFeedbackOverride ?? adminFeedback

  const hasUserFeedback = !!displayUserFeedback?.rating
  const hasAdminFeedback = !!displayAdminFeedback?.rating

  const shouldShowUserFeedbackBar =
    !isOpeningStatement && config?.supportFeedback && !!onFeedback && !config?.supportAnnotation
  const shouldShowAdminFeedbackBar =
    !isOpeningStatement && config?.supportFeedback && !!onFeedback && !!config?.supportAnnotation
  const canManageAnnotation =
    !readonly && !!onAnnotationAdded && !!onAnnotationEdited && !!onAnnotationRemoved
  const shouldShowAnnotationAction =
    canManageAnnotation &&
    hasPublicContent &&
    !!config?.supportAnnotation &&
    !!config.annotation_reply?.enabled &&
    !humanInputFormDataList?.length

  const userFeedbackLabel =
    t(($) => $['table.header.userRate'], { ns: 'appLog' }) || 'User feedback'
  const adminFeedbackLabel =
    t(($) => $['table.header.adminRate'], { ns: 'appLog' }) || 'Admin feedback'
  const likeLabel = t(($) => $['detail.operation.like'], { ns: 'appLog' }) || 'Like'
  const dislikeLabel = t(($) => $['detail.operation.dislike'], { ns: 'appLog' }) || 'Dislike'
  const copyLabel = t(($) => $['operation.copy'], { ns: 'common' }) || 'Copy'
  const regenerateLabel = t(($) => $['operation.regenerate'], { ns: 'common' }) || 'Regenerate'

  const buildFeedbackTooltip = (feedbackData?: Feedback | null, label = userFeedbackLabel) => {
    if (!feedbackData?.rating) return label

    const ratingLabel =
      feedbackData.rating === 'like'
        ? t(($) => $['detail.operation.like'], { ns: 'appLog' }) || 'like'
        : t(($) => $['detail.operation.dislike'], { ns: 'appLog' }) || 'dislike'
    const feedbackText = feedbackData.content?.trim()

    if (feedbackText) return `${label}: ${ratingLabel} - ${feedbackText}`

    return `${label}: ${ratingLabel}`
  }

  const handleFeedback = async (
    rating: 'like' | 'dislike' | null,
    content?: string,
    target: 'user' | 'admin' = 'user',
  ) => {
    if (!config?.supportFeedback || !onFeedback) return false

    try {
      await onFeedback(id, { rating, content })

      const nextFeedback = rating === null ? { rating: null } : { rating, content }

      if (target === 'admin') setAdminFeedbackOverride(nextFeedback)
      else setUserFeedbackOverride(nextFeedback)
      return true
    } catch {
      return false
    }
  }

  const handleLikeClick = (target: 'user' | 'admin') => {
    void handleFeedback('like', undefined, target)
  }

  const handleDislikeClick = (target: 'user' | 'admin') => {
    setFeedbackTarget(target)
    setIsShowFeedbackModal(true)
  }

  const handleFeedbackSubmit = async () => {
    const succeeded = await handleFeedback('dislike', feedbackContent, feedbackTarget)
    if (!succeeded) return

    setFeedbackContent('')
    setIsShowFeedbackModal(false)
  }

  const handleFeedbackCancel = () => {
    setFeedbackContent('')
    setIsShowFeedbackModal(false)
  }

  // mockup：常态下 hover 显现；已有反馈（赞/踩）时常显
  const hoverRevealClassName =
    hasUserFeedback || hasAdminFeedback
      ? ''
      : 'opacity-0 transition-opacity group-hover:opacity-100 group-has-[[data-popup-open]]:opacity-100'

  return (
    <>
      <div
        className={cn('flex items-center gap-0.5', hoverRevealClassName)}
        data-testid="operation-bar"
      >
        {shouldShowUserFeedbackBar && !humanInputFormDataList?.length && (
          <div className="flex items-center gap-0.5">
            {hasUserFeedback ? (
              <FeedbackTooltip
                content={buildFeedbackTooltip(displayUserFeedback, userFeedbackLabel)}
              >
                <Toggle
                  className={
                    displayUserFeedback?.rating === 'like'
                      ? accentPressedClassName
                      : destructivePressedClassName
                  }
                  pressed
                  onPressedChange={(pressed) =>
                    !pressed && void handleFeedback(null, undefined, 'user')
                  }
                  render={
                    <IconButton
                      aria-label={`${userFeedbackLabel}: ${displayUserFeedback?.rating === 'like' ? likeLabel : dislikeLabel}`}
                    >
                      {displayUserFeedback?.rating === 'like' ? (
                        <span aria-hidden="true" className="i-ri-thumb-up-line size-4" />
                      ) : (
                        <span aria-hidden="true" className="i-ri-thumb-down-line size-4" />
                      )}
                    </IconButton>
                  }
                />
              </FeedbackTooltip>
            ) : (
              <>
                <Toggle
                  className={accentPressedClassName}
                  pressed={false}
                  onPressedChange={(pressed) => pressed && handleLikeClick('user')}
                  render={
                    <IconButton aria-label={`${userFeedbackLabel}: ${likeLabel}`}>
                      <span aria-hidden="true" className="i-ri-thumb-up-line size-4" />
                    </IconButton>
                  }
                />
                <Toggle
                  className={destructivePressedClassName}
                  pressed={false}
                  onPressedChange={(pressed) => pressed && handleDislikeClick('user')}
                  render={
                    <IconButton aria-label={`${userFeedbackLabel}: ${dislikeLabel}`}>
                      <span aria-hidden="true" className="i-ri-thumb-down-line size-4" />
                    </IconButton>
                  }
                />
              </>
            )}
          </div>
        )}
        {shouldShowAdminFeedbackBar && !humanInputFormDataList?.length && (
          <div className="flex items-center gap-0.5">
            {displayUserFeedback?.rating && (
              <FeedbackTooltip
                content={buildFeedbackTooltip(displayUserFeedback, userFeedbackLabel)}
              >
                <span
                  role="img"
                  aria-label={buildFeedbackTooltip(displayUserFeedback, userFeedbackLabel)}
                  className={cn(
                    'inline-flex size-6 items-center justify-center rounded-lg p-0.5',
                    displayUserFeedback.rating === 'like'
                      ? 'bg-state-accent-active text-text-accent'
                      : 'bg-state-destructive-hover text-text-destructive',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'size-4',
                      displayUserFeedback.rating === 'like'
                        ? 'i-ri-thumb-up-line'
                        : 'i-ri-thumb-down-line',
                    )}
                  />
                </span>
              </FeedbackTooltip>
            )}

            {displayUserFeedback?.rating && (
              <div
                data-testid="feedback-separator"
                className="mx-1 h-3 w-[0.5px] bg-[var(--border)]"
              />
            )}
            {hasAdminFeedback ? (
              <FeedbackTooltip
                content={buildFeedbackTooltip(displayAdminFeedback, adminFeedbackLabel)}
              >
                <Toggle
                  className={
                    displayAdminFeedback?.rating === 'like'
                      ? accentPressedClassName
                      : destructivePressedClassName
                  }
                  pressed
                  onPressedChange={(pressed) =>
                    !pressed && void handleFeedback(null, undefined, 'admin')
                  }
                  render={
                    <IconButton
                      aria-label={`${adminFeedbackLabel}: ${displayAdminFeedback?.rating === 'like' ? likeLabel : dislikeLabel}`}
                    >
                      {displayAdminFeedback?.rating === 'like' ? (
                        <span aria-hidden="true" className="i-ri-thumb-up-line size-4" />
                      ) : (
                        <span aria-hidden="true" className="i-ri-thumb-down-line size-4" />
                      )}
                    </IconButton>
                  }
                />
              </FeedbackTooltip>
            ) : (
              <>
                <FeedbackTooltip
                  content={buildFeedbackTooltip(displayAdminFeedback, adminFeedbackLabel)}
                >
                  <Toggle
                    className={accentPressedClassName}
                    pressed={false}
                    onPressedChange={(pressed) => pressed && handleLikeClick('admin')}
                    render={
                      <IconButton aria-label={`${adminFeedbackLabel}: ${likeLabel}`}>
                        <span aria-hidden="true" className="i-ri-thumb-up-line size-4" />
                      </IconButton>
                    }
                  />
                </FeedbackTooltip>
                <FeedbackTooltip
                  content={buildFeedbackTooltip(displayAdminFeedback, adminFeedbackLabel)}
                >
                  <Toggle
                    className={destructivePressedClassName}
                    pressed={false}
                    onPressedChange={(pressed) => pressed && handleDislikeClick('admin')}
                    render={
                      <IconButton aria-label={`${adminFeedbackLabel}: ${dislikeLabel}`}>
                        <span aria-hidden="true" className="i-ri-thumb-down-line size-4" />
                      </IconButton>
                    }
                  />
                </FeedbackTooltip>
              </>
            )}
          </div>
        )}
        {showPromptLog && !isOpeningStatement && <Log logItem={item} />}
        {!isOpeningStatement && (
          <div className="flex items-center gap-0.5" data-testid="operation-actions">
            {config?.text_to_speech?.enabled &&
              hasPublicContent &&
              !humanInputFormDataList?.length && (
                <NewAudioButton id={id} value={content} voice={config?.text_to_speech?.voice} />
              )}
            {hasPublicContent && !humanInputFormDataList?.length && (
              <IconButton
                aria-label={copyLabel}
                onClick={() => {
                  copy(content)
                  toast.success(t(($) => $['actionMsg.copySuccessfully'], { ns: 'common' }))
                }}
              >
                <span aria-hidden="true" className="i-ri-clipboard-line size-4" />
              </IconButton>
            )}
            {(!noChatInput || showRegenerate) && (
              <IconButton aria-label={regenerateLabel} onClick={() => onRegenerate?.(item)}>
                <span aria-hidden="true" className="i-ri-reset-left-line size-4" />
              </IconButton>
            )}
            {shouldShowAnnotationAction && (
              <AnnotationCtrlButton
                appId={config?.appId || ''}
                messageId={id}
                cached={!!annotation?.id}
                query={question}
                answer={content}
                onAdded={(id, authorName) =>
                  onAnnotationAdded?.(id, authorName, question, content, index)
                }
                onEdit={() => setIsShowReplyModal(true)}
              />
            )}
          </div>
        )}
      </div>
      {canManageAnnotation && (
        <EditReplyModal
          isShow={isShowReplyModal}
          onHide={() => setIsShowReplyModal(false)}
          query={question}
          answer={content}
          onEdited={(editedQuery, editedAnswer) =>
            onAnnotationEdited?.(editedQuery, editedAnswer, index)
          }
          onAdded={(annotationId, authorName, editedQuery, editedAnswer) =>
            onAnnotationAdded?.(annotationId, authorName, editedQuery, editedAnswer, index)
          }
          appId={config?.appId || ''}
          messageId={id}
          annotationId={annotation?.id || ''}
          createdAt={annotation?.created_at}
          onRemove={() => onAnnotationRemoved?.(index)}
        />
      )}
      {isShowFeedbackModal && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) handleFeedbackCancel()
          }}
        >
          <DialogContent backdropProps={{ forceRender: true }} className="p-0">
            <div className="flex max-h-[80dvh] flex-col">
              <div className="relative shrink-0 p-6 pr-14 pb-3">
                <DialogTitle className="title-2xl-semi-bold text-text-primary">
                  {t(($) => $['feedback.title'], { ns: 'common' }) || 'Provide Feedback'}
                </DialogTitle>
                <DialogDescription className="mt-1 system-xs-regular text-text-tertiary">
                  {t(($) => $['feedback.subtitle'], { ns: 'common' }) ||
                    'Please tell us what went wrong with this response'}
                </DialogDescription>
                <DialogClose
                  render={
                    <IconButton
                      aria-label={t(($) => $['operation.close'], { ns: 'common' })}
                      size="lg"
                      className="absolute top-5 right-5"
                    >
                      <span aria-hidden className="i-ri-close-line size-4" />
                    </IconButton>
                  }
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
                <label
                  htmlFor={feedbackTextareaId}
                  className="mb-2 block system-sm-semibold text-text-secondary"
                >
                  {t(($) => $['feedback.content'], { ns: 'common' }) || 'Feedback Content'}
                </label>
                <Textarea
                  id={feedbackTextareaId}
                  name="feedback-content"
                  value={feedbackContent}
                  onValueChange={(value) => setFeedbackContent(value)}
                  placeholder={
                    t(($) => $['feedback.placeholder'], { ns: 'common' }) ||
                    'Please describe what went wrong or how we can improve…'
                  }
                  rows={4}
                  className="w-full"
                />
              </div>
              <div className="flex shrink-0 justify-end p-6 pt-5">
                <Button onClick={handleFeedbackCancel}>
                  {t(($) => $['operation.cancel'], { ns: 'common' }) || 'Cancel'}
                </Button>
                <Button className="ml-2" variant="primary" onClick={handleFeedbackSubmit}>
                  {t(($) => $['operation.submit'], { ns: 'common' }) || 'Submit'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

export default memo(Operation)
