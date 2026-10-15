import type { Meta, StoryObj } from '@storybook/react-vite'
import * as React from 'react'
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
} from '.'

const meta: Meta = {
  title: 'Lomva UI/Table',
}
export default meta
type Story = StoryObj

const rows = [
  {
    id: '1',
    name: 'M4验收-邀请',
    owner: 'm4-newbie',
    members: 1,
    status: '正常',
    created: '2026-10-13 16:22',
  },
  {
    id: '2',
    name: 'M4验收-直加',
    owner: '测试1',
    members: 1,
    status: '正常',
    created: '2026-10-13 16:22',
  },
  {
    id: '3',
    name: '张玺的 Workspace',
    owner: '张玺',
    members: 2,
    status: '归档',
    created: '2026-08-19 18:06',
  },
]

export const Basic: Story = {
  render: () => (
    <Table>
      <TableHeader sticky>
        <TableRow>
          <TableHead>名称</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead sortable sortDirection={null} onSort={() => {}}>
            成员数
          </TableHead>
          <TableHead>状态</TableHead>
          <TableHead sortable sortDirection="desc" onSort={() => {}}>
            创建时间
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>{r.name}</TableCell>
            <TableCell>{r.owner}</TableCell>
            <TableCell>{r.members}</TableCell>
            <TableCell>{r.status}</TableCell>
            <TableCell>{r.created}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
}

export const Expandable: Story = {
  render: () => (
    <Table>
      <TableHeader sticky>
        <TableRow>
          <TableHead className="w-10">
            <span className="sr-only">展开</span>
          </TableHead>
          <TableHead>名称</TableHead>
          <TableHead>邮箱</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableExpandableRow
            key={r.id}
            detailColSpan={2}
            toggleLabel="展开"
            detail={
              <div className="text-xs text-text-secondary">
                空间清单:张玺's Workspace·owner · 加入于 {r.created}
              </div>
            }
          >
            <TableCell>{r.owner}</TableCell>
            <TableCell>{r.owner}@xingshulin.com</TableCell>
          </TableExpandableRow>
        ))}
      </TableBody>
    </Table>
  ),
}

export const LoadingAndEmpty: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <Table>
        <TableHeader sticky>
          <TableRow>
            <TableHead>名称</TableHead>
            <TableHead>Owner</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableSkeletonRows rows={4} cols={2} />
        </TableBody>
      </Table>
      <Table>
        <TableHeader sticky>
          <TableRow>
            <TableHead>名称</TableHead>
            <TableHead>Owner</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableEmpty colSpan={2}>暂无数据</TableEmpty>
        </TableBody>
      </Table>
    </div>
  ),
}
