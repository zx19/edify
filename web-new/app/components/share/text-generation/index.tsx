'use client'
import type { FC } from 'react'
import type { InputValueTypes, TextGenerationRunControl, TextGenerationTranslate } from './types'
import type { VisionFile } from '@/types/app'
import { cn } from '@xsl/lomva-ui/cn'
import { toast } from '@xsl/lomva-ui/toast'
import { useBoolean } from 'ahooks'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildAccentStyle } from '@/app/components/base/chat/accent-style'
import Loading from '@/app/components/base/loading'
import useBreakpoints, { MediaType } from '@/hooks/use-breakpoints'
import { resolveUiConfig } from '@/models/ui-config'
import { useSearchParams } from '@/next/navigation'
import { useTextGenerationAppState } from './hooks/use-text-generation-app-state'
import { useTextGenerationBatch } from './hooks/use-text-generation-batch'
import TextGenerationResultPanel from './text-generation-result-panel'
import TextGenerationSidebar from './text-generation-sidebar'

type IMainProps = {
  isInstalledApp?: boolean
  isWorkflow?: boolean
}
const TextGeneration: FC<IMainProps> = ({ isInstalledApp = false, isWorkflow = false }) => {
  const { t } = useTranslation()
  const translateBatchKey: TextGenerationTranslate = useCallback(
    (selector, options) => {
      return t(selector, options)
    },
    [t],
  )
  const media = useBreakpoints()
  const isPC = media === MediaType.pc
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') || 'create'
  const [currentTab, setCurrentTab] = useState<string>(
    ['create', 'batch'].includes(mode) ? mode : 'create',
  )
  const [inputs, setInputs] = useState<Record<string, InputValueTypes>>({})
  const inputsRef = useRef(inputs)
  const [completionFiles, setCompletionFiles] = useState<VisionFile[]>([])
  const [runControl, setRunControl] = useState<TextGenerationRunControl | null>(null)
  const [controlSend, setControlSend] = useState(0)
  const [controlStopResponding, setControlStopResponding] = useState(0)
  const [resultExisted, setResultExisted] = useState(false)
  const [isShowResultPanel, { setTrue: showResultPanelState, setFalse: hideResultPanel }] =
    useBoolean(false)
  const notify = useCallback(
    ({ type, message }: { type: 'error' | 'info' | 'success' | 'warning'; message: string }) => {
      toast(message, { type })
    },
    [],
  )
  const updateInputs = useCallback((newInputs: Record<string, InputValueTypes>) => {
    setInputs(newInputs)
    inputsRef.current = newInputs
  }, [])
  const {
    accessMode,
    appId,
    appSourceType,
    customConfig,
    handleRemoveSavedMessage,
    handleSaveMessage,
    moreLikeThisConfig,
    promptConfig,
    savedMessages,
    siteInfo,
    textToSpeechConfig,
    visionConfig,
  } = useTextGenerationAppState({
    isInstalledApp,
    isWorkflow,
  })
  // ui_config.components.show_batch_tab：批量 tab 默认隐藏（2026-09-22 拍板）；
  // 配置关闭时 ?mode=batch 落回 create（渲染期派生，URL 直达兜底，不引入 effect）
  const showBatchTab = resolveUiConfig(siteInfo).components.show_batch_tab
  const effectiveTab = !showBatchTab && currentTab === 'batch' ? 'create' : currentTab
  const {
    allFailedTaskList,
    allSuccessTaskList,
    allTaskList,
    allTasksRun,
    controlRetry,
    exportRes,
    handleCompleted,
    handleRetryAllFailedTask,
    handleRunBatch: runBatchExecution,
    isCallBatchAPI,
    noPendingTask,
    resetBatchExecution,
    setIsCallBatchAPI,
    showTaskList,
  } = useTextGenerationBatch({
    promptConfig,
    notify,
    t: translateBatchKey,
  })
  const showResultPanel = useCallback(() => {
    setTimeout(() => {
      showResultPanelState()
    }, 0)
  }, [showResultPanelState])
  const handleRunStart = useCallback(() => {
    setResultExisted(true)
  }, [])
  const handleRunOnce = useCallback(() => {
    setIsCallBatchAPI(false)
    setControlSend(Date.now())
    resetBatchExecution()
    showResultPanel()
  }, [resetBatchExecution, setIsCallBatchAPI, showResultPanel])
  const handleRunBatch = useCallback(
    (data: string[][]) => {
      setRunControl(null)
      runBatchExecution(data, {
        onStart: () => {
          setControlSend(Date.now())
          setControlStopResponding(Date.now())
          showResultPanel()
        },
      })
    },
    [runBatchExecution, showResultPanel],
  )
  if (!appId || !siteInfo || !promptConfig) {
    return (
      <div className="flex h-screen items-center">
        <Loading type="app" />
      </div>
    )
  }
  return (
    // 家族根自挂 webapp-theme 作用域（chat-with-history 同款机制）：
    // share 路由经 shareLayout 已有作用域（嵌套幂等）；installed-app（console 嵌入 webapp 面）经此自动获得新视觉——同源三用
    <div
      className={cn(
        'webapp-theme bg-[var(--bg)]',
        isPC ? 'flex' : 'flex-col',
        isInstalledApp ? 'h-full rounded-2xl shadow-md' : 'h-screen',
      )}
      style={buildAccentStyle(siteInfo?.chat_color_theme)}
    >
      <TextGenerationSidebar
        accessMode={accessMode}
        allTasksRun={allTasksRun}
        currentTab={effectiveTab}
        customConfig={customConfig}
        inputs={inputs}
        inputsRef={inputsRef}
        isInstalledApp={isInstalledApp}
        isPC={isPC}
        isWorkflow={isWorkflow}
        onBatchSend={handleRunBatch}
        onInputsChange={updateInputs}
        onRemoveSavedMessage={handleRemoveSavedMessage}
        onRunOnceSend={handleRunOnce}
        onTabChange={setCurrentTab}
        onVisionFilesChange={setCompletionFiles}
        promptConfig={promptConfig}
        resultExisted={resultExisted}
        runControl={runControl}
        savedMessages={savedMessages}
        showBatchTab={showBatchTab}
        siteInfo={siteInfo}
        textToSpeechConfig={textToSpeechConfig}
        visionConfig={visionConfig}
      />
      <TextGenerationResultPanel
        allFailedTaskList={allFailedTaskList}
        allSuccessTaskList={allSuccessTaskList}
        allTaskList={allTaskList}
        appId={appId}
        appSourceType={appSourceType}
        completionFiles={completionFiles}
        controlRetry={controlRetry}
        controlSend={controlSend}
        controlStopResponding={controlStopResponding}
        exportRes={exportRes}
        handleCompleted={handleCompleted}
        handleRetryAllFailedTask={handleRetryAllFailedTask}
        handleSaveMessage={handleSaveMessage}
        inputs={inputs}
        isCallBatchAPI={isCallBatchAPI}
        isPC={isPC}
        isShowResultPanel={isShowResultPanel}
        isWorkflow={isWorkflow}
        moreLikeThisEnabled={!!moreLikeThisConfig?.enabled}
        noPendingTask={noPendingTask}
        onHideResultPanel={hideResultPanel}
        onRunControlChange={setRunControl}
        onRunStart={handleRunStart}
        onShowResultPanel={showResultPanel}
        promptConfig={promptConfig}
        resultExisted={resultExisted}
        showTaskList={showTaskList}
        siteInfo={siteInfo}
        textToSpeechEnabled={!!textToSpeechConfig?.enabled}
        visionConfig={visionConfig}
      />
    </div>
  )
}
export default TextGeneration
