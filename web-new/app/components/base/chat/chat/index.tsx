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
  /**
   * 空态欢迎屏布局（chat 单元重写，mockup 类型1）：滚动容器切换为整屏流，
   * 消息列隐藏、chatNode 成居中欢迎列、输入区从底部 dock 变为流内居中。
   * 仅条件类名切换——DOM 结构与 ChatInputArea 实例位置不变（保草稿与焦点）。
   */
  centeredInput?: boolean
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
  centeredInput = false,
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
      centeredInput,
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
      <div
        data-testid="chat-root"
        className={cn(
          'h-full',
          centeredInput
            ? // 欢迎屏：整屏滚动流（mx-auto/mt-auto + footer 的 mb-auto 双自动外边距对分余量=整体垂直居中）
              'flex flex-col overflow-x-hidden overflow-y-auto'
            : 'relative',
          isTryApp && 'flex flex-col',
        )}
      >
        <div
          data-testid="chat-container"
          ref={chatContainerRef}
          className={cn(
            'relative overflow-x-hidden',
            centeredInput
              ? // 欢迎屏：自身成居中列（不可再 h-full/内部滚动，滚动在 chat-root）
                'mx-auto mt-auto w-full max-w-[720px] shrink-0 overflow-y-visible'
              : 'h-full overflow-y-auto',
            isTryApp && 'h-0 grow',
            chatContainerClassName,
          )}
        >
          {chatNode}
          {/* 消息列（mockup chat-col）：720px 居中，flex-col gap-26px 驱动消息间距（消息自身不再带 mb）；欢迎屏态隐藏（无可见消息） */}
          <div
            ref={chatContainerInnerRef}
            className={cn(
              'mx-auto w-full max-w-[720px] flex-col gap-[26px]',
              !noSpacing && 'px-6 pt-7 pb-5',
              // 欢迎屏态隐藏消息列（无可见消息）;hidden/flex 互斥分支,避免同类工具冲突
              centeredInput ? 'hidden' : 'flex',
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
            'pointer-events-none z-10 flex justify-center',
            centeredInput
              ? // 欢迎屏：流内居中（去 absolute/渐变罩；mb-auto 与容器 mt-auto 对分余量）
                'static mx-auto mt-6 mb-auto w-full max-w-[720px] shrink-0 px-4 pb-7 sm:px-6 sm:pb-10'
              : 'absolute bottom-0 bg-chat-input-mask',
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
