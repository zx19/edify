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
      <div className="flex items-center justify-between pt-2 pb-2">
        <div className="text-[12.5px] font-bold tracking-wide text-[var(--text-2)] uppercase">
          {t(($) => $['generation.executions'], { ns: 'share', num: allTaskList.length })}
        </div>
        {allSuccessTaskList.length > 0 && <ResDownload isMobile={!isPC} values={exportRes} />}
      </div>
      <div className="flex flex-col">
        {showTaskList.map((task) => renderResult(task))}
        {!noPendingTask && (
          <div className="mt-4">
            <Loading type="area" />
          </div>
        )}
      </div>
      {allFailedTaskList.length > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] p-3 shadow-[var(--shadow-md)]">
          <span aria-hidden className="i-ri-error-warning-fill size-4 text-[var(--danger)]" />
          <div className="text-[12.5px] font-medium text-[var(--danger)]">
            {t(($) => $['generation.batchFailed.info'], {
              ns: 'share',
              num: allFailedTaskList.length,
            })}
          </div>
          <div className="h-3.5 w-px bg-[var(--danger)] opacity-30"></div>
          <button
            type="button"
            className="inline cursor-pointer border-none bg-transparent p-0 text-left text-[11.5px] font-bold tracking-wide text-[var(--danger)] uppercase focus-visible:ring-1 focus-visible:ring-[var(--danger)] focus-visible:outline-hidden"
            onClick={handleRetryAllFailedTask}
          >
            {t(($) => $['generation.batchFailed.retry'], { ns: 'share' })}
          </button>
        </div>
      )}
    </div>
  )
}

export default BatchResults
