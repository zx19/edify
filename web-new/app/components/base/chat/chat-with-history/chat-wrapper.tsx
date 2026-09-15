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
    sidebarCollapseState,
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

  const [collapsed, setCollapsed] = useState(!!currentConversationId)
  const [descExpanded, setDescExpanded] = useState(false)

  const description = appData?.site.description
  const [showDescToggle, setShowDescToggle] = useState(false)
  const handleDescRef = useCallback((node: HTMLDivElement | null) => {
    setShowDescToggle(!!node && node.scrollHeight > node.clientHeight)
  }, [])

  const descriptionNode = useMemo(() => {
    if (!description || currentConversationId || hasSent) return null
    return (
      <div className={cn('flex flex-col items-center px-4 pt-6', isMobile && 'pt-4')}>
        <div className="w-full max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-sm)]">
          <div className={cn('p-6', isMobile && 'p-4')}>
            <div
              ref={handleDescRef}
              className={cn(
                'relative system-xs-regular wrap-break-word whitespace-pre-wrap text-text-tertiary',
                !descExpanded && 'line-clamp-3',
                descExpanded && 'max-h-32 overflow-y-auto',
              )}
            >
              {description}
              {!descExpanded && showDescToggle && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-linear-to-b from-transparent to-[var(--card)]" />
              )}
            </div>
            {showDescToggle && (
              <button
                type="button"
                className="mt-0.5 flex items-center gap-0.5 text-xs text-[var(--accent-deep)] hover:opacity-80"
                onClick={() => setDescExpanded((v) => !v)}
              >
                {descExpanded ? (
                  <>
                    <span aria-hidden className="i-ri-arrow-up-s-line size-3" />
                    {t(($) => $['chat.collapse'], { ns: 'share' })}
                  </>
                ) : (
                  <>
                    <span aria-hidden className="i-ri-arrow-down-s-line size-3" />
                    {t(($) => $['chat.expand'], { ns: 'share' })}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }, [description, isMobile, currentConversationId, hasSent, descExpanded, showDescToggle, t])

  const chatNode = useMemo(() => {
    if (allInputsHidden || !inputsForms.length) return null
    if (isMobile) {
      if (!currentConversationId)
        return <InputsForm collapsed={collapsed} setCollapsed={setCollapsed} />
      return null
    } else {
      return <InputsForm collapsed={collapsed} setCollapsed={setCollapsed} />
    }
  }, [inputsForms.length, isMobile, currentConversationId, collapsed, allInputsHidden])

  const welcome = useMemo(() => {
    const welcomeMessage = chatList.find((item) => item.isOpeningStatement)
    if (respondingState) return null
    if (currentConversationId) return null
    if (!welcomeMessage) return null
    if (!collapsed && inputsForms.length > 0 && !allInputsHidden) return null
    // mockup 类型1 欢迎屏：居中 64px 图标 + 标题（开场白 markdown）+ ui_config 副标题（空不渲染）
    // + 建议问题 2×2 卡片格
    const welcomeSubtitle = resolveUiConfig(appData?.site).brand.welcome_subtitle
    const questions = (welcomeMessage.suggestedQuestions ?? []).filter((q) => !!q && q.trim())
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-12">
        <div className="grid size-16 place-items-center rounded-2xl bg-[var(--accent-soft)] shadow-[var(--shadow-sm)]">
          <AppIcon
            size="large"
            iconType={appData?.site.icon_type}
            icon={appData?.site.icon}
            background={appData?.site.icon_background}
            imageUrl={appData?.site.icon_url}
          />
        </div>
        <div className="mt-4 max-w-3xl text-center text-2xl font-bold tracking-tight text-[var(--text-1)]">
          <Markdown content={welcomeMessage.content} />
        </div>
        {welcomeSubtitle && (
          <div className="mt-1.5 text-center text-[13.5px] text-[var(--text-3)]">
            {welcomeSubtitle}
          </div>
        )}
        {questions.length > 0 &&
          resolveUiConfig(appData?.site).components.show_suggested_questions && (
            <div className="mt-6 grid w-full max-w-2xl grid-cols-2 gap-2 max-sm:grid-cols-1">
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
      </div>
    )
  }, [
    appData?.site,
    chatList,
    collapsed,
    currentConversationId,
    inputsForms.length,
    respondingState,
    allInputsHidden,
    doSend,
  ])

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
        chatContainerInnerClassName={`mx-auto pt-6 w-full max-w-[768px] ${isMobile && 'px-4'}`}
        chatFooterClassName="pb-4"
        chatFooterInnerClassName={`mx-auto w-full max-w-[768px] ${isMobile ? 'px-2' : 'px-4'}`}
        onSend={doSend}
        inputs={currentConversationId ? (currentConversationInputs as any) : newConversationInputs}
        inputsForm={inputsForms}
        onRegenerate={doRegenerate}
        onStopResponding={handleStop}
        onHumanInputFormSubmit={handleSubmitHumanInputForm}
        chatNode={
          <>
            {descriptionNode}
            {chatNode}
            {welcome}
          </>
        }
        allToolIcons={appMeta?.tool_icons || {}}
        onFeedback={handleFeedback}
        suggestedQuestions={suggestedQuestions}
        answerIcon={answerIcon}
        hideProcessDetail
        switchSibling={doSwitchSibling}
        inputDisabled={inputDisabled}
        sidebarCollapseState={sidebarCollapseState}
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
