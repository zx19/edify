'use client'

import type { VariableGroup, VariableRef } from '../variable-picker'
import { Switch } from '@xsl/lomva-ui/switch'
import { useState } from 'react'
import { VariablePicker } from '../variable-picker'
import { PanelSectionLabel } from './index'

/**
 * C4 LLM 节点配置段落(代表实现,设计稿 round2 视图 1)。
 * playground 阶段:表单状态本地持有(不回流 store),验证面板形态与交互;
 * 真编辑器落地时状态归 zustand draft slice。labels 由消费方注入(i18n 持有者)。
 */

export type LlmSectionLabels = {
  model: string
  context: string
  setVariable: string
  system: string
  addMessage: string
  vision: string
  reasoningTag: string
  outputVars: string
  retry: string
}

export function LlmSections({
  labels,
  variableGroups = [],
}: {
  labels: LlmSectionLabels
  variableGroups?: VariableGroup[]
}) {
  const [vision, setVision] = useState(false)
  const [reasoning, setReasoning] = useState(false)
  const [retry, setRetry] = useState(false)
  const [system, setSystem] = useState('')
  const [contextVar, setContextVar] = useState<VariableRef | null>(null)

  return (
    <>
      <div className="flex flex-col gap-2">
        <PanelSectionLabel>
          MODEL <span className="text-[#E5484D]">*</span>
        </PanelSectionLabel>
        <div className="flex items-center gap-2 rounded-[10px] bg-[#F7F7F8] px-2.5 py-2 text-xs text-[#3D3D42]">
          <span aria-hidden className="i-ri-sparkling-line text-[#6938EF]" />
          deepseek-v4-flash
          <span className="rounded-full bg-[#EFF6FF] px-1.5 text-[10px] font-semibold text-[#175CD3]">
            CHAT
          </span>
          <span className="ml-auto text-[#8A8A93]">⚙</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <PanelSectionLabel>{labels.context}</PanelSectionLabel>
        {contextVar ? (
          <span className="flex items-center gap-2 rounded-[10px] bg-[#F7F7F8] px-2.5 py-2 text-xs text-[#3D3D42]">
            <span className="rounded-md bg-[#EFF6FF] px-1 font-mono text-[11px] text-[#175CD3]">{`{x}`}</span>
            {contextVar.groupTitle}.{contextVar.name}
            <button
              type="button"
              aria-label="清除"
              className="ml-auto text-[#8A8A93] hover:text-[#E5484D]"
              onClick={() => setContextVar(null)}
            >
              ✕
            </button>
          </span>
        ) : (
          <VariablePicker
            groups={variableGroups}
            onSelect={setContextVar}
            labels={{ search: '搜索变量' }}
            trigger={
              <span className="flex items-center gap-2 rounded-[10px] bg-[#F7F7F8] px-2.5 py-2 text-xs text-[#8A8A93] hover:text-[#E67A00]">
                <span className="font-mono">{`{x}`}</span> {labels.setVariable}
              </span>
            }
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <PanelSectionLabel extra={<span className="flex gap-1.5">✨ Jinja {'{x}'} ⧉ ⤢</span>}>
          SYSTEM
        </PanelSectionLabel>
        <textarea
          aria-label="SYSTEM"
          className="min-h-22 w-full resize-y rounded-[10px] bg-[#F7F7F8] p-2.5 font-mono text-xs text-[#3D3D42] outline-none focus:ring-1 focus:ring-[#FF8C00]"
          value={system}
          onChange={(e) => setSystem(e.target.value)}
          placeholder="你是一个助手……"
        />
        <button
          type="button"
          className="rounded-[10px] border border-dashed border-[#D9D9DC] py-2 text-xs text-[#8A8A93] hover:border-[#FF8C00] hover:text-[#E67A00]"
        >
          + {labels.addMessage}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <PanelSectionLabel>{labels.vision}</PanelSectionLabel>
        <Switch checked={vision} onCheckedChange={setVision} aria-label={labels.vision} />
      </div>
      <div className="flex items-center justify-between">
        <PanelSectionLabel>{labels.reasoningTag}</PanelSectionLabel>
        <Switch
          checked={reasoning}
          onCheckedChange={setReasoning}
          aria-label={labels.reasoningTag}
        />
      </div>
      <div className="flex items-center justify-between">
        <PanelSectionLabel>{labels.outputVars} ▸</PanelSectionLabel>
      </div>
      <div className="flex items-center justify-between">
        <PanelSectionLabel>{labels.retry}</PanelSectionLabel>
        <Switch checked={retry} onCheckedChange={setRetry} aria-label={labels.retry} />
      </div>
    </>
  )
}
