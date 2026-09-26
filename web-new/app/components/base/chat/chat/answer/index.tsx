import type { FC, ReactNode } from 'react'
import type { ChatConfig, ChatItem } from '../../types'
import type { HumanInputFormSubmitData } from './human-input-content/type'
import type { AppData } from '@/models/share'
import { cn } from '@xsl/lomva-ui/cn'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { EditTitle } from '@/app/components/app/annotation/edit-annotation-modal/edit-item'
import Citation from '@/app/components/base/chat/chat/citation'
import LoadingAnim from '@/app/components/base/chat/chat/loading-anim'
import { FileList } from '@/app/components/base/file-uploader'
import { resolveUiConfig } from '@/models/ui-config'
import { useChatContext } from '../context'
import AgentContent from './agent-content'
import BasicContent from './basic-content'
import HumanInputFilledFormList from './human-input-filled-form-list'
import HumanInputFormList from './human-input-form-list'
import Operation from './operation'
import ReasoningPanel from './reasoning-panel'
import SuggestedQuestions from './suggested-questions'
import WorkflowProcessItem from './workflow-process'

type AnswerProps = {
  /** @deprecated 操作条固定为流内行（见 operation.tsx），此 prop 仅保留签名兼容 */
  answerActionPosition?: 'auto' | 'below'
  item: ChatItem
  question: string
  index: number
  config?: ChatConfig
  /** @deprecated D3 去头像：prop 仅保留签名兼容，不再渲染 */
  answerIcon?: ReactNode
  responding?: boolean
  showPromptLog?: boolean
  chatAnswerContainerInner?: string
  hideProcessDetail?: boolean
  appData?: AppData
  noChatInput?: boolean
  switchSibling?: (siblingMessageId: string) => void
  /** @deprecated D3 去头像：prop 仅保留签名兼容，不再渲染 */
  hideAvatar?: boolean
  renderAgentContent?: (props: {
    item: ChatItem
    responding?: boolean
    content?: string
  }) => ReactNode
  onHumanInputFormSubmit?: (formToken: string, formData: HumanInputFormSubmitData) => Promise<void>
}

