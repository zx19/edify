'use client'

import type { Edge, Node } from 'reactflow'
import { useCallback, useRef, useState } from 'react'
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
import { EditorConfigPanel } from '@/app/components/workflow-editor/config-panel'
import { LlmSections } from '@/app/components/workflow-editor/config-panel/llm-sections'
import { EditorDebugPanel } from '@/app/components/workflow-editor/debug-panel'
import { EditorConnectionLine, EditorEdge } from '@/app/components/workflow-editor/edge'
import { isValidEditorConnection } from '@/app/components/workflow-editor/edge/is-valid-connection'
import { EditorTopbar } from '@/app/components/workflow-editor/editor-topbar'
import { EditorNodeCard } from '@/app/components/workflow-editor/node-card'
import 'reactflow/dist/style.css'

/**
 * C1 spike:画布壳技术验证(批 0)。
 * 验证项:React Flow 在 web-new 构建下工作;新视觉节点/边在真 Handle/Edge 机制上成立;
 * 点阵网格/缩放/minimap 壳件视觉。数据 = 最小 useState(不接协作/撤销)。
 * 此为内部 playground,不进任何生产导航;落地时本页由真编辑器替换。
 */

const nodeTypes = { spike: EditorNodeCard }
const edgeTypes = { spike: EditorEdge }

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

  // C3:中点插入手术——删本边、插入节点、接两条新边
  const [insertTarget, setInsertTarget] = useState<string | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null)

  // C4:配置面板——点击节点开,点空白/关钮关;标题编辑回流画布(数据链路验证点)
  const [panelNodeId, setPanelNodeId] = useState<string | null>(null)

  // C6:调试面板 + 假运行编排(状态系统全链演示:节点徽标/边流经渐变/面板记录)
  const [debugOpen, setDebugOpen] = useState(false)
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'succeeded' | 'failed'>('idle')
  const [records, setRecords] = useState<
    {
      nodeId: string
      title: string
      status: 'running' | 'succeeded' | 'failed'
      duration?: string
      tokens?: number
    }[]
  >([])
  const [runOutput, setRunOutput] = useState<string | undefined>(undefined)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const startFakeRun = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setRunStatus('running')
    setRecords([])
    setRunOutput(undefined)
    const order = ['start', 'llm', 'out']
    order.forEach((nodeId, i) => {
      timersRef.current.push(
        setTimeout(() => {
          setNodes((ns) =>
            ns.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, status: 'running' } } : n)),
          )
          setEdges((es) =>
            es.map((e) =>
              e.source === nodeId || e.target === nodeId
                ? {
                    ...e,
                    data: {
                      ...e.data,
                      sourceStatus: e.source === nodeId ? 'running' : undefined,
                      targetStatus: e.target === nodeId ? 'running' : undefined,
                    },
                  }
                : e,
            ),
          )
          setRecords((rs) => [
            ...rs.filter((r) => r.nodeId !== nodeId),
            {
              nodeId,
              title: nodes.find((n) => n.id === nodeId)?.data.title ?? nodeId,
              status: 'running',
            },
          ])
        }, i * 900),
      )
      timersRef.current.push(
        setTimeout(
          () => {
            setNodes((ns) =>
              ns.map((n) =>
                n.id === nodeId ? { ...n, data: { ...n.data, status: 'succeeded' } } : n,
              ),
            )
            setEdges((es) =>
              es.map((e) =>
                e.source === nodeId || e.target === nodeId
                  ? {
                      ...e,
                      data: {
                        ...e.data,
                        sourceStatus: e.source === nodeId ? 'succeeded' : e.data?.sourceStatus,
                        targetStatus: e.target === nodeId ? 'succeeded' : e.data?.targetStatus,
                      },
                    }
                  : e,
              ),
            )
            setRecords((rs) =>
              rs.map((r) =>
                r.nodeId === nodeId
                  ? {
                      ...r,
                      status: 'succeeded',
                      duration: `${(0.7 + i * 0.5).toFixed(1)}s`,
                      tokens: nodeId === 'llm' ? 214 : undefined,
                    }
                  : r,
              ),
            )
          },
          i * 900 + 700,
        ),
      )
    })
    timersRef.current.push(
      setTimeout(
        () => {
          setRunStatus('succeeded')
          setRunOutput('Did you mean to send a message? Let me know what you need help with.')
        },
        order.length * 900 + 400,
      ),
    )
  }, [nodes])
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => setPanelNodeId(node.id), [])
  const onTitleChange = useCallback((id: string, title: string) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, title } } : n)))
  }, [])

  const handleInsert = useCallback(
    (nodeType: 'llm' | 'code' | 'if-else') => {
      const edgeId = insertTarget
      if (!edgeId) return
      setInsertTarget(null)
      setEdges((es) => {
        const edge = es.find((e) => e.id === edgeId)
        if (!edge) return es
        const newId = `ins-${Date.now()}`
        setNodes((ns) => {
          const src = ns.find((n) => n.id === edge.source)
          const tgt = ns.find((n) => n.id === edge.target)
          const midX = ((src?.position.x ?? 0) + (tgt?.position.x ?? 300)) / 2
          const midY = ((src?.position.y ?? 0) + (tgt?.position.y ?? 0)) / 2
          return [
            ...ns,
            {
              id: newId,
              type: 'spike',
              position: { x: midX, y: midY + 120 },
              data: { type: nodeType, title: nodeType, fields: [] },
            },
          ]
        })
        return [
          ...es.filter((e) => e.id !== edgeId),
          { id: `${edgeId}-a`, source: edge.source, target: newId, type: 'spike' },
          { id: `${edgeId}-b`, source: newId, target: edge.target, type: 'spike' },
        ]
      })
    },
    [insertTarget],
  )

  const panelNode = panelNodeId ? (nodes.find((n) => n.id === panelNodeId) ?? null) : null

  const onEdgeContextMenu = useCallback((e: React.MouseEvent, edge: Edge) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, edgeId: edge.id })
  }, [])

  return (
    <div className="relative flex h-[70vh] w-full flex-col bg-[#FAFAFB]">
      <EditorTopbar
        breadcrumbs={[{ label: '工作室' }, { label: '测试1' }, { label: '编排' }]}
        statusText="已自动保存 17:13 · 已发布 22 天前"
        presenceUsers={[{ id: '1', name: '张玺' }]}
        onTestRun={() => setDebugOpen(true)}
        onPublish={() => {}}
        onRunHistory={() => {}}
        onVersionHistory={() => {}}
        labels={{
          back: '返回',
          testRun: '测试运行',
          publish: '发布',
          runHistory: '运行历史',
          checklist: '检查清单',
          envVars: '环境变量',
          versionHistory: '版本历史',
        }}
      />
      <div className="relative grow">
        <ReactFlow
          nodes={nodes}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          edges={edges.map((e) => ({ ...e, data: { ...e.data, onInsertEdge: setInsertTarget } }))}
          connectionLineComponent={EditorConnectionLine}
          isValidConnection={(conn) => isValidEditorConnection(conn, edges)}
          onEdgeContextMenu={onEdgeContextMenu}
          onNodeClick={onNodeClick}
          onPaneClick={() => {
            setCtxMenu(null)
            setPanelNodeId(null)
          }}
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
      </div>
      {/* 工具轨占位(交互不在 spike 范围) */}
      <div className="absolute top-1/2 left-3.5 flex -translate-y-1/2 flex-col gap-0.5 rounded-xl border border-[#E8E8EA] bg-white p-1.5 shadow-xs">
        {['⊕', '➤', '✋', '▭', '▦', '⋯'].map((i) => (
          <span key={i} className="grid size-7 place-items-center rounded-lg text-[#3D3D42]">
            {i}
          </span>
        ))}
      </div>
      {debugOpen && (
        <EditorDebugPanel
          status={runStatus}
          lastRunText={runStatus === 'succeeded' ? '上次成功 2.1s' : undefined}
          inputFields={[
            { name: 'var1', label: 'var1', required: true },
            { name: 'var2', label: 'var2', required: true },
          ]}
          onStartRun={startFakeRun}
          records={records}
          output={runOutput}
          rawJson={runOutput ? JSON.stringify({ text: runOutput }, null, 2) : undefined}
          onClose={() => setDebugOpen(false)}
          labels={{
            title: 'Test Run',
            input: 'INPUT',
            result: 'RESULT',
            detail: 'DETAIL',
            tracing: 'TRACING',
            startRun: '开始运行',
            outputSection: '输出',
            nodeRuns: '节点执行',
            rawToggle: '原始数据(节点输入/输出 JSON)——默认折叠,作者需要时再展开',
            close: '关闭',
          }}
        />
      )}
      {panelNode && (
        <EditorConfigPanel
          node={{ ...panelNode.data, id: panelNode.id }}
          labels={{
            settings: 'SETTINGS',
            lastRun: 'LAST RUN',
            runNode: '运行此节点',
            docs: '文档',
            more: '更多',
            close: '关闭',
            editTitle: '标题',
          }}
          className={debugOpen ? 'right-[396px]' : undefined}
          onClose={() => setPanelNodeId(null)}
          onTitleChange={onTitleChange}
          sections={
            <PanelSections
              type={panelNode.data.type}
              fields={panelNode.data.fields}
              nodes={nodes}
            />
          }
        />
      )}
      <ZoomControl />
      {insertTarget && (
        <div className="absolute top-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-[#E8E8EA] bg-white p-2 shadow-md">
          <span className="px-1 text-xs text-[#8A8A93]">插入节点:</span>
          {(['llm', 'code', 'if-else'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className="rounded-lg border border-[#E8E8EA] px-2.5 py-1 text-xs hover:border-[#FF8C00] hover:text-[#E67A00]"
              onClick={() => handleInsert(t)}
            >
              {t}
            </button>
          ))}
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-xs text-[#8A8A93]"
            onClick={() => setInsertTarget(null)}
          >
            ✕
          </button>
        </div>
      )}
      {ctxMenu && (
        <div
          className="fixed z-50 rounded-xl border border-[#E8E8EA] bg-white p-1 shadow-md"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-xs text-[#E5484D] hover:bg-[#FDECEC]"
            onClick={() => {
              setEdges((es) => es.filter((e) => e.id !== ctxMenu.edgeId))
              setCtxMenu(null)
            }}
          >
            删除边
          </button>
        </div>
      )}
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

/** 各类型节点的段落内容(playground 最小实现;LLM 为代表全形态) */
function PanelSections({
  type,
  fields,
  nodes,
}: {
  type: string
  fields: { name: string; meta?: string }[]
  nodes: Node[]
}) {
  if (type === 'llm') {
    return (
      <LlmSections
        variableGroups={[
          {
            id: 'start',
            title: '用户输入',
            icon: '⌨',
            vars: (nodes.find((n) => n.data.type === 'start')?.data.fields ?? []).map(
              (f: { name: string }) => ({ name: f.name, type: 'String' }),
            ),
          },
          {
            id: 'sys',
            title: 'SYSTEM',
            vars: [
              { name: 'sys.user_id', type: 'String' },
              { name: 'sys.app_id', type: 'String' },
              { name: 'sys.workflow_id', type: 'String' },
            ],
          },
        ]}
        labels={{
          model: 'MODEL',
          context: 'CONTEXT',
          setVariable: '设置变量',
          system: 'SYSTEM',
          addMessage: '添加消息',
          vision: 'VISION',
          reasoningTag: 'ENABLE REASONING TAG SEPARATION',
          outputVars: 'OUTPUT VARIABLES',
          retry: 'RETRY ON FAILURE',
        }}
      />
    )
  }
  if (type === 'start') {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-[11px] font-semibold tracking-wider text-[#3D3D42] uppercase">
          Input Field
        </div>
        {fields.map((f) => (
          <div
            key={f.name}
            className="flex items-center gap-2 rounded-[10px] bg-[#F7F7F8] px-2.5 py-2 text-xs text-[#3D3D42]"
          >
            <span className="font-mono">{`{x}`}</span> {f.name}
            <span className="ml-auto text-[10px] text-[#8A8A93] uppercase">{f.meta}</span>
          </div>
        ))}
        <button
          type="button"
          className="rounded-[10px] border border-dashed border-[#D9D9DC] py-2 text-xs text-[#8A8A93]"
        >
          + 添加字段
        </button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {fields.map((f) => (
        <div
          key={f.name}
          className="flex items-center gap-2 rounded-[10px] bg-[#F7F7F8] px-2.5 py-2 text-xs text-[#3D3D42]"
        >
          <span className="font-mono">{`{ }`}</span> {f.name}
          <span className="ml-auto text-[10px] text-[#8A8A93] uppercase">{f.meta}</span>
        </div>
      ))}
    </div>
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
