import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from 'reactflow'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { SpikeNode } from '../_components/spike-node'
import WorkflowCanvasSpikePage from '../page'

// React Flow 在 jsdom 需要 ResizeObserver / DOMMatrixReadOnly
beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', RO)
  // @ts-expect-error 仅 jsdom 缺该构造器
  globalThis.DOMMatrixReadOnly = class {
    constructor() {
      return { m22: 1 }
    }
  }
})

afterEach(cleanup)

const nodeData = {
  title: 'LLM',
  icon: '◈',
  iconBg: '#F4F3FF',
  iconFg: '#6938EF',
  badge: 'CHAT',
  fields: [{ name: 'deepseek-v3', meta: '模型' }],
}

describe('SpikeNode(新视觉节点卡)', () => {
  it('渲染标题/徽标/字段行与左右连接点', () => {
    const { container } = render(
      <ReactFlowProvider>
        {/* @ts-expect-error NodeProps 在测试里手造 */}
        <SpikeNode data={nodeData} selected={false} />
      </ReactFlowProvider>,
    )
    expect(screen.getByText('LLM')).toBeInTheDocument()
    expect(screen.getByText('CHAT')).toBeInTheDocument()
    expect(screen.getByText('deepseek-v3')).toBeInTheDocument()
    expect(screen.getByText('模型')).toBeInTheDocument()
    expect(container.querySelectorAll('.react-flow__handle')).toHaveLength(2)
  })

  it('选中态呈现橙色描边', () => {
    const { container } = render(
      <ReactFlowProvider>
        {/* @ts-expect-error NodeProps 在测试里手造 */}
        <SpikeNode data={nodeData} selected />
      </ReactFlowProvider>,
    )
    const card = container.firstElementChild as HTMLElement
    expect(card.style.borderColor).toBe('#FF8C00')
  })
})

describe('画布壳 spike 页', () => {
  it('渲染 3 节点 + 壳件(缩放/minimap/工具轨)', async () => {
    const { container } = render(<WorkflowCanvasSpikePage />)
    expect(await screen.findByText('用户输入')).toBeInTheDocument()
    expect(screen.getByText('LLM')).toBeInTheDocument()
    expect(screen.getByText('输出')).toBeInTheDocument()
    expect(container.querySelectorAll('.react-flow__node').length).toBe(3)
    // 边的 DOM 依赖节点尺寸测量(ResizeObserver),jsdom 桩不下发——边渲染由浏览器走查验证
    expect(container.querySelector('.react-flow__edges')).not.toBeNull()
    expect(container.querySelector('.react-flow__minimap')).not.toBeNull()
    expect(screen.getByLabelText('缩小')).toBeInTheDocument()
    expect(screen.getByLabelText('放大')).toBeInTheDocument()
  })
})
