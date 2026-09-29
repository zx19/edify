import type { FileEntity } from '../../file-uploader/types'
import type { SpeechToTextTarget } from '../../voice-input/types'
import type { ChatConfig, ChatItem, ChatItemInTree, OnSend } from '../types'
import { Avatar } from '@xsl/lomva-ui/avatar'
import { cn } from '@xsl/lomva-ui/cn'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { trackWebAppEvent } from '@/app/components/base/amplitude/web-app-event'
import AnswerIcon from '@/app/components/base/answer-icon'
import AppIcon from '@/app/components/base/app-icon'
import InputsForm from '@/app/components/base/chat/chat-with-history/inputs-form'
import { Markdown } from '@/app/components/base/markdown'
import { InputVarType } from '@/app/components/workflow/types'
import { resolveUiConfig } from '@/models/ui-config'
import {
  AppSourceType,
  fetchChatList,
  fetchSuggestedQuestions,
  getUrl,
  stopChatMessageResponding,
  submitHumanInputForm,
} from '@/service/share'
import { submitHumanInputForm as submitHumanInputFormService } from '@/service/workflow'
import { TransferMethod } from '@/types/app'
import { formatBooleanInputs } from '@/utils/model-config'
import Chat from '../chat'
import { useChat } from '../chat/hooks'
import { getLastAnswer, isValidGeneratedAnswer } from '../utils'
import { useChatWithHistoryContext } from './context'

