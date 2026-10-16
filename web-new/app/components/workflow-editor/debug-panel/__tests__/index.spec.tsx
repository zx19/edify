import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EditorDebugPanel } from '../index'

afterEach(cleanup)

const labels = {
  title: 'Test Run',
  input: 'INPUT',
  result: 'RESULT',
  detail: 'DETAIL',
  tracing: 'TRACING',
  startRun: '开始运行',
  outputSection: '输出',
  nodeRuns: '节点执行',
  rawToggle: '原始数据',
  close: '关闭',
}

const base = {
  status: 'idle' as const,
  inputFields: [{ name: 'var1', label: 'var1', required: true }],
  records: [],
  onClose: () => {},
  labels,
}

describe('EditorDebugPanel(C6 调试面板)', () => {
  it('INPUT:变量表单+开始运行回调携带输入值', async () => {
    const onStartRun = vi.fn()
    render(<EditorDebugPanel {...base} onStartRun={onStartRun} />)
    await userEvent.type(screen.getByLabelText(/var1/), '测试值')
    await userEvent.click(screen.getByRole('button', { name: '开始运行' }))
    expect(onStartRun).toHaveBeenCalledWith({ var1: '测试值' })
  })

  it('RESULT:结构化输出+节点执行序列;原始数据默认折叠、点开可见', async () => {
    render(
      <EditorDebugPanel
        {...base}
        status="succeeded"
        lastRunText="上次成功 2.1s"
        output="你好世界"
        records={[
          { nodeId: 'n1', title: 'LLM', status: 'succeeded', duration: '1.8s', tokens: 214 },
        ]}
        rawJson='{"a":1}'
        onStartRun={() => {}}
      />,
    )
    await userEvent.click(screen.getByRole('tab', { name: 'RESULT' }))
    expect(screen.getByText('你好世界')).toBeInTheDocument()
    expect(screen.getByText('LLM')).toBeInTheDocument()
    expect(screen.getByText(/214 tokens/)).toBeInTheDocument()
    expect(screen.getByText('上次成功 2.1s')).toBeInTheDocument()
    // 原始数据折叠纪律
    expect(screen.queryByText('{"a":1}')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /原始数据/ }))
    expect(screen.getByText('{"a":1}')).toBeInTheDocument()
  })

  it('running 态禁用开始按钮,关闭回调就位', async () => {
    const onClose = vi.fn()
    render(<EditorDebugPanel {...base} status="running" onStartRun={() => {}} onClose={onClose} />)
    expect(screen.getByRole('button', { name: '开始运行' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
