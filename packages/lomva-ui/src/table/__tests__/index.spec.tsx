import { userEvent } from 'vite-plus/test/browser'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableExpandableRow,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeletonRows,
} from '../index'

function BasicTable() {
  return (
    <Table>
      <TableHeader sticky>
        <TableRow>
          <TableHead>名称</TableHead>
          <TableHead sortable sortDirection="asc" onSort={() => {}}>
            创建时间
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>A</TableCell>
          <TableCell>2026-10-15</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

describe('Table 原语', () => {
  it('渲染表头/行/单元格,sticky 表头类生效', async () => {
    const screen = await render(<BasicTable />)
    await expect.element(screen.getByText('名称')).toBeInTheDocument()
    await expect.element(screen.getByText('A')).toBeInTheDocument()
    const thead = document.querySelector('thead')!
    expect(thead.className).toContain('sticky')
    expect(thead.className).toContain('top-0')
  })

  it('可排序表头带 aria-sort 与方向指示,点击触发 onSort', async () => {
    const onSort = vi.fn()
    const screen = await render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead sortable sortDirection="desc" onSort={onSort}>
              创建时间
            </TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    )
    expect(document.querySelector('th')!.getAttribute('aria-sort')).toBe('descending')
    await userEvent.click(screen.getByRole('button', { name: /创建时间/ }))
    expect(onSort).toHaveBeenCalledOnce()
  })

  it('sortDirection 为空时 aria-sort=none 且指示为中性', async () => {
    await render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead sortable sortDirection={null} onSort={() => {}}>
              创建时间
            </TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    )
    expect(document.querySelector('th')!.getAttribute('aria-sort')).toBe('none')
    expect(document.querySelector('th')!.textContent).toContain('↕')
  })

  it('可展开行:默认收起,点击展开 detail,再次点击收起', async () => {
    const screen = await render(
      <Table>
        <TableBody>
          <TableExpandableRow detailColSpan={2} toggleLabel="展开" detail={<div>详情内容</div>}>
            <TableCell>主行</TableCell>
            <TableCell>第二列</TableCell>
          </TableExpandableRow>
        </TableBody>
      </Table>,
    )
    expect(document.querySelector('[data-testid="__detail__"]')).toBeNull()
    const toggle = screen.getByRole('button', { name: '展开' })
    await expect.element(toggle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(toggle)
    await expect.element(screen.getByText('详情内容')).toBeInTheDocument()
    await expect.element(toggle).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(toggle)
    expect(document.body.textContent).not.toContain('详情内容')
  })

  it('骨架行与空态按列数渲染', async () => {
    const screen = await render(
      <Table>
        <TableBody>
          <TableSkeletonRows rows={3} cols={4} />
          <TableEmpty colSpan={4}>暂无数据</TableEmpty>
        </TableBody>
      </Table>,
    )
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(12)
    await expect.element(screen.getByText('暂无数据')).toBeInTheDocument()
  })
})
