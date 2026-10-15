import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
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

describe('画布壳 spike 页', () => {
  it('渲染 3 节点 + 壳件(缩放/minimap/工具轨)', async () => {
    const { container } = render(<WorkflowCanvasSpikePage />)
    // 画廊区同题卡会造成重复文本,改断言至少一处存在
    expect((await screen.findAllByText('用户输入')).length).toBeGreaterThan(0)
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
