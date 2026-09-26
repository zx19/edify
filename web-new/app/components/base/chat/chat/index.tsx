import type { FC, ReactNode } from 'react'
import type { Theme } from '../embedded-chatbot/theme/theme'
import type { ChatConfig, ChatItem, OnFeedback, OnRegenerate, OnSend } from '../types'
import type { HumanInputFormSubmitData } from './answer/human-input-content/type'
import type { AnswerActionPosition } from './answer/operation'
import type { InputForm } from './type'
import type { SpeechToTextTarget } from '@/app/components/base/voice-input/types'
import type { HumanInputNodeType } from '@/app/components/workflow/nodes/human-input/types'
import type { Node } from '@/app/components/workflow/types'
import type { AppData, ToolIcon } from '@/models/share'
import { cn } from '@xsl/lomva-ui/cn'
import { memo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore as useAppStore } from '@/app/components/app/store'
import Answer from './answer'
import ChatInputArea from './chat-input-area'
import ChatLogModals from './chat-log-modals'
import { ChatContextProvider } from './context-provider'
import Question from './question'
import TryToAsk from './try-to-ask'
import { useChatLayout } from './use-chat-layout'

export type ChatProps = {
  answerActionPosition?: AnswerActionPosition
  isTryApp?: boolean
  readonly?: boolean
  appData?: AppData
  chatList: ChatItem[]
  config?: ChatConfig
  isResponding?: boolean
  noStopResponding?: boolean
  onStopResponding?: () => void
  noChatInput?: boolean
  showRegenerate?: boolean
  onSend?: OnSend
  inputs?: Record<string, unknown>
  inputsForm?: InputForm[]
  onRegenerate?: OnRegenerate
  chatContainerClassName?: string
  chatContainerInnerClassName?: string
  chatFooterClassName?: string
  chatFooterInnerClassName?: string
  suggestedQuestions?: string[]
  showPromptLog?: boolean
  questionIcon?: ReactNode
  answerIcon?: ReactNode
  allToolIcons?: Record<string, ToolIcon>
  onAnnotationEdited?: (question: string, answer: string, index: number) => void
  onAnnotationAdded?: (
    annotationId: string,
    authorName: string,
    question: string,
    answer: string,
    index: number,
  ) => void
  onAnnotationRemoved?: (index: number) => void
  chatNode?: ReactNode
  disableFeedback?: boolean
  onFeedback?: OnFeedback
  chatAnswerContainerInner?: string
  hideProcessDetail?: boolean
  hideLogModal?: boolean
  theme?: Theme
  switchSibling?: (siblingMessageId: string) => void
  showFeatureBar?: boolean
  showFileUpload?: boolean
  featureBarReadonly?: boolean
  onFeatureBarClick?: (state: boolean) => void
  noSpacing?: boolean
  inputDisabled?: boolean
  inputPlaceholder?: string
  inputPlaceholderBotName?: string
  sendButtonLabel?: string
  sendButtonLoading?: boolean
  footerNotice?: ReactNode
  footerNoticeTooltip?: ReactNode
  sidebarCollapseState?: boolean
  hideAvatar?: boolean
  sendOnEnter?: boolean
  speechToTextTarget?: SpeechToTextTarget
  onBeforeSpeechToText?: () => Promise<unknown>
  renderAgentContent?: (props: {
    item: ChatItem
    responding?: boolean
    content?: string
  }) => ReactNode
  onHumanInputFormSubmit?: (formToken: string, formData: HumanInputFormSubmitData) => Promise<void>
  getHumanInputNodeData?: (nodeID: string) => Node<HumanInputNodeType> | undefined
}

