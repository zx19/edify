'use client'

import type { NodeProps } from 'reactflow'
import { cn } from '@xsl/lomva-ui/cn'
import { Handle, Position } from 'reactflow'

/**
 * C2 编辑器节点卡片(设计稿 2026-10-14-workflow-editor-mockup-round1.html 视图 2/3)。
 * 状态模型照抄旧轨语义(默认/选中/运行/成功/失败/异常),视觉为新语言:
 * 选中橙环、运行蓝(running 为低风险假设)、成功绿章、失败红、异常琥珀——走查可推翻。
 * 徽标 icon-only,可访问名经 statusLabel 由消费方(i18n 持有者)注入。
 */

export type EditorNodeStatus =
  | 'default'
  | 'selected'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'exception'

/** C2 代表类型集(全量类型映射随各节点批次扩充) */
export type EditorNodeType =
  | 'start'
  | 'llm'
  | 'answer'
  | 'end'
  | 'code'
  | 'if-else'
  | 'http'
  | 'knowledge'

export type EditorNodeField = {
  icon?: string
  name: string
  meta?: string
}

export type EditorNodeCardData = {
  type: EditorNodeType
  title: string
  badge?: string
  fields: EditorNodeField[]
  status?: EditorNodeStatus
  /** 状态徽标的可访问名/title(i18n 由消费方注入) */
  statusLabel?: string
}

/** 类型色板:语义照抄旧轨 block-icon 映射,软色对为新语言 pill 系 */
const TYPE_STYLE: Record<EditorNodeType, { icon: string; chip: string }> = {
  start: { icon: 'i-ri-home-5-line', chip: 'bg-[#EFF6FF] text-[#175CD3]' },
  llm: { icon: 'i-ri-sparkling-line', chip: 'bg-[#F4F3FF] text-[#6938EF]' },
  answer: { icon: 'i-ri-chat-quote-line', chip: 'bg-[#FFF6E8] text-[#B76400]' },
  end: { icon: 'i-ri-stop-circle-line', chip: 'bg-[#FFF6E8] text-[#B76400]' },
  code: { icon: 'i-ri-code-s-slash-line', chip: 'bg-[#EFF6FF] text-[#175CD3]' },
  'if-else': { icon: 'i-ri-git-fork-line', chip: 'bg-[#ECFEFF] text-[#0E7490]' },
  http: { icon: 'i-ri-global-line', chip: 'bg-[#F4F3FF] text-[#6938EF]' },
  knowledge: { icon: 'i-ri-book-2-line', chip: 'bg-[#E9F9EF] text-[#12A150]' },
}

const STATUS_BADGE: Record<
  Exclude<EditorNodeStatus, 'default' | 'selected'>,
  { icon: string; cls: string }
> = {
  running: {
    icon: 'i-ri-loader-4-line animate-spin',
    cls: 'bg-[#EFF6FF] text-[#175CD3] border-[#BFDBFE]',
  },
  succeeded: { icon: 'i-ri-check-line', cls: 'bg-[#E9F9EF] text-[#12A150] border-[#B9EBC9]' },
  failed: { icon: 'i-ri-close-line', cls: 'bg-[#FDECEC] text-[#E5484D] border-[#F5B5B8]' },
  exception: { icon: 'i-ri-alert-line', cls: 'bg-[#FFF6E8] text-[#B76400] border-[#F5DCB0]' },
}

function borderClass(status: EditorNodeStatus) {
  switch (status) {
    case 'selected':
      return 'border-[#FF8C00] shadow-[0_0_0_2px_rgb(255_140_0/.25)]'
    case 'running':
      return 'border-[#4A90E2] shadow-[0_0_0_2px_rgb(74_144_226/.18)]'
    case 'failed':
      return 'border-[#E5484D] shadow-[0_0_0_2px_rgb(229_72_77/.15)]'
    case 'exception':
      return 'border-[#D97706] shadow-[0_0_0_2px_rgb(217_119_6/.15)]'
    default:
      return 'border-[#E8E8EA] hover:border-[#D9D9DC]'
  }
}

export function EditorNodeCard({ data, selected }: NodeProps<EditorNodeCardData>) {
  const status: EditorNodeStatus = selected ? 'selected' : (data.status ?? 'default')
  const typeStyle = TYPE_STYLE[data.type]
  const badge = status !== 'default' && status !== 'selected' ? STATUS_BADGE[status] : null

  return (
    <div
      className={cn(
        'w-56 rounded-[14px] border bg-white shadow-xs transition-colors',
        borderClass(status),
      )}
      data-testid="editor-node-card"
      data-status={status}
      data-type={data.type}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !rounded-full !border-2 !border-[#8A8A93] !bg-white hover:!border-[#FF8C00]"
        style={{ left: -5 }}
      />
      {badge && (
        <span
          title={data.statusLabel}
          aria-label={data.statusLabel}
          className={cn(
            'absolute -top-2 right-2.5 grid size-[18px] place-items-center rounded-full border text-[11px]',
            badge.cls,
          )}
        >
          <span aria-hidden className={badge.icon} />
        </span>
      )}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span
          className={cn('grid size-6 place-items-center rounded-[7px] text-sm', typeStyle.chip)}
        >
          <span aria-hidden className={typeStyle.icon} />
        </span>
        <span className="truncate text-[13px] font-semibold text-[#0A0A0B]">{data.title}</span>
        {data.badge && (
          <span className="rounded-full bg-[#EFF6FF] px-1.5 text-[10px] font-semibold tracking-wide text-[#175CD3]">
            {data.badge}
          </span>
        )}
      </div>
      {data.fields.length > 0 && (
        <div className="flex flex-col gap-1.5 px-3 pb-2.5">
          {data.fields.map((f) => (
            <div
              key={f.name}
              className="flex items-center gap-1.5 rounded-[7px] bg-[#F7F7F8] px-2 py-1 text-xs text-[#3D3D42]"
            >
              <span className="font-mono text-[11px]">{f.icon ?? '{x}'}</span>
              <span className="truncate">{f.name}</span>
              {f.meta && (
                <span className="ml-auto shrink-0 text-[10px] tracking-wide text-[#8A8A93] uppercase">
                  {f.meta}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !rounded-full !border-2 !border-[#8A8A93] !bg-white hover:!border-[#FF8C00]"
        style={{ right: -5 }}
      />
    </div>
  )
}
