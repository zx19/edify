import type { EditorNodeCardData } from '../index'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from 'reactflow'
import { afterEach, describe, expect, it } from 'vitest'
import { EditorNodeCard } from '../index'

afterEach(cleanup)

function renderCard(data: EditorNodeCardData, selected = false) {
  return render(
    <ReactFlowProvider>
      {/* @ts-expect-error NodeProps 在测试里手造 */}
      <EditorNodeCard data={data} selected={selected} />
    </ReactFlowProvider>,
  )
}

const baseData: EditorNodeCardData = {
  type: 'llm',
  title: 'LLM',
  fields: [{ name: 'deepseek-v3', meta: '模型' }],
}

describe('EditorNodeCard(C2 节点卡片)', () => {
  it('渲染标题/类型 chip/字段行/双连接点,默认态无边框高亮', () => {
    const { container, getByTestId } = renderCard(baseData)
    const card = getByTestId('editor-node-card')
    expect(card.dataset.status).toBe('default')
    expect(card.dataset.type).toBe('llm')
    expect(screen.getByText('LLM')).toBeInTheDocument()
    expect(screen.getByText('deepseek-v3')).toBeInTheDocument()
    expect(screen.getByText('模型')).toBeInTheDocument()
    expect(container.querySelectorAll('.react-flow__handle')).toHaveLength(2)
    // 默认态无状态徽标
    expect(card.querySelector('[title]')).toBeNull()
  })

  it('selected prop 覆盖 data.status,呈选中态', () => {
    const { getByTestId } = renderCard({ ...baseData, status: 'failed' }, true)
    expect(getByTestId('editor-node-card').dataset.status).toBe('selected')
  })

  it('running/succeeded/failed/exception 四态徽标与边框各就位', () => {
    const cases = [
      { status: 'running', icon: 'i-ri-loader-4-line', border: '#4A90E2' },
      { status: 'succeeded', icon: 'i-ri-check-line', border: '' },
      { status: 'failed', icon: 'i-ri-close-line', border: '#E5484D' },
      { status: 'exception', icon: 'i-ri-alert-line', border: '#D97706' },
    ] as const
    for (const c of cases) {
      const { getByTestId, unmount } = renderCard({
        ...baseData,
        status: c.status,
        statusLabel: c.status,
      })
      const card = getByTestId('editor-node-card')
      expect(card.dataset.status).toBe(c.status)
      expect(card.querySelector(`.${CSS.escape(c.icon)}`)).not.toBeNull()
      if (c.border) expect(card.className).toContain(c.border)
      expect(screen.getByLabelText(c.status)).toBeInTheDocument()
      unmount()
    }
  })

  it('badge 文本(如 START)与无字段时省略字段区', () => {
    const { container } = renderCard({
      type: 'start',
      title: '用户输入',
      badge: 'START',
      fields: [],
    })
    expect(screen.getByText('START')).toBeInTheDocument()
    expect(container.querySelector('.bg-\\[\\#F7F7F8\\]')).toBeNull()
  })
})
