import { fireEvent, render, screen } from '@testing-library/react'
import { AccessMode } from '@/models/access-control'
import TextGeneration from '../index'

const {
  mockMode,
  mockMedia,
  mockAppStateRef,
  mockBatchStateRef,
  resultPanelPropsSpy,
  batchResultsPropsSpy,
  mockSetIsCallBatchAPI,
  mockResetBatchExecution,
  mockHandleRunBatch,
} = vi.hoisted(() => ({
  mockMode: { value: 'create' },
  mockMedia: { value: 'pc' },
  mockAppStateRef: { value: null as unknown },
  mockBatchStateRef: { value: null as unknown },
  resultPanelPropsSpy: vi.fn(),
  batchResultsPropsSpy: vi.fn(),
  mockSetIsCallBatchAPI: vi.fn(),
  mockResetBatchExecution: vi.fn(),
  mockHandleRunBatch: vi.fn(),
}))

vi.mock('@/hooks/use-breakpoints', () => ({
  MediaType: {
    mobile: 'mobile',
    pc: 'pc',
    tablet: 'tablet',
  },
  default: () => mockMedia.value,
}))

vi.mock('@/next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === 'mode' ? mockMode.value : null),
  }),
}))

vi.mock('@/app/components/base/loading', () => ({
  default: ({ type }: { type: string }) => <div data-testid="loading-app">{type}</div>,
}))

vi.mock('../hooks/use-text-generation-app-state', () => ({
  useTextGenerationAppState: () => mockAppStateRef.value,
}))

vi.mock('../hooks/use-text-generation-batch', () => ({
  useTextGenerationBatch: () => mockBatchStateRef.value,
}))

vi.mock('../header', () => ({
  default: (props: { siteInfo: { title: string } }) => (
    <div data-testid="tg-header">{props.siteInfo.title}</div>
  ),
}))

vi.mock('../run-once', () => ({
  __esModule: true,
  default: (props: { onSend: () => void }) => (
    <button type="button" onClick={props.onSend}>
      run-once
    </button>
  ),
}))

vi.mock('../run-batch', () => ({
  __esModule: true,
  default: (props: { onSend: (data: string[][]) => void }) => (
    <button type="button" onClick={() => props.onSend([['name'], ['Alice']])}>
      run-batch
    </button>
  ),
}))

vi.mock('../run-batch/batch-results', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    batchResultsPropsSpy(props)
    return <div data-testid="batch-results" />
  },
}))

vi.mock('../text-generation-result-panel', () => ({
  default: (props: { controlSend: number; controlStopResponding: number }) => {
    resultPanelPropsSpy(props)
    return (
      <div data-testid="result-panel">
        <span data-testid="control-send">{String(props.controlSend)}</span>
        <span data-testid="control-stop">{String(props.controlStopResponding)}</span>
      </div>
    )
  },
}))

vi.mock('@/app/components/app/text-generate/saved-items', () => ({
  default: () => <div data-testid="saved-items" />,
}))

const createAppState = (overrides: Record<string, unknown> = {}) => ({
  accessMode: AccessMode.PUBLIC,
  appId: 'app-1',
  appSourceType: 'webApp',
  customConfig: {
    remove_webapp_brand: false,
    replace_webapp_logo: '',
  },
  handleRemoveSavedMessage: vi.fn(),
  handleSaveMessage: vi.fn(),
  moreLikeThisConfig: { enabled: true },
  promptConfig: {
    prompt_template: '',
    prompt_variables: [{ key: 'name', name: 'Name', type: 'string', required: true }],
  },
  savedMessages: [],
  siteInfo: {
    title: 'Generator',
    description: 'Side description',
  },
  systemFeatures: {},
  textToSpeechConfig: { enabled: true },
  visionConfig: { enabled: false },
  ...overrides,
})

