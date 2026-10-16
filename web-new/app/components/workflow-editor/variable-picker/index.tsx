'use client'

import type { ReactNode } from 'react'
import { cn } from '@xsl/lomva-ui/cn'
import { Popover, PopoverContent, PopoverTrigger } from '@xsl/lomva-ui/popover'
import { useMemo, useState } from 'react'

/**
 * C7 变量选择器(设计稿 round2 视图 2;QA 实证结构:搜索 + 按来源节点分组 + 类型右置):
 * 触发器由消费方供给(字段行/插入位),浮层走 lomva-ui Popover(portal/focus/外点关闭)。
 * 选中回填形态由消费方决定(onSelect 给全量来源信息)。
 */

export type VariableGroup = {
  id: string
  title: string
  icon?: string
  vars: { name: string; type: string }[]
}

export type VariableRef = { groupId: string; groupTitle: string; name: string; type: string }

export function VariablePicker({
  groups,
  onSelect,
  trigger,
  labels,
}: {
  groups: VariableGroup[]
  onSelect: (v: VariableRef) => void
  trigger: ReactNode
  labels: { search: string }
}) {
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return groups
    return groups
      .map((g) => ({ ...g, vars: g.vars.filter((v) => v.name.toLowerCase().includes(kw)) }))
      .filter((g) => g.vars.length > 0)
  }, [groups, keyword])

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setKeyword('')
      }}
    >
      {/* PopoverTrigger 自身渲染 button,trigger 内容须为非 button 元素 */}
      <PopoverTrigger className="w-full text-left">{trigger}</PopoverTrigger>
      <PopoverContent
        placement="bottom-start"
        sideOffset={4}
        className="w-[330px] overflow-hidden rounded-xl border border-[#E8E8EA] bg-white p-0 shadow-[0_10px_34px_rgb(10_10_11/.10)]"
      >
        <div className="border-b border-[#E8E8EA] p-2">
          <input
            aria-label={labels.search}
            className="w-full rounded-lg bg-[#F7F7F8] px-2.5 py-1.5 text-xs text-[#0A0A0B] outline-none focus:ring-1 focus:ring-[#FF8C00]"
            placeholder={`🔍 ${labels.search}`}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
        <div className="max-h-72 overflow-auto p-1.5">
          {filtered.length === 0 && <div className="px-2 py-3 text-xs text-[#8A8A93]">—</div>}
          {filtered.map((g) => (
            <div key={g.id} className="mb-1 last:mb-0">
              <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-[#8A8A93]">
                {g.icon && <span aria-hidden>{g.icon}</span>}
                {g.title}
              </div>
              {g.vars.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[#3D3D42]',
                    'hover:bg-[#FFF3E0] hover:text-[#E67A00]',
                  )}
                  onClick={() => {
                    onSelect({ groupId: g.id, groupTitle: g.title, name: v.name, type: v.type })
                    setOpen(false)
                    setKeyword('')
                  }}
                >
                  <span className="font-mono text-[11px]">{g.id === 'sys' ? '⊠' : '{x}'}</span>
                  <span className="truncate">{v.name}</span>
                  <span className="ml-auto font-mono text-[10.5px] text-[#8A8A93]">{v.type}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
