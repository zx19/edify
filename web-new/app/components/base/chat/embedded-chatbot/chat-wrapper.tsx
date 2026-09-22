import type { FileEntity } from '../../file-uploader/types'
import type { HumanInputFormSubmitData } from '../chat/answer/human-input-content/type'
import type { ChatConfig, ChatItem, ChatItemInTree, OnSend } from '../types'
import { RiArrowDownSLine, RiArrowUpSLine } from '@remixicon/react'
import { Avatar } from '@xsl/lomva-ui/avatar'
import { cn } from '@xsl/lomva-ui/cn'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { trackWebAppEvent } from '@/app/components/base/amplitude/web-app-event'
import AnswerIcon from '@/app/components/base/answer-icon'
import AppIcon from '@/app/components/base/app-icon'
import InputsForm from '@/app/components/base/chat/embedded-chatbot/inputs-form'
import { Markdown } from '@/app/components/base/markdown'
import { InputVarType } from '@/app/components/workflow/types'
import {
  AppSourceType,
  fetchSuggestedQuestions,
  getUrl,
  stopChatMessageResponding,
  submitHumanInputForm,
} from '@/service/share'
import { submitHumanInputForm as submitHumanInputFormService } from '@/service/workflow'
import { TransferMethod } from '@/types/app'
import Chat from '../chat'
import { useChat } from '../chat/hooks'
import { getLastAnswer, isValidGeneratedAnswer } from '../utils'
import { useEmbeddedChatbotContext } from './context'