const Chat: FC<ChatProps> = ({
  answerActionPosition,
  isTryApp,
  readonly = false,
  appData,
  config,
  onSend,
  inputs,
  inputsForm,
  onRegenerate,
  chatList,
  isResponding,
  noStopResponding,
  onStopResponding,
  noChatInput,
  showRegenerate,
  chatContainerClassName,
  chatContainerInnerClassName,
  chatFooterClassName,
  chatFooterInnerClassName,
  suggestedQuestions,
  showPromptLog,
  questionIcon,
  answerIcon,
  onAnnotationAdded,
  onAnnotationEdited,
  onAnnotationRemoved,
  chatNode,
  disableFeedback,
  onFeedback,
  chatAnswerContainerInner,
  hideProcessDetail,
  hideLogModal,
  theme,
  switchSibling,
  showFeatureBar,
  showFileUpload,
  featureBarReadonly,
  onFeatureBarClick,
  noSpacing,
  inputDisabled,
  inputPlaceholder,
  inputPlaceholderBotName,
  sendButtonLabel,
  sendButtonLoading,
  footerNotice,
  footerNoticeTooltip,
  sidebarCollapseState,
  hideAvatar,
  sendOnEnter,
  speechToTextTarget,
  onBeforeSpeechToText,
  renderAgentContent,
  onHumanInputFormSubmit,
  getHumanInputNodeData,
  // noStopResponding/onStopResponding：D4 已由发送键双态承接（Task 6）——透传至 ChatInputArea，
  // noStopResponding=true 时摘下停止句柄（发送键保持发送语义）
}) => {
  const {
    currentLogItem,
    setCurrentLogItem,
    showPromptLogModal,
    setShowPromptLogModal,
    showAgentLogModal,
    setShowAgentLogModal,
  } = useAppStore(
    useShallow((state) => ({
      currentLogItem: state.currentLogItem,
      setCurrentLogItem: state.setCurrentLogItem,
      showPromptLogModal: state.showPromptLogModal,
      setShowPromptLogModal: state.setShowPromptLogModal,
      showAgentLogModal: state.showAgentLogModal,
      setShowAgentLogModal: state.setShowAgentLogModal,
    })),
  )
  const { width, chatContainerRef, chatContainerInnerRef, chatFooterRef, chatFooterInnerRef } =
    useChatLayout({
      chatList,
      sidebarCollapseState,
    })

  const hasTryToAsk =
    config?.suggested_questions_after_answer?.enabled && !!suggestedQuestions?.length && onSend

  return (
    <ChatContextProvider
      readonly={readonly}
      config={config}
      chatList={chatList}
      isResponding={isResponding}
      showPromptLog={showPromptLog}
      questionIcon={questionIcon}
      answerIcon={answerIcon}
      onSend={onSend}
      onRegenerate={onRegenerate}
      showRegenerate={showRegenerate}
      onAnnotationAdded={onAnnotationAdded}
      onAnnotationEdited={onAnnotationEdited}
      onAnnotationRemoved={onAnnotationRemoved}
      disableFeedback={disableFeedback}
      onFeedback={onFeedback}
      getHumanInputNodeData={getHumanInputNodeData}
    >
      <div data-testid="chat-root" className={cn('relative h-full', isTryApp && 'flex flex-col')}>
        <div
          data-testid="chat-container"
          ref={chatContainerRef}
          className={cn(
            'relative h-full overflow-x-hidden overflow-y-auto',
            isTryApp && 'h-0 grow',
            chatContainerClassName,
          )}
        >
          {chatNode}
          {/* 消息列（mockup chat-col）：720px 居中，flex-col gap-26px 驱动消息间距（消息自身不再带 mb） */}
          <div
            ref={chatContainerInnerRef}
            className={cn(
              'mx-auto flex w-full max-w-[720px] flex-col gap-[26px]',
              !noSpacing && 'px-6 pt-7 pb-5',
              chatContainerInnerClassName,
              isTryApp && 'px-0',
            )}
          >
            {chatList.map((item, index) => {
              if (item.isAnswer) {
                const isLast = item.id === chatList.at(-1)?.id
                return (
                  <Answer
                    answerActionPosition={answerActionPosition}
                    appData={appData}
                    key={item.id}
                    item={item}
                    question={chatList[index - 1]?.content ?? ''}
                    index={index}
                    config={config}
                    answerIcon={answerIcon}
                    responding={isLast && isResponding}
                    showPromptLog={showPromptLog}
                    chatAnswerContainerInner={chatAnswerContainerInner}
                    hideProcessDetail={hideProcessDetail}
                    noChatInput={noChatInput}
                    switchSibling={switchSibling}
                    hideAvatar={hideAvatar}
                    renderAgentContent={renderAgentContent}
                    onHumanInputFormSubmit={onHumanInputFormSubmit}
                  />
                )
              }
              return (
                <Question
                  key={item.id}
                  item={item}
                  questionIcon={questionIcon}
                  theme={theme}
                  enableEdit={config?.questionEditEnable}
                  switchSibling={switchSibling}
                  hideAvatar={hideAvatar}
                />
              )
            })}
          </div>
        </div>
        <div
          data-testid="chat-footer"
          className={cn(
            'pointer-events-none absolute bottom-0 z-10 flex justify-center bg-chat-input-mask',
            (hasTryToAsk || !noChatInput) && chatFooterClassName,
          )}
          ref={chatFooterRef}
        >
          <div
            ref={chatFooterInnerRef}
            className={cn(
              'pointer-events-none relative',
              chatFooterInnerClassName,
              isTryApp && 'px-0',
            )}
          >
            {hasTryToAsk && <TryToAsk suggestedQuestions={suggestedQuestions} onSend={onSend} />}
            {!noChatInput && (
              <ChatInputArea
                botName={inputPlaceholderBotName || appData?.site?.title || 'Bot'}
                customPlaceholder={inputPlaceholder ?? appData?.site?.input_placeholder}
                disabled={inputDisabled}
                showFeatureBar={showFeatureBar}
                showFileUpload={showFileUpload}
                featureBarReadonly={featureBarReadonly}
                featureBarDisabled={isResponding}
                onFeatureBarClick={onFeatureBarClick}
                visionConfig={config?.file_upload}
                speechToTextConfig={config?.speech_to_text}
                speechToTextTarget={speechToTextTarget}
                onBeforeSpeechToText={onBeforeSpeechToText}
                onSend={onSend}
                onStopResponding={noStopResponding ? undefined : onStopResponding}
                inputs={inputs}
                inputsForm={inputsForm}
                theme={theme}
                isResponding={isResponding}
                readonly={readonly}
                sendButtonLabel={sendButtonLabel}
                sendButtonLoading={sendButtonLoading}
                footerNotice={footerNotice}
                footerNoticeTooltip={footerNoticeTooltip}
                sendOnEnter={sendOnEnter}
              />
            )}
          </div>
        </div>
        <ChatLogModals
          width={width}
          currentLogItem={currentLogItem}
          showPromptLogModal={showPromptLogModal}
          showAgentLogModal={showAgentLogModal}
          hideLogModal={hideLogModal}
          setCurrentLogItem={setCurrentLogItem}
          setShowPromptLogModal={setShowPromptLogModal}
          setShowAgentLogModal={setShowAgentLogModal}
        />
      </div>
    </ChatContextProvider>
  )
}

export default memo(Chat)
