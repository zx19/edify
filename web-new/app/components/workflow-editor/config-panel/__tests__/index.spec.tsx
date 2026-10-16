import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EditorConfigPanel } from '../index'
import { LlmSections } from '../llm-sections'

afterEach(cleanup)

const node = { id: 'n1', type: 'llm' as const, title: 'LLM', fields: [] }

const labels = {
  settings: 'SETTINGS',
  lastRun: 'LAST RUN',
  runNode: '运行此节点',
  docs: '文档',
  more: '更多',
  close: '关闭',
  editTitle: '标题',
}

const llmLabels = {
  model: 'MODEL',
  context: 'CONTEXT',
  setVariable: '设置变量',
  system: 'SYSTEM',
  addMessage: '添加消息',
  vision: 'VISION',
  reasoningTag: 'REASONING TAG',
  outputVars: 'OUTPUT VARIABLES',
  retry: 'RETRY ON FAILURE',
}

describe('EditorConfigPanel(C4 配置面板壳)', () => {
  it('渲染标题/tabs/段落,关闭与标题编辑回调就位', async () => {
    const onClose = vi.fn()
    const onTitleChange = vi.fn()
    render(
      <EditorConfigPanel
        node={node}
        labels={labels}
        onClose={onClose}
        onTitleChange={onTitleChange}
        sections={<div>段落A</div>}
      />,
    )
    expect(screen.getByText('段落A')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'SETTINGS' })).toHaveAttribute('aria-selected', 'true')

    await userEvent.click(screen.getByRole('tab', { name: 'LAST RUN' }))
    expect(screen.queryByText('段落A')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'SETTINGS' }))
    const titleInput = screen.getByLabelText('标题')
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, '改名')
    expect(onTitleChange).toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('LLM 段落渲染段落集,开关可切', async () => {
    render(
      <EditorConfigPanel
        node={node}
        labels={labels}
        onClose={() => {}}
        sections={<LlmSections labels={llmLabels} />}
      />,
    )
    expect(screen.getByText('deepseek-v4-flash')).toBeInTheDocument()
    const visionSwitch = screen.getByRole('switch', { name: 'VISION' })
    expect(visionSwitch).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(visionSwitch)
    expect(visionSwitch).toHaveAttribute('aria-checked', 'true')
  })
})
