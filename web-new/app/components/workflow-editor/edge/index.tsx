'use client'

import type { EdgeProps } from 'reactflow'
import { useId } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from 'reactflow'

/**
 * C3 编辑器边(语义照抄旧轨 custom-edge):
 * - 常态灰/选中橙(2px)/hover 加深
 * - _dimmed(0.3)/_waitingRun(0.7) 透明度语义;_isTemp 虚线(8 8)
 * - 流经渐变:按源/目标节点运行状态着色(running 蓝/succeeded 绿/failed 红)
 * - 中点「+」插入钮:选中或 hover 可见,点击回调 data.onInsertEdge(由消费方做图手术)
 * - 右键菜单不在本件内:经 onEdgeContextMenu(画布层)暴露
 */

export type EditorEdgeStatus = 'running' | 'succeeded' | 'failed'

export type EditorEdgeData = {
  dimmed?: boolean
  waitingRun?: boolean
  isTemp?: boolean
  /** 源/目标节点运行状态(驱动流经渐变) */
  sourceStatus?: EditorEdgeStatus
  targetStatus?: EditorEdgeStatus
  /** 中点插入回调(消费方实现:删本边、插节点、接两条新边) */
  onInsertEdge?: (edgeId: string) => void
}

const STATUS_COLOR: Record<EditorEdgeStatus, string> = {
  running: '#4A90E2',
  succeeded: '#12A150',
  failed: '#E5484D',
}

export function EditorEdge(props: EdgeProps<EditorEdgeData>) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    selected,
    data = {},
  } = props
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })
  const gradientId = useId().replace(/:/g, '')

  const hasGradient = !!(data.sourceStatus || data.targetStatus)
  const stroke = selected ? '#FF8C00' : hasGradient ? `url(#${gradientId})` : '#C9C9CE'

  return (
    <>
      {hasGradient && (
        <defs>
          <linearGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            x1={sourceX}
            y1={sourceY}
            x2={targetX}
            y2={targetY}
          >
            <stop offset="0%" stopColor={STATUS_COLOR[data.sourceStatus ?? data.targetStatus!]} />
            <stop offset="100%" stopColor={STATUS_COLOR[data.targetStatus ?? data.sourceStatus!]} />
          </linearGradient>
        </defs>
      )}
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke,
          strokeWidth: selected ? 2 : 1.5,
          opacity: data.dimmed ? 0.3 : data.waitingRun ? 0.7 : 1,
          strokeDasharray: data.isTemp ? '8 8' : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <button
          type="button"
          className="nodrag nopan absolute grid size-[18px] place-items-center rounded-full border-[1.5px] border-[#FF8C00] bg-white text-[11px] leading-none text-[#E67A00] transition-opacity hover:scale-125"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            opacity: selected ? 1 : 0,
            pointerEvents: selected ? 'auto' : 'none',
          }}
          aria-label={`在边 ${id} 中点插入节点`}
          onClick={() => data.onInsertEdge?.(id)}
        >
          +
        </button>
      </EdgeLabelRenderer>
    </>
  )
}

/** C3 连接中线条(拖拽连线时) */
export function EditorConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
}: {
  fromX: number
  fromY: number
  toX: number
  toY: number
}) {
  return (
    <g>
      <path
        fill="none"
        stroke="#8A8A93"
        strokeWidth={1.5}
        strokeDasharray="6 4"
        d={`M${fromX},${fromY} C ${(fromX + toX) / 2},${fromY} ${(fromX + toX) / 2},${toY} ${toX},${toY}`}
      />
      <circle cx={toX} cy={toY} r={4} fill="#fff" stroke="#8A8A93" strokeWidth={1.5} />
    </g>
  )
}
