import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EditorTopbar } from '../index'

afterEach(cleanup)

const labels = {
  back: '返回',
  testRun: '测试运行',
  publish: '发布',
  runHistory: '运行历史',
  checklist: '检查清单',
  envVars: '环境变量',
  versionHistory: '版本历史',
}

describe('EditorTopbar(C5 编辑器顶栏)', () => {
  it('面包屑:中间段可点、末段为当前页非链', async () => {
    const onStudio = vi.fn()
    render(
      <EditorTopbar
        breadcrumbs={[
          { label: '工作室', onClick: onStudio },
          { label: '测试1', onClick: () => {} },
          { label: '编排' },
        ]}
        statusText="已自动保存 17:13"
        labels={labels}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: '工作室' }))
    expect(onStudio).toHaveBeenCalledOnce()
    // 末段非按钮
    expect(screen.queryByRole('button', { name: '编排' })).toBeNull()
    expect(screen.getByText('编排')).toBeInTheDocument()
  })

  it('状态文本与协作头像组渲染;动作回调全通', async () => {
    const onTestRun = vi.fn()
    const onPublish = vi.fn()
    const onRunHistory = vi.fn()
    render(
      <EditorTopbar
        breadcrumbs={[{ label: '编排' }]}
        statusText="已自动保存 17:13 · 已发布 22 天前"
        presenceUsers={[
          { id: '1', name: '张玺' },
          { id: '2', name: '王二' },
        ]}
        onTestRun={onTestRun}
        onPublish={onPublish}
        onRunHistory={onRunHistory}
        labels={labels}
      />,
    )
    expect(screen.getByText('已自动保存 17:13 · 已发布 22 天前')).toBeInTheDocument()
    expect(screen.getByTitle('张玺')).toBeInTheDocument()
    expect(screen.getByTitle('王二')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /测试运行/ }))
    expect(onTestRun).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: /发布/ }))
    expect(onPublish).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: '运行历史' }))
    expect(onRunHistory).toHaveBeenCalledOnce()
  })

  it('动作回调缺省时不渲染对应按钮', () => {
    render(<EditorTopbar breadcrumbs={[{ label: '编排' }]} statusText="" labels={labels} />)
    expect(screen.queryByRole('button', { name: /测试运行/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /发布/ })).toBeNull()
    expect(screen.queryByRole('button', { name: '运行历史' })).toBeNull()
  })
})
