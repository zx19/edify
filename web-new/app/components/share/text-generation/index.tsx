'use client'
import type { FC } from 'react'
import type { InputValueTypes, TextGenerationRunControl, TextGenerationTranslate } from './types'
import type { VisionFile } from '@/types/app'
import { cn } from '@xsl/lomva-ui/cn'
import { toast } from '@xsl/lomva-ui/toast'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SavedItems from '@/app/components/app/text-generate/saved-items'
import { buildAccentStyle } from '@/app/components/base/chat/accent-style'
import Loading from '@/app/components/base/loading'
import useBreakpoints, { MediaType } from '@/hooks/use-breakpoints'
import { AccessMode } from '@/models/access-control'
import { resolveUiConfig } from '@/models/ui-config'
import { useSearchParams } from '@/next/navigation'
import Header from './header'
import { useTextGenerationAppState } from './hooks/use-text-generation-app-state'
import { useTextGenerationBatch } from './hooks/use-text-generation-batch'
import RunBatch from './run-batch'
import BatchResults from './run-batch/batch-results'
import RunOnce from './run-once'
import TextGenerationResultPanel from './text-generation-result-panel'

type IMainProps = {
  isInstalledApp?: boolean
  isWorkflow?: boolean
}

/**
 * text-gen 族壳层（呈现层回炉 2026-10-01，mockup v2 类型34 + 对照表 §1/§2）：
 * 40px 极薄 header（app 信息+⋯菜单）+ D8 segment 视图切换 + 视图容器 + 壳底品牌行。
 * 「运行一次」= 桌面左表单(360px 独立滚动)+右结果(自适应)双列，容器查询 <900px 退化单列
 * （installed-app 窄嵌入同此退化）；批量/已保存 = 720 单列。移动端单列流内（D10，抽屉退役）。
 * 家族根自挂 .webapp-theme（share 路由经 shareLayout 已有作用域属嵌套幂等；installed-app
 * 嵌入面经此自动获得新视觉——同源三用）。
 */
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
  const handleRunOnce = useCallback(() => {
    setIsCallBatchAPI(false)
    setControlSend(Date.now())
    resetBatchExecution()
  }, [resetBatchExecution, setIsCallBatchAPI])
  const handleRunBatch = useCallback(
    (data: string[][]) => {
      setRunControl(null)
      runBatchExecution(data, {
        onStart: () => {
          setControlSend(Date.now())
          setControlStopResponding(Date.now())
        },
      })
    },
    [runBatchExecution],
  )

  const segmentItems = [
    { key: 'create', label: t(($) => $['generation.tabs.create'], { ns: 'share' }) },
    showBatchTab && {
      key: 'batch',
      label: t(($) => $['generation.tabs.batch'], { ns: 'share' }),
    },
    !isWorkflow && {
      key: 'saved',
      label: t(($) => $['generation.tabs.saved'], { ns: 'share' }),
      badge: savedMessages.length,
    },
  ].filter(Boolean) as { key: string; label: string; badge?: number }[]

  const segmentRefs = useRef<(HTMLButtonElement | null)[]>([])
  /** tablist 键盘语义：←/→ 循环切换并聚焦 */
  const handleSegmentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const idx = segmentItems.findIndex((item) => item.key === effectiveTab)
    const next =
      e.key === 'ArrowRight'
        ? (idx + 1) % segmentItems.length
        : (idx - 1 + segmentItems.length) % segmentItems.length
    setCurrentTab(segmentItems[next]!.key)
    segmentRefs.current[next]?.focus()
  }

  if (!appId || !siteInfo || !promptConfig) {
    return (
      <div className="flex h-screen items-center">
        <Loading type="app" />
      </div>
    )
  }

  const resultPanelProps = {
    appId,
    appSourceType,
    completionFiles,
    controlSend,
    controlStopResponding,
    handleCompleted,
    handleSaveMessage,
    inputs,
    isPC,
    isWorkflow,
    moreLikeThisEnabled: !!moreLikeThisConfig?.enabled,
    onRunControlChange: setRunControl,
    onRunStart: () => {},
    promptConfig,
    siteInfo,
    textToSpeechEnabled: !!textToSpeechConfig?.enabled,
    visionConfig,
  }

  return (
    <div
      className={cn(
        'webapp-theme flex flex-col bg-[var(--bg)]',
        isInstalledApp ? 'h-full rounded-2xl shadow-md' : 'h-screen',
      )}
      style={buildAccentStyle(siteInfo?.chat_color_theme)}
    >
      <Header siteInfo={siteInfo} hideLogout={isInstalledApp || accessMode === AccessMode.PUBLIC} />
      {/* D8 segment 切换条（header 下居中；批量* = ui_config 条件项，已保存* = completion 专属） */}
      <div className="flex shrink-0 justify-center px-4 pt-1 pb-3">
        <div
          role="tablist"
          aria-label={t(($) => $['generation.title'], { ns: 'share' })}
          className="inline-flex items-center gap-0.5 rounded-[10px] bg-[var(--bg-soft)] p-1"
          onKeyDown={handleSegmentKeyDown}
          //  lint 规则要求 interactive role 可聚焦；tablist 本体不入 tab 序（tab 项才可聚焦）
          tabIndex={-1}
        >
          {segmentItems.map((item, i) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              ref={(el) => {
                segmentRefs.current[i] = el
              }}
              aria-selected={effectiveTab === item.key}
              onClick={() => setCurrentTab(item.key)}
              className={cn(
                'flex h-[30px] items-center gap-1.5 rounded-lg px-4 text-[13px] font-medium text-[var(--text-3)] transition-colors',
                effectiveTab === item.key &&
                  'bg-[var(--card)] font-semibold text-[var(--text-1)] shadow-[var(--shadow-xs)]',
              )}
            >
              {item.label}
              {!!item.badge && (
                <span className="grid h-[17px] min-w-[17px] place-items-center rounded-full bg-[var(--accent-soft)] px-[5px] text-[11px] font-bold text-[var(--accent-deep)]">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 grow">
        {/* 运行一次（keepMounted：hidden 切换不卸载，表单/草稿保留） */}
        <div className={cn('@container h-full', effectiveTab !== 'create' && 'hidden')}>
          <div className="mx-auto flex h-full w-full max-w-[1080px] flex-col gap-5 overflow-y-auto px-4 pt-1 pb-4 @[900px]:flex-row @[900px]:gap-7 @[900px]:overflow-visible @[900px]:px-6 @[900px]:pb-3">
            <div className="w-full shrink-0 @[900px]:flex @[900px]:h-full @[900px]:w-[360px] @[900px]:flex-col @[900px]:overflow-y-auto @[900px]:pr-1 @[900px]:pb-5">
              <div className="text-[15px] font-semibold text-[var(--text-1)]">
                {t(($) => $['generation.runFormTitle'], { ns: 'share' })}
              </div>
              <RunOnce
                siteInfo={siteInfo}
                inputs={inputs}
                inputsRef={inputsRef}
                onInputsChange={updateInputs}
                promptConfig={promptConfig}
                onSend={handleRunOnce}
                visionConfig={visionConfig}
                onVisionFilesChange={setCompletionFiles}
                runControl={runControl}
              />
            </div>
            <div className="min-w-0 grow @[900px]:h-full @[900px]:overflow-y-auto @[900px]:pr-1 @[900px]:pb-5">
              <TextGenerationResultPanel {...resultPanelProps} />
            </div>
          </div>
        </div>
        {/* 批量运行（keepMounted；showBatchTab 才渲染）：720 单列 = CSV 区 + 批量结果 */}
        {showBatchTab && (
          <div
            className={cn(
              'mx-auto h-full w-full max-w-[720px] overflow-y-auto px-4 pt-1 pb-5 sm:px-6',
              effectiveTab !== 'batch' && 'hidden',
            )}
          >
            <div className="text-[15px] font-semibold text-[var(--text-1)]">
              {t(($) => $['generation.tabs.batch'], { ns: 'share' })}
            </div>
            <RunBatch
              vars={promptConfig.prompt_variables}
              onSend={handleRunBatch}
              isAllFinished={allTasksRun}
            />
            <BatchResults
              {...resultPanelProps}
              allFailedTaskList={allFailedTaskList}
              allSuccessTaskList={allSuccessTaskList}
              allTaskList={allTaskList}
              controlRetry={controlRetry}
              exportRes={exportRes}
              handleRetryAllFailedTask={handleRetryAllFailedTask}
              isCallBatchAPI={isCallBatchAPI}
              noPendingTask={noPendingTask}
              showTaskList={showTaskList}
            />
          </div>
        )}
        {/* 已保存（completion 专属；非 keepMounted 与现状一致）：720 单列 */}
        {!isWorkflow && effectiveTab === 'saved' && (
          <div className="mx-auto h-full w-full max-w-[720px] overflow-y-auto px-4 pt-1 pb-5 sm:px-6">
            <div className="text-[15px] font-semibold text-[var(--text-1)]">
              {t(($) => $['generation.tabs.saved'], { ns: 'share' })}
            </div>
            <SavedItems
              className="mt-4"
              isShowTextToSpeech={textToSpeechConfig?.enabled}
              list={savedMessages}
              onRemove={handleRemoveSavedMessage}
              onStartCreateContent={() => setCurrentTab('create')}
            />
          </div>
        )}
      </div>
      {/* 壳底品牌行（品牌链：footer_text → replace_webapp_logo → 杏树林） */}
      {!customConfig?.remove_webapp_brand && (
        <div className="flex shrink-0 items-center justify-center gap-1 px-2 pt-2 pb-2.5 text-[11px] tracking-wide text-[var(--text-3)]">
          <span>{t(($) => $['chat.poweredBy'], { ns: 'share' })}</span>
          {resolveUiConfig(siteInfo).brand.footer_text ? (
            <span className="truncate">{resolveUiConfig(siteInfo).brand.footer_text}</span>
          ) : customConfig?.replace_webapp_logo ? (
            <img src={customConfig.replace_webapp_logo} alt="logo" className="block h-4 w-auto" />
          ) : (
            <b className="font-semibold text-[var(--text-2)]">杏树林</b>
          )}
        </div>
      )}
    </div>
  )
}
export default TextGeneration
