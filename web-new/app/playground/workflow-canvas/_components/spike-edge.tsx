'use client'

import type { EdgeProps } from 'reactflow'
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from 'reactflow'

/**
 * C1 spike:新视觉边(设计稿视图 3)——贝塞尔细线,选中橙,中点 hover 出「+」插入钮。
 */
export function SpikeEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected } = props
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: selected ? '#FF8C00' : '#C9C9CE',
          strokeWidth: selected ? 2 : 1.5,
        }}
      />
      <EdgeLabelRenderer>
        <button
          type="button"
          className="nodrag nopan absolute grid size-[18px] place-items-center rounded-full border-[1.5px] border-[#FF8C00] bg-white text-[11px] leading-none text-[#E67A00] transition-opacity"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            opacity: selected ? 1 : 0,
            pointerEvents: selected ? 'auto' : 'none',
          }}
          aria-label={`在边 ${id} 中点插入节点`}
        >
          +
        </button>
      </EdgeLabelRenderer>
    </>
  )
}