const ChatWrapper = () => {
  const { t } = useTranslation()
  const {
    appParams,
    appPrevChatTree,
    currentConversationId,
    currentConversationItem,
    currentConversationInputs,
    inputsForms,
    newConversationInputs,
    newConversationInputsRef,
    handleNewConversationCompleted,
    isMobile,
    isInstalledApp,
    appId,
    appMeta,
    handleFeedback,
    currentChatInstanceRef,
    appData,
    clearChatList,
    setClearChatList,
    setIsResponding,
    allInputsHidden,
    initUserVariables,
    isNewAgent,
    renderAgentContent,
  } = useChatWithHistoryContext()

  const appSourceType = isInstalledApp ? AppSourceType.installedApp : AppSourceType.webApp
  const timezone =
    appSourceType === AppSourceType.webApp
      ? new Intl.DateTimeFormat().resolvedOptions().timeZone
      : undefined

  // Semantic variable for better code readability
  const isHistoryConversation = !!currentConversationId

  const appConfig = useMemo(() => {
    const config = appParams || {}

    return {
      ...config,
      file_upload: {
        ...(config as any).file_upload,
        fileUploadConfig: (config as any).system_parameters,
      },
      supportFeedback: true,
      opening_statement: currentConversationItem?.introduction || (config as any).opening_statement,
    } as ChatConfig
  }, [appParams, currentConversationItem?.introduction])
  const {
    chatList,
    handleSend,
    handleStop,
    handleSwitchSibling,
    prepareHumanInputSubmission,
    isResponding: respondingState,
    suggestedQuestions,
  } = useChat(
    appConfig,
    {
      inputs: (currentConversationId ? currentConversationInputs : newConversationInputs) as any,
      inputsForm: inputsForms,
    },
    appPrevChatTree,
    (taskId) => stopChatMessageResponding('', taskId, appSourceType, appId),
    clearChatList,
    setClearChatList,
    undefined,
    { isNewAgent, timezone },
  )
  const inputsFormValue = currentConversationId
    ? currentConversationInputs
    : newConversationInputsRef?.current
  const inputDisabled = useMemo(() => {
    if (allInputsHidden) return false

    let hasEmptyInput = ''
    let fileIsUploading = false
    const requiredVars = inputsForms.filter(
      ({ required, type }) => required && type !== InputVarType.checkbox,
    )
    if (requiredVars.length) {
      requiredVars.forEach(({ variable, label, type }) => {
        if (hasEmptyInput) return

        if (fileIsUploading) return

        if (!inputsFormValue?.[variable]) hasEmptyInput = label as string

        if (
          (type === InputVarType.singleFile || type === InputVarType.multiFiles) &&
          inputsFormValue?.[variable]
        ) {
          const files = inputsFormValue[variable]
          if (Array.isArray(files))
            fileIsUploading = files.find(
              (item) => item.transferMethod === TransferMethod.local_file && !item.uploadedId,
            )
          else
            fileIsUploading =
              files.transferMethod === TransferMethod.local_file && !files.uploadedId
        }
      })
    }
    if (hasEmptyInput) return true

    if (fileIsUploading) return true

    if (
      chatList.some(
        (item) =>
          item.isAnswer && item.humanInputFormDataList && item.humanInputFormDataList.length > 0,
      )
    )
      return true
    return false
  }, [allInputsHidden, inputsForms, chatList, inputsFormValue])

  useEffect(() => {
    if (currentChatInstanceRef.current) currentChatInstanceRef.current.handleStop = handleStop
  }, [])

  useEffect(() => {
    setIsResponding(respondingState)
  }, [respondingState, setIsResponding])

  // Resume paused workflows when chat history is loaded
  useEffect(() => {
    if (!appPrevChatTree || appPrevChatTree.length === 0) return

    // Find the last answer item with workflow_run_id that needs resumption (DFS - find deepest first)
    let lastPausedNode: ChatItemInTree | undefined
    const findLastPausedWorkflow = (nodes: ChatItemInTree[]) => {
      nodes.forEach((node) => {
        // DFS: recurse to children first
        if (node.children && node.children.length > 0) findLastPausedWorkflow(node.children)

        // Track the last node with humanInputFormDataList
        if (
          node.isAnswer &&
          node.workflow_run_id &&
          node.humanInputFormDataList &&
          node.humanInputFormDataList.length > 0
        )
          lastPausedNode = node
      })
    }

    findLastPausedWorkflow(appPrevChatTree)

    // Only resume the last paused workflow
    if (lastPausedNode) {
      handleSwitchSibling(lastPausedNode.id, {
        onGetSuggestedQuestions: (responseItemId) =>
          fetchSuggestedQuestions(responseItemId, appSourceType, appId),
        onConversationComplete: currentConversationId ? undefined : handleNewConversationCompleted,
        isPublicAPI: appSourceType === AppSourceType.webApp,
      })
    }
  }, [])

  const [hasSent, setHasSent] = useState(false)
  const [prevConversationId, setPrevConversationId] = useState(currentConversationId)
  if (prevConversationId !== currentConversationId) {
    setPrevConversationId(currentConversationId)
    if (!currentConversationId) setHasSent(false)
  }

  const doSend: OnSend = useCallback(
    (message, files, isRegenerate = false, parentAnswer: ChatItem | null = null) => {
      if (!currentConversationId) setHasSent(true)
      const data: any = {
        query: message,
        files,
        inputs: formatBooleanInputs(
          inputsForms,
          currentConversationId ? currentConversationInputs : newConversationInputs,
        ),
        conversation_id: currentConversationId,
        parent_message_id: (isRegenerate ? parentAnswer?.id : getLastAnswer(chatList)?.id) || null,
      }

      handleSend(getUrl('chat-messages', appSourceType, appId || ''), data, {
        onGetConversationMessages: isNewAgent
          ? (conversationId) => fetchChatList(conversationId, appSourceType, appId)
          : undefined,
        onGetSuggestedQuestions: (responseItemId) =>
          fetchSuggestedQuestions(responseItemId, appSourceType, appId),
        onConversationComplete: isHistoryConversation ? undefined : handleNewConversationCompleted,
        isPublicAPI: appSourceType === AppSourceType.webApp,
      })
      const appMode = isNewAgent ? 'agent-v2' : appData?.mode
      if (appSourceType === AppSourceType.webApp && appMode)
        trackWebAppEvent('webapp_run', { app_mode: appMode })
    },
    [
      inputsForms,
      currentConversationId,
      currentConversationInputs,
      newConversationInputs,
      chatList,
      handleSend,
      appSourceType,
      appId,
      isHistoryConversation,
      handleNewConversationCompleted,
      isNewAgent,
      appData?.mode,
    ],
  )

  const doRegenerate = useCallback(
    (chatItem: ChatItem, editedQuestion?: { message: string; files?: FileEntity[] }) => {
      const question = editedQuestion
        ? chatItem
        : chatList.find((item) => item.id === chatItem.parentMessageId)!
      const parentAnswer = chatList.find((item) => item.id === question.parentMessageId)
      doSend(
        editedQuestion ? editedQuestion.message : question.content,
        editedQuestion ? editedQuestion.files : question.message_files,
        true,
        isValidGeneratedAnswer(parentAnswer) ? parentAnswer : null,
      )
    },
    [chatList, doSend],
  )

  const doSwitchSibling = useCallback(
    (siblingMessageId: string) => {
      handleSwitchSibling(siblingMessageId, {
        onGetSuggestedQuestions: (responseItemId) =>
          fetchSuggestedQuestions(responseItemId, appSourceType, appId),
        onConversationComplete: currentConversationId ? undefined : handleNewConversationCompleted,
        isPublicAPI: appSourceType === AppSourceType.webApp,
      })
    },
    [
      handleSwitchSibling,
      currentConversationId,
      handleNewConversationCompleted,
      appSourceType,
      appId,
    ],
  )

  const messageList = useMemo(() => {
    if (currentConversationId || chatList.length > 1) return chatList
    // Without messages we are in the welcome screen, so hide the opening statement from chatlist
    return chatList.filter((item) => !item.isOpeningStatement)
  }, [chatList, currentConversationId])

  const handleSubmitHumanInputForm = useCallback(
    async (formToken: string, formData: any) => {
      if (!(await prepareHumanInputSubmission())) return

      if (isInstalledApp) await submitHumanInputFormService(formToken, formData)
      else await submitHumanInputForm(formToken, formData)
    },
    [isInstalledApp, prepareHumanInputSubmission],
  )

  const [descExpanded, setDescExpanded] = useState(false)

  const description = appData?.site.description
  const [showDescToggle, setShowDescToggle] = useState(false)
  const handleDescRef = useCallback((node: HTMLElement | null) => {
    setShowDescToggle(!!node && node.scrollHeight > node.clientHeight)
  }, [])

  // 空会话=欢迎屏（mockup 类型1）：无会话 id、未首发、无可见消息（开场白不算）
  const isWelcome =
    !currentConversationId && !hasSent && !chatList.some((item) => !item.isOpeningStatement)

  // 应用描述收编：独立卡片取消,收为开场白下一行 line-clamp-1 + 「展开」链接
  const descriptionNode = useMemo(() => {
    if (!description) return null
    return (
      <div
        className={cn(
          'mt-1.5 max-w-full text-[12.5px] leading-5 text-[var(--text-3)]',
          !descExpanded && 'flex items-baseline justify-center',
        )}
      >
        <span
          ref={handleDescRef}
          className={cn(
            'min-w-0 wrap-break-word whitespace-pre-wrap',
            !descExpanded && 'line-clamp-1',
          )}
        >
          {description}
        </span>
        {showDescToggle && (
          <button
            type="button"
            className="ml-1 shrink-0 cursor-pointer text-[var(--accent-deep)] hover:opacity-80"
            onClick={() => setDescExpanded((v) => !v)}
          >
            {descExpanded
              ? t(($) => $['chat.collapse'], { ns: 'share' })
              : t(($) => $['chat.expand'], { ns: 'share' })}
          </button>
        )}
      </div>
    )
  }, [description, descExpanded, showDescToggle, handleDescRef, t])

  const welcomeNode = useMemo(() => {
    if (!isWelcome) return null
    const welcomeMessage = chatList.find((item) => item.isOpeningStatement)
    const uiConfig = resolveUiConfig(appData?.site)
    const welcomeSubtitle = uiConfig.brand.welcome_subtitle
    const questions = (welcomeMessage?.suggestedQuestions ?? []).filter((q) => !!q && q.trim())
    const showSuggestions = questions.length > 0 && uiConfig.components.show_suggested_questions
    const showForm = !allInputsHidden && inputsForms.length > 0
    const hasRequiredField = inputsForms.some((form) => form.required && form.hide !== true)
    // mockup 类型1 欢迎屏：垂直居中 64px 图标 + 开场白标题 + 副标题(空不渲染)
    // + 描述行(line-clamp-1+展开) + 建议问题 2×2 卡 + 变量表单(流内区块)
    return (
      <div
        data-testid="welcome-screen"
        className="flex w-full flex-col items-center px-4 pt-7 text-center sm:px-6 sm:pt-10"
      >
        <div className="grid size-16 place-items-center rounded-2xl bg-[var(--accent-soft)] shadow-[var(--shadow-xs)] max-sm:size-[52px] max-sm:rounded-[14px]">
          <AppIcon
            size="large"
            iconType={appData?.site.icon_type}
            icon={appData?.site.icon}
            background={appData?.site.icon_background}
            imageUrl={appData?.site.icon_url}
          />
        </div>
        {welcomeMessage && (
          <h1 className="mt-4 max-w-3xl text-[22px] font-semibold tracking-[0.01em] text-[var(--text-1)] max-sm:text-lg">
            <Markdown content={welcomeMessage.content} />
          </h1>
        )}
        {welcomeSubtitle && (
          <p className="mt-2 max-w-[520px] text-sm leading-7 text-[var(--text-2)]">
            {welcomeSubtitle}
          </p>
        )}
        {descriptionNode}
        {showSuggestions && (
          <div className="mt-6 grid w-full max-w-[560px] grid-cols-2 gap-2.5 max-sm:grid-cols-1">
            {questions.map((question) => (
              <button
                type="button"
                key={question}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-3 text-left text-[13px] text-[var(--text-2)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-deep)] disabled:pointer-events-none disabled:opacity-50"
                onClick={() => doSend(question)}
              >
                {question}
              </button>
            ))}
          </div>
        )}
        {showForm && <InputsForm defaultOpen={hasRequiredField} />}
      </div>
    )
  }, [appData?.site, chatList, isWelcome, allInputsHidden, inputsForms, descriptionNode, doSend])

  const answerIcon =
    appData?.site && appData.site.use_icon_as_answer_icon ? (
      <AnswerIcon
        iconType={appData.site.icon_type}
        icon={appData.site.icon}
        background={appData.site.icon_background}
        imageUrl={appData.site.icon_url}
      />
    ) : null
  const speechToTextTarget: SpeechToTextTarget | undefined =
    appSourceType === AppSourceType.webApp
      ? { type: 'app' as const, appSourceType: AppSourceType.webApp }
      : appId
        ? { type: 'app' as const, appId, appSourceType }
        : undefined

  return (
    <div className="h-full overflow-hidden bg-[var(--bg-soft)]">
      <Chat
        appData={appData ?? undefined}
        config={appConfig}
        speechToTextTarget={speechToTextTarget}
        chatList={messageList}
        isResponding={respondingState}
        centeredInput={isWelcome}
        // 宽度/顶距沿用 chat 核心(720/pt-7),wrapper 不再覆盖——避免 twMerge 漂移回 768/pt-6
        chatContainerInnerClassName={`mx-auto w-full ${isMobile && 'px-4'}`}
        chatFooterClassName={isWelcome ? undefined : 'pb-4'}
        chatFooterInnerClassName={
          isWelcome ? 'w-full' : `mx-auto w-full max-w-[720px] ${isMobile ? 'px-2' : 'px-4'}`
        }
        onSend={doSend}
        inputs={currentConversationId ? (currentConversationInputs as any) : newConversationInputs}
        inputsForm={inputsForms}
        onRegenerate={doRegenerate}
        onStopResponding={handleStop}
        onHumanInputFormSubmit={handleSubmitHumanInputForm}
        chatNode={welcomeNode}
        allToolIcons={appMeta?.tool_icons || {}}
        onFeedback={handleFeedback}
        suggestedQuestions={suggestedQuestions}
        answerIcon={answerIcon}
        hideProcessDetail
        switchSibling={doSwitchSibling}
        inputDisabled={inputDisabled}
        renderAgentContent={renderAgentContent}
        questionIcon={
          initUserVariables?.avatar_url ? (
            <Avatar
              avatar={initUserVariables.avatar_url}
              name={initUserVariables.name || 'user'}
              size="xl"
            />
          ) : undefined
        }
      />
    </div>
  )
}

export default ChatWrapper
