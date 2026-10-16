import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VariablePicker } from '../index'

afterEach(cleanup)

const groups = [
  {
    id: 'start',
    title: '用户输入',
    icon: '⌨',
    vars: [
      { name: 'var1', type: 'String' },
      { name: 'var2', type: 'String' },
      { name: 'files', type: 'Array[File]' },
    ],
  },
  {
    id: 'sys',
    title: 'SYSTEM',
    vars: [
      { name: 'sys.user_id', type: 'String' },
      { name: 'sys.app_id', type: 'String' },
    ],
  },
]

describe('VariablePicker(C7 变量选择器)', () => {
  it('触发器唤起,按来源分组渲染,选中回调带全量来源信息并关闭', async () => {
    const onSelect = vi.fn()
    render(
      <VariablePicker
        groups={groups}
        onSelect={onSelect}
        labels={{ search: '搜索变量' }}
        trigger={<span>设置变量</span>}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: '设置变量' }))
    expect(await screen.findByText('用户输入')).toBeInTheDocument()
    expect(screen.getByText('SYSTEM')).toBeInTheDocument()
    expect(screen.getByText('Array[File]')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /var1/ }))
    expect(onSelect).toHaveBeenCalledWith({
      groupId: 'start',
      groupTitle: '用户输入',
      name: 'var1',
      type: 'String',
    })
  })

  it('搜索过滤:命中保留组,未命中组隐藏', async () => {
    render(
      <VariablePicker
        groups={groups}
        onSelect={() => {}}
        labels={{ search: '搜索变量' }}
        trigger={<span>设置变量</span>}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: '设置变量' }))
    await userEvent.type(await screen.findByLabelText('搜索变量'), 'app')
    expect(screen.queryByText('用户输入')).not.toBeInTheDocument()
    expect(screen.getByText('SYSTEM')).toBeInTheDocument()
    expect(screen.getByText('sys.app_id')).toBeInTheDocument()
  })
})
