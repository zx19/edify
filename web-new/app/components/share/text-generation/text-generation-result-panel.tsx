import type { FC } from 'react'
import type { InputValueTypes, TextGenerationRunControl } from './types'
import type { PromptConfig } from '@/models/debug'
import type { SiteInfo } from '@/models/share'
import type { AppSourceType } from '@/service/share'
import type { VisionFile, VisionSettings } from '@/types/app'
import { useTranslation } from 'react-i18next'
import Res from '@/app/components/share/text-generation/result'

type TextGenerationResultPanelProps = {
  appId: string
  appSourceType: AppSourceType
  completionFiles: VisionFile[]
  controlSend: number
  controlStopResponding: number
  handleCompleted: (completionRes: string, taskId?: number, isSuccess?: boolean) => void
  handleSaveMessage: (messageId: string) => Promise<void>
  inputs: Record<string, InputValueTypes>
  isPC: boolean
  isWorkflow: boolean
  moreLikeThisEnabled: boolean
  onRunControlChange: (control: TextGenerationRunControl | null) => void
  onRunStart: () => void
  promptConfig: PromptConfig
  siteInfo: SiteInfo
  textToSpeechEnabled: boolean
  visionConfig: VisionSettings
}

/**
 * 「运行一次」结果列（v2，mockup 类型34 .res-pane，对照表 §6）：
 * 结果头行 + Res（空态虚线框/Loading/结果项内部自理）。
 * D10：移动端流内化——底部抽屉 + drag handle + isShowResultPanel 链退役；
 * 结果区 bg-soft 渐变 → 透明（壳 --bg 纯色）；批量支路迁 run-batch/batch-results。
 */
const TextGenerationResultPanel: FC<TextGenerationResultPanelProps> = ({
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
  moreLikeThisEnabled,
  onRunControlChange,
  onRunStart,
  promptConfig,
  siteInfo,
  textToSpeechEnabled,
  visionConfig,
}) => {
  const { t } = useTranslation()

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-[var(--text-2)]">
        {t(($) => $['generation.completionResult'], { ns: 'share' })}
      </div>
      <div className="min-h-0 grow">
        <Res
          isWorkflow={isWorkflow}
          isCallBatchAPI={false}
          isPC={isPC}
          isMobile={!isPC}
          appSourceType={appSourceType}
          appId={appId}
          isError={false}
          promptConfig={promptConfig}
          moreLikeThisEnabled={moreLikeThisEnabled}
          inputs={inputs}
          controlSend={controlSend}
          controlRetry={0}
          controlStopResponding={controlStopResponding}
          onShowRes={() => {}}
          handleSaveMessage={handleSaveMessage}
          onCompleted={handleCompleted}
          visionConfig={visionConfig}
          completionFiles={completionFiles}
          isShowTextToSpeech={textToSpeechEnabled}
          siteInfo={siteInfo}
          onRunStart={onRunStart}
          onRunControlChange={onRunControlChange}
          hideInlineStopButton={true}
        />
      </div>
    </div>
  )
}

export default TextGenerationResultPanel
