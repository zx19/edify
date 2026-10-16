'use client'

import { cn } from '@xsl/lomva-ui/cn'
import { IconButton } from '@xsl/lomva-ui/icon-button'
import { useState } from 'react'

/**
 * C6 调试面板(设计稿 round2 视图 3):Test Run 浮卡,四 tab(INPUT/RESULT/DETAIL/TRACING)。
 * 用户视角纪律(JSON OUTPUT 教训):RESULT 默认结构化(输出 + 节点执行序列),
 * 原始 JSON 收「原始数据」折叠区主动点开;DETAIL/TRACING 同样结构化呈现。
 * labels 由 i18n 持有者注入。
 */

export type DebugRunStatus = 'idle' | 'running' | 'succeeded' | 'failed'

export type NodeRunRecord = {
  nodeId: string
  title: string
  status: 'running' | 'succeeded' | 'failed'
  duration?: string
  tokens?: number
}

export type EditorDebugPanelProps = {
  status: DebugRunStatus
  /** 上次运行状态文案(如「上次成功 2.1s」) */
  lastRunText?: string
  inputFields: { name: string; label: string; required?: boolean }[]
  onStartRun: (values: Record<string, string>) => void
  records: NodeRunRecord[]
  output?: string
  /** 原始数据(折叠区内容) */
  rawJson?: string
  onClose: () => void
  labels: {
    title: string
    input: string
    result: string
    detail: string
    tracing: string
    startRun: string
    outputSection: string
    nodeRuns: string
    rawToggle: string
    close: string
  }
}

const TABS = ['input', 'result', 'detail', 'tracing'] as const
type Tab = (typeof TABS)[number]

const STATUS_DOT: Record<NodeRunRecord['status'], string> = {
  running: 'bg-[#4A90E2] animate-pulse',
  succeeded: 'bg-[#12A150]',
  failed: 'bg-[#E5484D]',
}

export function EditorDebugPanel({
  status,
  lastRunText,
  inputFields,
  onStartRun,
  records,
  output,
  rawJson,
  onClose,
  labels,
}: EditorDebugPanelProps) {
  const [tab, setTab] = useState<Tab>('input')
  const [values, setValues] = useState<Record<string, string>>({})
  const [rawOpen, setRawOpen] = useState(false)

  const tabLabel = (t: Tab) =>
    ({
      input: labels.input,
      result: labels.result,
      detail: labels.detail,
      tracing: labels.tracing,
    })[t]

  return (
    <aside
      aria-label={labels.title}
      className="absolute top-3 right-3 bottom-3 z-20 flex w-[372px] flex-col overflow-hidden rounded-[14px] border border-[#E8E8EA] bg-white shadow-[0_10px_34px_rgb(10_10_11/.10)]"
    >
      <div className="flex items-center gap-2 border-b border-[#E8E8EA] px-3.5 py-3">
        <span className="text-sm font-semibold text-[#0A0A0B]">{labels.title}</span>
        {status === 'running' && (
          <span className="flex items-center gap-1.5 text-xs text-[#4A90E2]">
            <span className="size-2 animate-pulse rounded-full bg-[#4A90E2]" />
            Running
          </span>
        )}
        {status === 'succeeded' && lastRunText && (
          <span className="flex items-center gap-1.5 text-xs text-[#12A150]">
            <span className="size-2 rounded-full bg-[#12A150]" />
            {lastRunText}
          </span>
        )}
        {status === 'failed' && (
          <span className="flex items-center gap-1.5 text-xs text-[#E5484D]">
            <span className="size-2 rounded-full bg-[#E5484D]" />
            Failed
          </span>
        )}
        <IconButton
          size="sm"
          variant="ghost"
          aria-label={labels.close}
          className="ml-auto"
          onClick={onClose}
        >
          <span aria-hidden className="i-ri-close-line size-4" />
        </IconButton>
      </div>

      <div className="flex border-b border-[#E8E8EA] px-3.5" role="tablist">
        {TABS.map((t) => {
          const active = tab === t
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              className={cn(
                'mr-4 border-b-2 py-2 text-[11px] font-semibold tracking-wider',
                active
                  ? 'border-[#FF8C00] text-[#0A0A0B]'
                  : 'border-transparent text-[#8A8A93] hover:text-[#3D3D42]',
              )}
              onClick={() => setTab(t)}
            >
              {tabLabel(t)}
            </button>
          )
        })}
      </div>

      <div className="flex grow flex-col gap-3.5 overflow-auto p-3.5">
        {tab === 'input' && (
          <>
            {inputFields.map((f) => (
              <div key={f.name} className="flex flex-col gap-1.5">
                <label htmlFor={`dbg-${f.name}`} className="text-xs text-[#3D3D42]">
                  {f.label}
                  {f.required && <span className="text-[#E5484D]"> *</span>}
                </label>
                <input
                  id={`dbg-${f.name}`}
                  className="rounded-[9px] bg-[#F7F7F8] px-2.5 py-2 text-xs text-[#0A0A0B] outline-none focus:ring-1 focus:ring-[#FF8C00]"
                  value={values[f.name] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  placeholder={f.label}
                />
              </div>
            ))}
            <button
              type="button"
              disabled={status === 'running'}
              className="rounded-[10px] bg-[#FF8C00] py-2.5 text-[13px] font-semibold text-white hover:bg-[#E67A00] disabled:opacity-50"
              onClick={() => onStartRun(values)}
            >
              {labels.startRun}
            </button>
          </>
        )}

        {(tab === 'result' || tab === 'detail' || tab === 'tracing') && (
          <>
            {output !== undefined && tab === 'result' && (
              <>
                <div className="text-[11px] font-semibold tracking-wider text-[#3D3D42] uppercase">
                  {labels.outputSection}
                </div>
                <div className="rounded-[10px] bg-[#F7F7F8] p-2.5 font-mono text-xs whitespace-pre-wrap text-[#3D3D42]">
                  {output}
                </div>
              </>
            )}
            <div className="text-[11px] font-semibold tracking-wider text-[#3D3D42] uppercase">
              {labels.nodeRuns}
            </div>
            {records.length === 0 && <div className="text-xs text-[#8A8A93]">—</div>}
            {records.map((r) => (
              <div
                key={r.nodeId}
                className="flex items-center gap-2 rounded-[10px] border border-[#E8E8EA] px-2.5 py-2 text-xs"
              >
                <span className={cn('size-2 rounded-full', STATUS_DOT[r.status])} />
                <span className="text-[#0A0A0B]">{r.title}</span>
                <span className="ml-auto font-mono text-[10.5px] text-[#8A8A93]">
                  {[r.duration, r.tokens !== undefined ? `${r.tokens} tokens` : undefined]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
            ))}
            {rawJson !== undefined && (
              <>
                <button
                  type="button"
                  aria-expanded={rawOpen}
                  className="rounded-[10px] border border-dashed border-[#D9D9DC] px-2.5 py-2 text-left text-xs text-[#8A8A93] hover:border-[#FF8C00] hover:text-[#E67A00]"
                  onClick={() => setRawOpen((v) => !v)}
                >
                  {rawOpen ? '▾' : '▸'} {labels.rawToggle}
                </button>
                {rawOpen && (
                  <pre className="overflow-auto rounded-[10px] bg-[#0A0A0B] p-2.5 font-mono text-[11px] text-[#E8E8EA]">
                    {rawJson}
                  </pre>
                )}
              </>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
