'use client'

import type { Edge, Node } from 'reactflow'
import { useCallback, useState } from 'react'
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow'
import { EditorNodeCard } from '@/app/components/workflow-editor/node-card'
import { SpikeEdge } from './_components/spike-edge'
import 'reactflow/dist/style.css'

/**
 * C1 spike:画布壳技术验证(批 0)。
 * 验证项:React Flow 在 web-new 构建下工作;新视觉节点/边在真 Handle/Edge 机制上成立;
 * 点阵网格/缩放/minimap 壳件视觉。数据 = 最小 useState(不接协作/撤销)。
 * 此为内部 playground,不进任何生产导航;落地时本页由真编辑器替换。
 */

const nodeTypes = { spike: EditorNodeCard }
const edgeTypes = { spike: SpikeEdge }

const initialNodes: Node[] = [
  {
    id: 'start',
    type: 'spike',
    position: { x: 80, y: 120 },
    data: {
      type: 'start',
      title: '用户输入',
      badge: 'START',
      fields: [
        { name: 'var1', meta: 'required' },
        { name: 'var2', meta: 'required' },
      ],
    },
  },
  {
    id: 'llm',
    type: 'spike',
    position: { x: 380, y: 120 },
    data: {
      type: 'llm',
      title: 'LLM',
      fields: [{ name: 'deepseek-v3', meta: '模型' }],
    },
  },
  {
    id: 'out',
    type: 'spike',
    position: { x: 680, y: 120 },
    data: {
      type: 'answer',
      title: '输出',
      fields: [{ name: 'result', meta: 'string' }],
    },
  },
]

const initialEdges: Edge[] = [
  { id: 'e1', source: 'start', target: 'llm', type: 'spike' },
  { id: 'e2', source: 'llm', target: 'out', type: 'spike' },
]

function ZoomControl() {
  const { zoomIn, zoomOut } = useReactFlow()
  return (
    // bottom-right 但让开 minimap(宽 140 + 间距)
    <div className="absolute right-[168px] bottom-3.5 flex items-center gap-0.5 rounded-xl border border-[#E8E8EA] bg-white px-2 py-1 shadow-xs">
      <button
        type="button"
        aria-label="缩小"
        className="grid size-7 place-items-center rounded-lg hover:bg-[#F7F7F8]"
        onClick={() => zoomOut()}
      >
        −
      </button>
      <span className="min-w-10 text-center text-xs text-[#3D3D42]">缩放</span>
      <button
        type="button"
        aria-label="放大"
        className="grid size-7 place-items-center rounded-lg hover:bg-[#F7F7F8]"
        onClick={() => zoomIn()}
      >
        ＋
      </button>
    </div>
  )
}

function Canvas() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes)
  const [edges, setEdges] = useState<Edge[]>(initialEdges)

  const onNodesChange = useCallback((changes: Parameters<typeof applyNodeChanges>[0]) => {
    setNodes((ns) => applyNodeChanges(changes, ns))
  }, [])
  const onEdgesChange = useCallback((changes: Parameters<typeof applyEdgeChanges>[0]) => {
    setEdges((es) => applyEdgeChanges(changes, es))
  }, [])
  const onConnect = useCallback((conn: Parameters<typeof addEdge>[0]) => {
    setEdges((es) => addEdge({ ...conn, type: 'spike' }, es))
  }, [])

  return (
    <div className="relative h-[70vh] w-full bg-[#FAFAFB]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#D9D9DC" />
        <MiniMap
          className="!rounded-xl !border !border-[#E8E8EA] !shadow-xs"
          nodeColor="#D9D9DC"
          maskColor="rgb(255 140 0 / .06)"
          style={{ width: 140, height: 88 }}
          position="bottom-right"
          pannable
          zoomable
        />
      </ReactFlow>
      {/* 工具轨占位(交互不在 spike 范围) */}
      <div className="absolute top-1/2 left-3.5 flex -translate-y-1/2 flex-col gap-0.5 rounded-xl border border-[#E8E8EA] bg-white p-1.5 shadow-xs">
        {['⊕', '➤', '✋', '▭', '▦', '⋯'].map((i) => (
          <span key={i} className="grid size-7 place-items-center rounded-lg text-[#3D3D42]">
            {i}
          </span>
        ))}
      </div>
      <ZoomControl />
    </div>
  )
}

const GALLERY_TYPES = [
  'start',
  'llm',
  'answer',
  'end',
  'code',
  'if-else',
  'http',
  'knowledge',
] as const
const GALLERY_STATUS = ['default', 'running', 'succeeded', 'failed', 'exception'] as const

function NodeGallery() {
  return (
    <ReactFlowProvider>
      <div className="flex flex-col gap-4 border-t border-[#E8E8EA] bg-white p-6">
        <div className="text-sm font-semibold text-[#0A0A0B]">节点卡片画廊(C2):类型 × 状态</div>
        {GALLERY_STATUS.map((status) => (
          <div key={status} className="flex items-start gap-4">
            <div className="w-24 pt-2 text-xs tracking-wide text-[#8A8A93] uppercase">{status}</div>
            <div className="flex flex-wrap gap-3">
              {GALLERY_TYPES.map((type) => (
                <div key={`${status}-${type}`} className="relative">
                  <EditorNodeCard
                    id={`${status}-${type}`}
                    type="spike"
                    zIndex={0}
                    isConnectable
                    xPos={0}
                    yPos={0}
                    dragging={false}
                    data={{
                      type,
                      title: type === 'start' ? '用户输入' : type,
                      badge: type === 'start' ? 'START' : undefined,
                      fields: [{ name: 'demo', meta: 'string' }],
                      status: status === 'default' ? undefined : status,
                      statusLabel: status,
                    }}
                    selected={false}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ReactFlowProvider>
  )
}

export default function WorkflowCanvasSpikePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>
      <NodeGallery />
    </div>
  )
}