const createBatchState = (overrides: Record<string, unknown> = {}) => ({
  allFailedTaskList: [],
  allSuccessTaskList: [],
  allTaskList: [],
  allTasksRun: true,
  controlRetry: 0,
  exportRes: [],
  handleCompleted: vi.fn(),
  handleRetryAllFailedTask: vi.fn(),
  handleRunBatch: (data: string[][], options: { onStart: () => void }) => {
    mockHandleRunBatch(data, options)
    options.onStart()
    return true
  },
  isCallBatchAPI: false,
  noPendingTask: true,
  resetBatchExecution: () => mockResetBatchExecution(),
  setIsCallBatchAPI: (value: boolean) => mockSetIsCallBatchAPI(value),
  showTaskList: [],
  ...overrides,
})

describe('TextGeneration 壳层（v2：header + segment + 视图 + 壳底 footer）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMode.value = 'create'
    mockMedia.value = 'pc'
    mockAppStateRef.value = createAppState()
    mockBatchStateRef.value = createBatchState()
  })

  it('should render the loading state until app state is ready', () => {
    mockAppStateRef.value = createAppState({ appId: '', siteInfo: null, promptConfig: null })

    render(<TextGeneration />)

    expect(screen.getByTestId('loading-app')).toHaveTextContent('app')
  })

  it('壳层骨架：header + segment(tablist) + 壳底 footer 品牌行（杏树林末级）', () => {
    render(<TextGeneration />)

    expect(screen.getByTestId('tg-header')).toHaveTextContent('Generator')
    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getByText('share.chat.poweredBy')).toBeInTheDocument()
    expect(screen.getByText('杏树林')).toBeInTheDocument()
  })

  it('应用描述卡不再渲染于壳层（并入关于弹窗，09-25 拍板）', () => {
    render(<TextGeneration />)

    expect(screen.queryByText('Side description')).not.toBeInTheDocument()
  })

  it('remove_webapp_brand=true 时 footer 品牌行不渲染', () => {
    mockAppStateRef.value = createAppState({
      customConfig: { remove_webapp_brand: true, replace_webapp_logo: '' },
    })
    render(<TextGeneration />)

    expect(screen.queryByText('share.chat.poweredBy')).not.toBeInTheDocument()
  })

  describe('segment（D8）', () => {
    it('completion 型默认（批量 tab 关）：运行一次 + 已保存（带计数 badge）', () => {
      mockAppStateRef.value = createAppState({
        savedMessages: [{ id: 'm1' }, { id: 'm2' }],
      })
      render(<TextGeneration />)

      expect(screen.getByRole('tab', { name: 'share.generation.tabs.create' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      expect(screen.queryByRole('tab', { name: /tabs\.batch/ })).not.toBeInTheDocument()
      const saved = screen.getByRole('tab', { name: /tabs\.saved/ })
      expect(saved).toHaveTextContent('2')
    })

    it('workflow 型：无已保存 tab', () => {
      render(<TextGeneration isWorkflow />)

      expect(screen.queryByRole('tab', { name: /tabs\.saved/ })).not.toBeInTheDocument()
    })

    it('show_batch_tab=true 时出批量运行 tab；?mode=batch 直达生效', () => {
      mockAppStateRef.value = createAppState({
        siteInfo: {
          title: 'Generator',
          ui_config: { components: { show_batch_tab: true } },
        },
      })
      mockMode.value = 'batch'
      render(<TextGeneration />)

      expect(screen.getByRole('tab', { name: /tabs\.batch/ })).toHaveAttribute(
        'aria-selected',
        'true',
      )
    })

    it('show_batch_tab=false 时 ?mode=batch 落回运行一次（09-22 拍板兜底）', () => {
      mockMode.value = 'batch'
      render(<TextGeneration />)

      expect(screen.getByRole('tab', { name: /tabs\.create/ })).toHaveAttribute(
        'aria-selected',
        'true',
      )
    })

    it('点击切换视图：已保存视图挂载 SavedItems，运行视图 hidden 但不卸载（keepMounted）', () => {
      render(<TextGeneration />)

      fireEvent.click(screen.getByRole('tab', { name: /tabs\.saved/ }))
      expect(screen.getByTestId('saved-items')).toBeInTheDocument()
      // run 视图容器 hidden 但仍在 DOM（keepMounted 手工语义）
      expect(screen.getByRole('button', { name: 'run-once' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('tab', { name: /tabs\.create/ }))
      expect(screen.queryByTestId('saved-items')).not.toBeInTheDocument()
    })

    it('segment 支持方向键循环切换（tablist 键盘语义）', () => {
      mockAppStateRef.value = createAppState({
        siteInfo: {
          title: 'Generator',
          ui_config: { components: { show_batch_tab: true } },
        },
      })
      render(<TextGeneration />)

      const list = screen.getByRole('tablist')
      fireEvent.keyDown(list, { key: 'ArrowRight' })
      expect(screen.getByRole('tab', { name: /tabs\.batch/ })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      fireEvent.keyDown(list, { key: 'ArrowLeft' })
      expect(screen.getByRole('tab', { name: /tabs\.create/ })).toHaveAttribute(
        'aria-selected',
        'true',
      )
    })
  })

  describe('运行一次视图（D7 双列）', () => {
    it('容器查询双列骨架类在场（@container + @[900px] 退化）', () => {
      const { container } = render(<TextGeneration />)

      expect(container.querySelector('.\\@container')).not.toBeNull()
      expect(container.innerHTML).toContain('@[900px]:flex-row')
      expect(container.innerHTML).toContain('@[900px]:w-[360px]')
    })

    it('should orchestrate a run-once request（controlSend 推进 + 批量态复位）', () => {
      render(<TextGeneration />)

      fireEvent.click(screen.getByRole('button', { name: 'run-once' }))

      expect(mockSetIsCallBatchAPI).toHaveBeenCalledWith(false)
      expect(mockResetBatchExecution).toHaveBeenCalledTimes(1)
      expect(Number(screen.getByTestId('control-send').textContent)).toBeGreaterThan(0)
    })
  })

  describe('批量视图', () => {
    it('批量视图 = RunBatch + BatchResults 同列（720 单列）', () => {
      mockAppStateRef.value = createAppState({
        siteInfo: {
          title: 'Generator',
          ui_config: { components: { show_batch_tab: true } },
        },
      })
      render(<TextGeneration />)

      // batch 视图常驻（keepMounted hidden 切换）
      expect(screen.getByRole('button', { name: 'run-batch' })).toBeInTheDocument()
      expect(batchResultsPropsSpy).toHaveBeenCalled()
    })

    it('should orchestrate batch runs through the batch hook', () => {
      mockAppStateRef.value = createAppState({
        siteInfo: {
          title: 'Generator',
          ui_config: { components: { show_batch_tab: true } },
        },
      })
      mockMode.value = 'batch'
      render(<TextGeneration />)

      fireEvent.click(screen.getByRole('button', { name: 'run-batch' }))

      expect(mockHandleRunBatch).toHaveBeenCalledWith(
        [['name'], ['Alice']],
        expect.objectContaining({ onStart: expect.any(Function) }),
      )
      expect(Number(screen.getByTestId('control-stop').textContent)).toBeGreaterThan(0)
    })
  })

  it('isInstalledApp：壳层 h-full + 圆角卡片（嵌入面保留）', () => {
    const { container } = render(<TextGeneration isInstalledApp />)

    const shell = container.querySelector('.webapp-theme') as HTMLElement
    expect(shell).toHaveClass('h-full', 'rounded-2xl')
  })

  it('should fall back to create mode for unsupported query params', () => {
    mockMode.value = 'unsupported'

    render(<TextGeneration isInstalledApp />)

    expect(screen.getByRole('tab', { name: /tabs\.create/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })
})
