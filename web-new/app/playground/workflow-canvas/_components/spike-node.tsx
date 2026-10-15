'use client'

import type { NodeProps } from 'reactflow'
import { Handle, Position } from 'reactflow'

/**
 * C1 spike:新视觉节点卡(设计稿 2026-10-14-workflow-editor-mockup-round1.html 视图 2)
 * 色值先写字面量,落地时映射 token(accent=#FF8C00 系)。
 */
export type SpikeNodeData = {
  title: string
  icon: string
  iconBg: string
  iconFg: string
  badge?: string
  fields: { name: string; meta?: string }[]
}

export function SpikeNode({ data, selected }: NodeProps<SpikeNodeData>) {
  return (
    <div
      className="rounded-[14px] border bg-white shadow-xs"
      style={{
        width: 224,
        borderColor: selected ? '#FF8C00' : '#E8E8EA',
        boxShadow: selected ? '0 0 0 2px rgb(255 140 0 / .25)' : undefined,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-[#8A8A93] !bg-white hover:!border-[#FF8C00]"
        style={{ left: -5 }}
      />
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span
          className="grid size-6 place-items-center rounded-[7px] text-[13px]"
          style={{ background: data.iconBg, color: data.iconFg }}
        >
          {data.icon}
        </span>
        <span className="text-[13px] font-semibold text-[#0A0A0B]">{data.title}</span>
        {data.badge && (
          <span className="rounded-full bg-[#EFF6FF] px-1.5 text-[10px] font-semibold tracking-wide text-[#175CD3]">
            {data.badge}
          </span>
        )}
        <span className="ml-auto text-[#8A8A93]">⋯</span>
      </div>
      <div className="flex flex-col gap-1.5 px-3 pb-2.5">
        {data.fields.map((f) => (
          <div
            key={f.name}
            className="flex items-center gap-1.5 rounded-[7px] bg-[#F7F7F8] px-2 py-1 text-xs text-[#3D3D42]"
          >
            <span className="font-mono text-[11px]">{`{x}`}</span>
            <span>{f.name}</span>
            {f.meta && (
              <span className="ml-auto text-[10px] tracking-wide text-[#8A8A93] uppercase">
                {f.meta}
              </span>
            )}
          </div>
        ))}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-[#8A8A93] !bg-white hover:!border-[#FF8C00]"
        style={{ right: -5 }}
      />
    </div>
  )
}
