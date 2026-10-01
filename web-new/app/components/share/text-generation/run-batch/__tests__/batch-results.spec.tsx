import type { PromptConfig } from '@/models/debug'
import type { SiteInfo } from '@/models/share'
import type { VisionSettings } from '@/types/app'
import { fireEvent, render, screen } from '@testing-library/react'
import { AppSourceType } from '@/service/share'
import { Resolution, TransferMethod } from '@/types/app'
import { TaskStatus } from '../../types'
import BatchResults from '../batch-results'

const resPropsSpy = vi.fn()
const resDownloadPropsSpy = vi.fn()

vi.mock('@/app/components/share/text-generation/result', () => ({
  default: (props: Record<string, unknown>) => {
    resPropsSpy(props)
    return <div data-testid={`res-${String(props.taskId ?? 'single')}`} />
  },
}))

vi.mock('@/app/components/share/text-generation/run-batch/res-download', () => ({
  default: (props: Record<string, unknown>) => {
    resDownloadPropsSpy(props)
    return <div data-testid="res-download-mock" />
  },
}))

const promptConfig: PromptConfig = {
  prompt_template: 'template',
  prompt_variables: [{ key: 'name', name: 'Name', type: 'string', required: true }],
}

const siteInfo: SiteInfo = {
  title: 'Text Generation',
  icon_type: 'emoji',
  icon: 'robot',
}

const visionConfig: VisionSettings = {
  enabled: false,
  number_limits: 2,
  detail: Resolution.low,
  transfer_methods: [TransferMethod.local_file],
}

const batchTasks = [
  {
    id: 1,
    status: TaskStatus.completed,
    params: { inputs: { name: 'Alpha' } },
  }!,
  {
    id: 2,
    status: TaskStatus.failed,
    params: { inputs: { name: 'Beta' } },
  }!,
]

const baseProps = {
  allFailedTaskList: [] as typeof batchTasks,
  allSuccessTaskList: [] as typeof batchTasks,
  allTaskList: batchTasks,
  appId: 'app-123',
  appSourceType: AppSourceType.webApp,
  completionFiles: [],
  controlRetry: 88,
  controlSend: 77,
  controlStopResponding: 66,
  exportRes: [{ Name: 'Alpha', 'share.generation.completionResult': 'Done' }!],
  handleCompleted: vi.fn(),
  handleRetryAllFailedTask: vi.fn(),
  handleSaveMessage: vi.fn(async () => {}),
  inputs: { name: 'Alice' },
  isCallBatchAPI: true,
  isPC: true,
  isWorkflow: false,
  moreLikeThisEnabled: true,
  noPendingTask: true,
  onRunControlChange: vi.fn(),
  onRunStart: vi.fn(),
  promptConfig,
  showTaskList: batchTasks,
  siteInfo,
  textToSpeechEnabled: true,
  visionConfig,
}

describe('BatchResults（批量结果区，720 单列内）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('批量未启动（isCallBatchAPI=false）不渲染', () => {
    const { container } = render(<BatchResults {...baseProps} isCallBatchAPI={false} />)

    expect(container.firstChild).toBeNull()
  })

  it('批量任务逐项渲染 Res（batch 接线：task inputs/controlRetry/onRunControlChange=undefined）', () => {
    render(<BatchResults {...baseProps} />)

    expect(screen.getByTestId('res-1')).toBeInTheDocument()
    expect(screen.getByTestId('res-2')).toBeInTheDocument()
    expect(resPropsSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        inputs: { name: 'Alpha' },
        isError: false,
        controlRetry: 0,
        taskId: 1,
        isCallBatchAPI: true,
        onRunControlChange: undefined,
      }),
    )
    expect(resPropsSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        inputs: { name: 'Beta' },
        isError: true,
        controlRetry: 88,
        taskId: 2,
      }),
    )
  })

  it('头卡：计数（共/成功/失败）+ 重试失败 + 下载结果 + 任务列表 + 未完成 Loading', () => {
    const handleRetryAllFailedTask = vi.fn()

    render(
      <BatchResults
        {...baseProps}
        allFailedTaskList={[batchTasks[1]!]}
        allSuccessTaskList={[batchTasks[0]!]}
        noPendingTask={false}
        handleRetryAllFailedTask={handleRetryAllFailedTask}
      />,
    )

    // 结果区标题 + 头卡计数
    expect(screen.getByText('share.generation.batchResultTitle')).toBeInTheDocument()
    expect(screen.getByText('share.generation.batchTotal:{"num":2}')).toBeInTheDocument()
    expect(screen.getByText(/batchSuccess:\{"num":1\}/)).toBeInTheDocument()
    expect(screen.getByText(/batchFailedCount:\{"num":1\}/)).toBeInTheDocument()
    // 旧执行数头退役
    expect(screen.queryByText(/generation\.executions/)).not.toBeInTheDocument()
    // 重试失败入卡 + 下载入口
    fireEvent.click(screen.getByRole('button', { name: 'share.generation.retryFailed' }))
    expect(handleRetryAllFailedTask).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('res-download-mock')).toBeInTheDocument()
    // 任务列表 + 未完成 Loading
    expect(screen.getByTestId('res-1')).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'appApi.loading' })).toBeInTheDocument()
  })

  it('无失败：不出失败计数与重试钮', () => {
    render(<BatchResults {...baseProps} allSuccessTaskList={[batchTasks[0]!]} />)

    expect(screen.queryByText(/batchFailedCount/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /retryFailed/ })).not.toBeInTheDocument()
    expect(screen.getByTestId('res-download-mock')).toBeInTheDocument()
  })

  it('无成功：不出下载入口', () => {
    render(<BatchResults {...baseProps} allFailedTaskList={[batchTasks[1]!]} />)

    expect(screen.queryByTestId('res-download-mock')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'share.generation.retryFailed' })).toBeInTheDocument()
  })
})
