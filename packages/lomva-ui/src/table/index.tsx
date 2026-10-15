'use client'

import * as React from 'react'
import { cn } from '../cn'
import { IconButton } from '../icon-button'

/**
 * Table 原语(无旧轨对应物,API 自设计——见 2026-10-14 拍稿边界):
 * 组合式原子件,职责 = 表格容器/表头/行/单元格 + sticky 表头 + 排序指示 +
 * 可展开行 + 骨架/空态。不做:选择列、虚拟滚动、列宽拖拽、内置分页器
 * (分页用 ../pagination 组合)、数据驱动大 API。
 * 视觉 = 新语言 token(本原语无旧视觉对齐义务)。
 */

type DivProps = React.ComponentPropsWithoutRef<'div'>

export function Table({
  className,
  tableClassName,
  children,
  ...rest
}: DivProps & { tableClassName?: string }) {
  return (
    <div
      className={cn('min-h-0 overflow-auto rounded-xl border border-divider-subtle', className)}
      {...rest}
    >
      <table
        className={cn(
          'w-full table-fixed text-left system-sm-regular text-text-secondary',
          tableClassName,
        )}
      >
        {children}
      </table>
    </div>
  )
}

export function TableHeader({
  className,
  sticky,
  ...rest
}: React.ComponentPropsWithoutRef<'thead'> & { sticky?: boolean }) {
  return (
    <thead
      className={cn(
        'system-xs-semibold-uppercase text-text-tertiary',
        sticky && 'sticky top-0 z-10 bg-components-panel-bg',
        className,
      )}
      {...rest}
    />
  )
}

export function TableBody(props: React.ComponentPropsWithoutRef<'tbody'>) {
  return <tbody {...props} />
}

export function TableRow({ className, ...rest }: React.ComponentPropsWithoutRef<'tr'>) {
  return (
    <tr
      className={cn(
        'border-b border-divider-regular last:border-b-0 hover:bg-state-base-hover',
        rest.onClick && 'cursor-pointer',
        className,
      )}
      {...rest}
    />
  )
}

type TableHeadProps = React.ComponentPropsWithoutRef<'th'> & {
  /** 可排序表头:渲染排序按钮与方向指示;onSort 由消费方控制状态 */
  sortable?: boolean
  sortDirection?: 'asc' | 'desc' | null
  onSort?: () => void
}

export function TableHead({
  className,
  sortable,
  sortDirection,
  onSort,
  children,
  ...rest
}: TableHeadProps) {
  const ariaSort = !sortable
    ? undefined
    : sortDirection === 'asc'
      ? 'ascending'
      : sortDirection === 'desc'
        ? 'descending'
        : 'none'
  return (
    <th className={cn('px-3 py-2 font-medium', className)} aria-sort={ariaSort} {...rest}>
      {sortable ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 hover:text-text-primary"
          onClick={onSort}
        >
          {children}
          <span aria-hidden className="text-[10px]">
            {sortDirection === 'asc' ? '▲' : sortDirection === 'desc' ? '▼' : '↕'}
          </span>
        </button>
      ) : (
        children
      )}
    </th>
  )
}

export function TableCell({ className, ...rest }: React.ComponentPropsWithoutRef<'td'>) {
  return <td className={cn('px-3 py-2', className)} {...rest} />
}

type TableExpandableRowProps = {
  /** 展开后显示在第二行的内容(跨除展开钮列外的全部列) */
  detail: React.ReactNode
  /** detail 行的跨列数 = 主行单元格数(不含展开钮列)。显式传入而非 Children.count——后者对 fragment 脆弱 */
  detailColSpan: number
  /** 展开钮的可访问名(如「展开/收起」) */
  toggleLabel: string
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

/** 可展开行:首列自带展开钮;展开时第二行跨列渲染 detail(浅底) */
export function TableExpandableRow({
  detail,
  detailColSpan,
  toggleLabel,
  defaultOpen,
  onOpenChange,
  children,
}: TableExpandableRowProps) {
  const [open, setOpen] = React.useState(!!defaultOpen)
  const toggle = () => {
    const next = !open
    setOpen(next)
    onOpenChange?.(next)
  }
  return (
    <>
      <TableRow>
        <TableCell className="w-10 px-2">
          <IconButton
            size="sm"
            variant="ghost"
            aria-label={toggleLabel}
            aria-expanded={open}
            onClick={toggle}
          >
            <span
              aria-hidden
              className={cn('size-4', open ? 'i-ri-arrow-down-s-line' : 'i-ri-arrow-right-s-line')}
            />
          </IconButton>
        </TableCell>
        {children}
      </TableRow>
      {open && (
        <tr className="border-b border-divider-regular bg-background-default-subtle">
          <td />
          <td colSpan={detailColSpan} className="px-3 py-2">
            {detail}
          </td>
        </tr>
      )}
    </>
  )
}

export function TableSkeletonRows({ rows = 5, cols }: { rows?: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="border-b border-divider-regular last:border-b-0">
          {Array.from({ length: cols }, (_, c) => (
            <td key={c} className="px-3 py-2">
              <div className="h-4 animate-pulse rounded bg-state-base-hover" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function TableEmpty({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-10 text-center text-text-tertiary">
        {children}
      </td>
    </tr>
  )
}
