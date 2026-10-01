'use client'
import type { FC } from 'react'
import type { InputValueTypes, Task, TextGenerationRunControl } from '../types'
import type { PromptConfig } from '@/models/debug'
import type { SiteInfo } from '@/models/share'
import type { AppSourceType } from '@/service/share'
import type { VisionFile, VisionSettings } from '@/types/app'
import { useTranslation } from 'react-i18next'
import Loading from '@/app/components/base/loading'
import Res from '@/app/components/share/text-generation/result'
import { TaskStatus } from '../types'
import ResDownload from './res-download'

export type BatchResultsProps = {
  allFailedTaskList: Task[]
  allSuccessTaskList: Task[]
  allTaskList: Task[]
  appId: string
  appSourceType: AppSourceType
  completionFiles: VisionFile[]
  controlRetry: number
  controlSend: number
  controlStopResponding: number
  exportRes: Record<string, string>[]
  handleCompleted: (completionRes: string, taskId?: number, isSuccess?: boolean) => void
  handleRetryAllFailedTask: () => void
  handleSaveMessage: (messageId: string) => Promise<void>
  inputs: Record<string, InputValueTypes>
  isCallBatchAPI: boolean
  isPC: boolean
  isWorkflow: boolean
  moreLikeThisEnabled: boolean
  noPendingTask: boolean
  onRunControlChange: (control: TextGenerationRunControl | null) => void
  onRunStart: () => void
  promptConfig: PromptConfig
  showTaskList: Task[]
  siteInfo: SiteInfo
  textToSpeechEnabled: boolean
  visionConfig: VisionSettings
}

/**
 * 批量结果区（批量视图 720 单列内，对照表 §5）。
 * T2 自 text-generation-result-panel 批量支路机械迁入（执行数头/逐项 Res/失败重试条）；
 * 重试条由绝对定位浮条改流内（壳层已无抽屉/遮罩）。头卡化在 T3。
 */
const BatchResults: FC<BatchResultsProps> = (props) => {
  const {
    allFailedTaskList,
    allSuccessTaskList,
    allTaskList,
    appId,
    appSourceType,
    completionFiles,
    controlRetry,
    controlSend,
    controlStopResponding,
    exportRes,
    handleCompleted,
    handleRetryAllFailedTask,
    handleSaveMessage,
    inputs,
    isCallBatchAPI,
    isPC,
    isWorkflow,
    moreLikeThisEnabled,
    noPendingTask,
    onRunStart,
    promptConfig,
    showTaskList,
    siteInfo,
    textToSpeechEnabled,
    visionConfig,
  } = props
  const { t } = useTranslation()

  if (!isCallBatchAPI) return null

  const renderResult = (task?: Task) => (
    <Res
      key={task?.id}
      isWorkflow={isWorkflow}
      isCallBatchAPI={true}
      isPC={isPC}
      isMobile={!isPC}
      appSourceType={appSourceType}
      appId={appId}
      isError={task?.status === TaskStatus.failed}
      promptConfig={promptConfig}
      moreLikeThisEnabled={moreLikeThisEnabled}
      inputs={task ? task.params.inputs : inputs}
      controlSend={controlSend}
      controlRetry={task?.status === TaskStatus.failed ? controlRetry : 0}
      controlStopResponding={controlStopResponding}
      onShowRes={() => {}}
      handleSaveMessage={handleSaveMessage}
      taskId={task?.id}
      onCompleted={handleCompleted}
      visionConfig={visionConfig}
      completionFiles={completionFiles}
      isShowTextToSpeech={textToSpeechEnabled}
      siteInfo={siteInfo}
      onRunStart={onRunStart}
      onRunControlChange={undefined}
      hideInlineStopButton={false}
    />
  )

  return (
    <div className="mt-6">
      <div className="mb-3 text-[13px] font-semibold text-[var(--text-2)]">
        {t(($) => $['generation.batchResultTitle'], { ns: 'share' })}
      </div>
      {/* 头卡（mockup .batch-head）：计数 + 重试失败 + 下载结果；旧执行数头与绝对定位重试条退役 */}
      <div className="flex items-center gap-2.5 rounded-[10px] border border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 text-[12.5px] text-[var(--text-2)]">
        <span>
          {t(($) => $['generation.batchTotal'], { ns: 'share', num: allTaskList.length })}
        </span>
        <span className="font-semibold text-[var(--success)]">
          ✓{' '}
          {t(($) => $['generation.batchSuccess'], { ns: 'share', num: allSuccessTaskList.length })}
        </span>
        {allFailedTaskList.length > 0 && (
          <span className="font-semibold text-[var(--danger)]">
            ✗{' '}
            {t(($) => $['generation.batchFailedCount'], {
              ns: 'share',
              num: allFailedTaskList.length,
            })}
          </span>
        )}
        <span className="grow" />
        {allFailedTaskList.length > 0 && (
          <button
            type="button"
            className="inline-flex h-[26px] items-center rounded-[7px] px-2.5 text-[12px] font-medium text-[var(--text-3)] transition-colors hover:bg-[var(--bg-soft)] hover:text-[var(--text-1)]"
            onClick={handleRetryAllFailedTask}
          >
            {t(($) => $['generation.retryFailed'], { ns: 'share' })}
          </button>
        )}
        {allSuccessTaskList.length > 0 && <ResDownload isMobile={!isPC} values={exportRes} />}
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {showTaskList.map((task) => renderResult(task))}
        {!noPendingTask && (
          <div className="mt-4">
            <Loading type="area" />
          </div>
        )}
      </div>
    </div>
  )
}

export default BatchResults