const Answer: FC<AnswerProps> = ({
  item,
  question,
  index,
  config,
  responding,
  showPromptLog,
  chatAnswerContainerInner,
  hideProcessDetail,
  appData,
  noChatInput,
  switchSibling,
  renderAgentContent,
  onHumanInputFormSubmit,
}) => {
  const { t } = useTranslation()
  const {
    content,
    citation,
    agent_thoughts,
    annotation,
    workflowProcess,
    allFiles,
    message_files,
    humanInputFormDataList,
    humanInputFilledFormDataList,
  } = item
  const hasAgentThoughts = !!agent_thoughts?.length
  const hasAgentResponseParts = !!item.agent_response_parts?.length
  const hasAgentContent = hasAgentThoughts || hasAgentResponseParts
  const hasHumanInputs = !!humanInputFormDataList?.length || !!humanInputFilledFormDataList?.length
  // Truthy only when there is real reasoning text. Rehydrated messages carry an empty
  // `{}` (the field is always persisted), and `!!{}` would otherwise be truthy.
  const hasReasoning = !!item.reasoningContent && Object.values(item.reasoningContent).some(Boolean)

  const { getHumanInputNodeData } = useChatContext()

  // ui_config 组件显隐门（降级规则见功能对照表）：后端未下发时全默认显示
  const uiConfig = resolveUiConfig(appData?.site)

  const contentIsEmpty = typeof content === 'string' && content.trim() === ''
  const agentContentNode = renderAgentContent ? (
    renderAgentContent({ item, responding, content })
  ) : (
    <AgentContent item={item} responding={responding} content={content} />
  )
  // Reasoning is "done" — freeze the elapsed timer and collapse the panel — as soon as ANY of:
  //  ① the answer has begun streaming (first text delta): the only signal that fires
  //     mid-node, so it drives the normal think→answer handoff;
  //  ② the reasoning stream's terminal marker arrived (a reasoning node that finishes
  //     before a separate answer node starts);
  //  ③ the response is no longer active — explicitly false, not merely absent (history / abnormal end).
  // graphon's is_final (on BOTH the text and reasoning channels) is a node-terminal marker
  // that trails the whole answer, so it can't drive ①; the answer-started signal must.
  const reasoningDone = !contentIsEmpty || !!item.reasoningFinished || responding === false

  return (
    // group/answer：操作条 hover 域（D5）；chat-answer-container 类名保留——markdown link 锚点滚动以其为 JS 钩子
    <div className="group/answer chat-answer-container w-full" data-testid="chat-answer-container">
      {/* Block 1: Workflow Process + Human Input Forms */}
      {hasHumanInputs && (
        <div
          className={cn(chatAnswerContainerInner)}
          data-testid="chat-answer-container-humaninput"
        >
          <div className="relative inline-block w-full max-w-full text-[14px] leading-[1.75] text-[var(--text-1)]">
            {workflowProcess && (
              <WorkflowProcessItem
                data={workflowProcess}
                item={item}
                hideProcessDetail={hideProcessDetail}
                readonly={
                  hideProcessDetail && appData ? !appData.site.show_workflow_steps : undefined
                }
              />
            )}
            {humanInputFormDataList && humanInputFormDataList.length > 0 && (
              <HumanInputFormList
                humanInputFormDataList={humanInputFormDataList}
                onHumanInputFormSubmit={onHumanInputFormSubmit}
                getHumanInputNodeData={getHumanInputNodeData}
              />
            )}
            {humanInputFilledFormDataList && humanInputFilledFormDataList.length > 0 && (
              <HumanInputFilledFormList
                humanInputFilledFormDataList={humanInputFilledFormDataList}
              />
            )}
          </div>
        </div>
      )}

      {/* Block 2: Response Content (when human inputs exist) */}
      {hasHumanInputs && (responding || !contentIsEmpty || hasAgentContent || hasReasoning) && (
        <div className={cn('relative mt-2', chatAnswerContainerInner)}>
          <div className="absolute -top-2 left-6 h-3 w-0.5 bg-chat-answer-human-input-form-divider-bg" />
          <div className="relative inline-block w-full max-w-full text-[14px] leading-[1.75] text-[var(--text-1)]">
            {hasReasoning && (
              <ReasoningPanel content={item.reasoningContent ?? {}} done={reasoningDone} />
            )}
            {responding && contentIsEmpty && !hasAgentContent && !hasReasoning && (
              <div className="flex h-5 w-6 items-center justify-center">
                <LoadingAnim type="text" />
              </div>
            )}
            {!contentIsEmpty && !hasAgentContent && <BasicContent item={item} />}
            {hasAgentContent && agentContentNode}
            {!!allFiles?.length && (
              <FileList
                className="my-1"
                files={allFiles}
                showDeleteAction={false}
                showDownloadAction
                canPreview
              />
            )}
            {!!message_files?.length && (
              <FileList
                className="my-1"
                files={message_files}
                showDeleteAction={false}
                showDownloadAction
                canPreview
              />
            )}
            {annotation?.id && annotation.authorName && (
              <EditTitle
                className="mt-1"
                title={t(($) => $.editBy, { ns: 'appAnnotation', author: annotation.authorName })}
              />
            )}
            {uiConfig.components.show_suggested_questions && <SuggestedQuestions item={item} />}
            {!!citation?.length && !responding && uiConfig.components.show_citation && (
              <Citation data={citation} showHitInfo={config?.supportCitationHitInfo} />
            )}
          </div>
        </div>
      )}

      {/* Original single block layout (when no human inputs) */}
      {!hasHumanInputs && (
        <div className={cn(chatAnswerContainerInner)} data-testid="chat-answer-container-inner">
          <div
            className={cn(
              'relative inline-block max-w-full text-[14px] leading-[1.75] text-[var(--text-1)]',
              workflowProcess && 'w-full',
            )}
          >
            {workflowProcess && (
              <WorkflowProcessItem
                data={workflowProcess}
                item={item}
                hideProcessDetail={hideProcessDetail}
                readonly={
                  hideProcessDetail && appData ? !appData.site?.show_workflow_steps : undefined
                }
              />
            )}
            {hasReasoning && (
              <ReasoningPanel content={item.reasoningContent ?? {}} done={reasoningDone} />
            )}
            {responding && contentIsEmpty && !hasAgentContent && !hasReasoning && (
              <div className="flex h-5 w-6 items-center justify-center">
                <LoadingAnim type="text" />
              </div>
            )}
            {!contentIsEmpty && !hasAgentContent && <BasicContent item={item} />}
            {hasAgentContent && agentContentNode}
            {!!allFiles?.length && (
              <FileList
                className="my-1"
                files={allFiles}
                showDeleteAction={false}
                showDownloadAction
                canPreview
              />
            )}
            {!!message_files?.length && (
              <FileList
                className="my-1"
                files={message_files}
                showDeleteAction={false}
                showDownloadAction
                canPreview
              />
            )}
            {annotation?.id && annotation.authorName && (
              <EditTitle
                className="mt-1"
                title={t(($) => $.editBy, { ns: 'appAnnotation', author: annotation.authorName })}
              />
            )}
            {uiConfig.components.show_suggested_questions && <SuggestedQuestions item={item} />}
            {!!citation?.length && !responding && uiConfig.components.show_citation && (
              <Citation data={citation} showHitInfo={config?.supportCitationHitInfo} />
            )}
          </div>
        </div>
      )}

      {/* msg-foot（mockup 类型1）：操作条行（赞踩/复制/重新生成/朗读/标注/日志 + 多答案切换 + 性能行行尾），
          hover/focus 显现（D5）；ui_config show_message_actions=false 时整行不渲染（含性能行，对照表降级规则） */}
      {!responding && uiConfig.components.show_message_actions && (
        <Operation
          item={item}
          question={question}
          index={index}
          showPromptLog={showPromptLog}
          noChatInput={noChatInput}
          switchSibling={switchSibling}
        />
      )}
    </div>
  )
}

export default memo(Answer)
