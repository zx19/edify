import type { PromptConfig } from '@/models/debug'
import type { SiteInfo } from '@/models/share'
import type { VisionSettings } from '@/types/app'
import { render, screen } from '@testing-library/react'
import { AppSourceType } from '@/service/share'
import { Resolution, TransferMethod } from '@/types/app'
import TextGenerationResultPanel from '../text-generation-result-panel'

const resPropsSpy = vi.fn()

vi.mock('@/app/components/share/text-generation/result', () => ({
  default: (props: Record<string, unknown>) => {
    resPropsSpy(props)
    return <div data-testid={`res-${String(props.taskId ?? 'single')}`} />
  },
}))

const promptConfig: PromptConfig = {
  prompt_template: 'template',
  prompt_variables: [{ key: 'name', name: 'Name', type: 'string', required: true }],
}

const siteInfo: SiteInfo = {
  title: 'Text Generation',
  description: 'Share description',
  icon_type: 'emoji',
  icon: 'robot',
}

const visionConfig: VisionSettings = {
  enabled: false,
  number_limits: 2,
  detail: Resolution.low,
  transfer_methods: [TransferMethod.local_file],
}

const baseProps = {
  appId: 'app-123',
  appSourceType: AppSourceType.webApp,
  completionFiles: [],
  controlRetry: 0,
  controlSend: 77,
  controlStopResponding: 66,
  handleCompleted: vi.fn(),
  handleSaveMessage: vi.fn(async () => {}),
  inputs: { name: 'Alice' },
  isPC: true,
  isWorkflow: false,
  moreLikeThisEnabled: true,
  onRunControlChange: vi.fn(),
  onRunStart: vi.fn(),
  promptConfig,
  siteInfo,
  textToSpeechEnabled: true,
  visionConfig,
}

describe('TextGenerationResultPanel（v2：run 视图右列 pane，批量支路迁出/移动抽屉拆除）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('结果列标题行（生成结果）', () => {
    render(<TextGenerationResultPanel {...baseProps} />)

    expect(screen.getByText('share.generation.completionResult')).toBeInTheDocument()
  })

  it('should render a single result in run-once mode and pass non-batch props', () => {
    render(<TextGenerationResultPanel {...baseProps} />)

    expect(screen.getByTestId('res-single'))!.toBeInTheDocument()
    expect(resPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 'app-123',
        appSourceType: AppSourceType.webApp,
        completionFiles: [],
        controlSend: 77,
        controlStopResponding: 66,
        hideInlineStopButton: true,
        inputs: { name: 'Alice' },
        isCallBatchAPI: false,
        moreLikeThisEnabled: true,
      }),
    )
  })

  it('移动端流内渲染（无抽屉：无 fixed overlay / 无 drag handle）', () => {
    const { container } = render(<TextGenerationResultPanel {...baseProps} isPC={false} />)

    expect(container.querySelector('.fixed')).toBeNull()
    expect(container.querySelector('.cursor-grab')).toBeNull()
    expect(screen.getByTestId('res-single')).toBeInTheDocument()
  })
})