const ChatWrapper = () => {
  const { t } = useTranslation()
  const {
    appData,
    appParams,
    appPrevChatList,
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
    disableFeedback,
    handleFeedback,
    currentChatInstanceRef,
    clearChatList,
    setClearChatList,
    setIsResponding,
    allInputsHidden,
    initUserVariables,
    appSourceType,
  } = useEmbeddedChatbotContext()

  // Read sendOnEnter from URL params (e.g., ?sendOnEnter=false)
  const sendOnEnter = useMemo(() => {
    if (typeof window === 'undefined') return true
    const urlParams = new URLSearchParams(window.location.search)
    const param = urlParams.get('sendOnEnter')
    return param !== 'false'
  }, [])

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
  const timezone =
    appSourceType === AppSourceType.webApp
      ? new Intl.DateTimeFormat().resolvedOptions().timeZone
      : undefined
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
    appPrevChatList,
    (taskId) => stopChatMessageResponding('', taskId, appSourceType, appId),
    clearChatList,
    setClearChatList,
    undefined,
    { timezone },
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
    ) // boolean can be not checked
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
    return false
  }, [inputsFormValue, inputsForms, allInputsHidden])

  useEffect(() => {
    if (currentChatInstanceRef.current) currentChatInstanceRef.current.handleStop = handleStop
  }, [currentChatInstanceRef, handleStop])
  useEffect(() => {
    setIsResponding(respondingState)
  }, [respondingState, setIsResponding])

  // Resume paused workflows when chat history is loaded
  useEffect(() => {
    if (!appPrevChatList || appPrevChatList.length === 0) return

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

    findLastPausedWorkflow(appPrevChatList)

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
        inputs: currentConversationId ? currentConversationInputs : newConversationInputs,
        conversation_id: currentConversationId,
        parent_message_id: (isRegenerate ? parentAnswer?.id : getLastAnswer(chatList)?.id) || null,
      }
      handleSend(getUrl('chat-messages', appSourceType, appId || ''), data, {
        onGetSuggestedQuestions: (responseItemId) =>
          fetchSuggestedQuestions(responseItemId, appSourceType, appId),
        onConversationComplete: currentConversationId ? undefined : handleNewConversationCompleted,
        isPublicAPI: appSourceType === AppSourceType.webApp,
      })
      if (appSourceType === AppSourceType.webApp && appData?.mode)
        trackWebAppEvent('webapp_run', { app_mode: appData.mode })
    },
    [
      currentConversationId,
      currentConversationInputs,
      newConversationInputs,
      chatList,
      handleSend,
      appSourceType,
      appId,
      handleNewConversationCompleted,
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
      appSourceType,
      appId,
      currentConversationId,
      handleNewConversationCompleted,
    ],
  )

  const messageList = useMemo(() => {
    if (currentConversationId || chatList.length > 1) return chatList
    // Without messages we are in the welcome screen, so hide the opening statement from chatlist
    return chatList.filter((item) => !item.isOpeningStatement)
  }, [chatList, currentConversationId])

  const isTryApp = appSourceType === AppSourceType.tryApp
  const [collapsed, setCollapsed] = useState(!!currentConversationId && !isTryApp) // try app always use the new chat
  const [descExpanded, setDescExpanded] = useState(false)

  const description = appData?.site.description
  const [showDescToggle, setShowDescToggle] = useState(false)
  const descRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = descRef.current
    if (!el) return
    if (el.offsetWidth > 0) {
      setShowDescToggle(el.scrollHeight > el.clientHeight)
      return
    }
    const observer = new ResizeObserver((entries) => {
      if (!entries[0] || entries[0].contentRect.width === 0) return
      setShowDescToggle(el.scrollHeight > el.clientHeight)
      observer.disconnect()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [description])

  const descriptionNode = useMemo(() => {
    if (!description || currentConversationId || hasSent) return null
    // mockup 类型2 描述卡：单实现消费 token（族经 shareLayout/try-app 均有作用域）
    return (
      <div className={cn('flex flex-col items-center px-4 pt-6', isMobile && 'pt-4')}>
        <div className="w-full max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <div className={cn('p-6', isMobile && 'p-4')}>
            <div
              ref={descRef}
              className={cn(
                'relative text-[12.5px] leading-7 wrap-break-word whitespace-pre-wrap text-[var(--text-2)]',
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
                className="mt-0.5 flex items-center gap-0.5 text-[12px] font-semibold text-[var(--accent-deep)] hover:opacity-80"
                onClick={() => setDescExpanded((v) => !v)}
              >
                {descExpanded ? (
                  <>
                    <RiArrowUpSLine className="size-3" />
                    {t(($) => $['chat.collapse'], { ns: 'share' })}
                  </>
                ) : (
                  <>
                    <RiArrowDownSLine className="size-3" />
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
      return <div className="mb-4"></div>
    } else {
      return <InputsForm collapsed={collapsed} setCollapsed={setCollapsed} />
    }
  }, [inputsForms.length, isMobile, currentConversationId, collapsed, allInputsHidden])

  const handleSubmitHumanInputForm = useCallback(
    async (formToken: string, formData: HumanInputFormSubmitData) => {
      if (!(await prepareHumanInputSubmission())) return

      if (isInstalledApp) await submitHumanInputFormService(formToken, formData)
      else await submitHumanInputForm(formToken, formData)
    },
    [isInstalledApp, prepareHumanInputSubmission],
  )

  const welcome = useMemo(() => {
    const welcomeMessage = chatList.find((item) => item.isOpeningStatement)
    if (respondingState) return null
    if (currentConversationId) return null
    if (!welcomeMessage) return null
    if (!collapsed && inputsForms.length > 0 && !allInputsHidden) return null
    if (!appData?.site) return null
    // mockup 类型2 欢迎屏：居中图标 + 应用名标题 + 开场白副标题 + 建议问题列表
    // 单实现消费 token（族经 shareLayout/try-app 均有作用域）
    const questions = (welcomeMessage.suggestedQuestions ?? []).filter((q) => !!q && q.trim())
    return (
      <div
        className={cn(
          'flex min-h-[50vh] flex-col items-center justify-center px-6 py-12',
          isMobile && 'min-h-[30vh] px-4 py-4',
        )}
      >
        <div className="grid size-15 place-items-center rounded-2xl bg-[var(--accent-soft)] shadow-[var(--shadow-sm)]">
          <AppIcon
            size="large"
            iconType={appData.site.icon_type}
            icon={appData.site.icon}
            background={appData.site.icon_background}
            imageUrl={appData.site.icon_url}
          />
        </div>
        <div className="mt-3.5 text-center text-xl font-bold tracking-tight text-[var(--text-1)]">
          {appData.site.title}
        </div>
        <div className="mt-1.5 max-w-105 text-center text-[13px] leading-7 text-[var(--text-3)]">
          <Markdown content={welcomeMessage.content} />
        </div>
        {questions.length > 0 && (
          <div className="mt-5 flex w-full max-w-105 flex-col gap-1.5">
            {questions.map((question) => (
              <button
                type="button"
                key={question}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 text-left text-[13px] text-[var(--text-2)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-deep)]"
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
    chatList,
    respondingState,
    currentConversationId,
    collapsed,
    inputsForms.length,
    allInputsHidden,
    appData?.site,
    isMobile,
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
  const speechToTextTarget =
    appSourceType === AppSourceType.webApp
      ? { type: 'app' as const, appSourceType }
      : appId
        ? { type: 'app' as const, appId, appSourceType }
        : undefined

  return (
    <Chat
      isTryApp={isTryApp}
      appData={appData || undefined}
      config={appConfig}
      speechToTextTarget={speechToTextTarget}
      chatList={messageList}
      isResponding={respondingState}
      chatContainerInnerClassName={cn(
        'mx-auto w-full max-w-full px-4',
        messageList.length && 'pt-4',
      )}
      chatFooterClassName={cn('pb-4', !isMobile && 'rounded-b-2xl')}
      chatFooterInnerClassName={cn('mx-auto w-full max-w-full px-4', isMobile && 'px-2')}
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
      disableFeedback={disableFeedback}
      onFeedback={handleFeedback}
      suggestedQuestions={suggestedQuestions}
      answerIcon={answerIcon}
      hideProcessDetail
      switchSibling={doSwitchSibling}
      inputDisabled={inputDisabled}
      sendOnEnter={sendOnEnter}
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
  )
}

export default ChatWrapper
