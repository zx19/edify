'use client'

import type { ReactNode } from 'react'
import type { EditorNodeCardData } from '../node-card'
import { cn } from '@xsl/lomva-ui/cn'
import { IconButton } from '@xsl/lomva-ui/icon-button'
import { useState } from 'react'
import { TYPE_STYLE } from '../node-card/type-style'

/**
 * C4 配置面板壳(设计稿 2026-10-14-workflow-editor-mockup-round2.html 视图 1):
 * 圆角浮卡贴右(12px 边距)、标题行(类型 chip + 标题 + 运行/文档/更多/关闭)+
 * SETTINGS / LAST RUN 双 tab + 段落流正文。
 * 面板只持 tab 态;标题编辑经 onTitleChange 回流(画布↔面板数据链路的验证点);
 * 段落内容由消费方按节点类型供给(本轮 LLM 为代表实现,见 ./llm-sections)。
 */

export type PanelTab = 'settings' | 'last-run'

export type EditorConfigPanelProps = {
  node: EditorNodeCardData & { id: string }
  sections: ReactNode
  onClose: () => void
  onTitleChange?: (id: string, title: string) => void
  onRunNode?: (id: string) => void
  /** LAST RUN tab 内容(可选,缺省为占位) */
  lastRun?: ReactNode
  /** 追加类名(如调试双栏并行时的让位) */
  className?: string
  labels: {
    settings: string
    lastRun: string
    runNode: string
    docs: string
    more: string
    close: string
    editTitle: string
  }
}

export function EditorConfigPanel({
  node,
  sections,
  onClose,
  onTitleChange,
  onRunNode,
  lastRun,
  labels,
  className,
}: EditorConfigPanelProps) {
  const [tab, setTab] = useState<PanelTab>('settings')

  return (
    <aside
      aria-label={node.title}
      className={cn(
        'absolute top-3 right-3 bottom-3 z-10 flex w-[400px] flex-col overflow-hidden rounded-[14px] border border-[#E8E8EA] bg-white shadow-[0_10px_34px_rgb(10_10_11/.10)]',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-[#E8E8EA] px-3.5 py-3">
        <span
          className={cn(
            'grid size-7 place-items-center rounded-lg text-sm',
            TYPE_STYLE[node.type].chip,
          )}
        >
          <span aria-hidden className={TYPE_STYLE[node.type].icon} />
        </span>
        <input
          aria-label={labels.editTitle}
          className="min-w-0 grow rounded-md px-1 text-sm font-semibold text-[#0A0A0B] outline-none hover:bg-[#F7F7F8] focus:bg-[#F7F7F8]"
          value={node.title}
          onChange={(e) => onTitleChange?.(node.id, e.target.value)}
        />
        {onRunNode && (
          <IconButton
            size="sm"
            variant="ghost"
            aria-label={labels.runNode}
            onClick={() => onRunNode(node.id)}
          >
            <span aria-hidden className="i-ri-play-line size-4" />
          </IconButton>
        )}
        <IconButton size="sm" variant="ghost" aria-label={labels.docs}>
          <span aria-hidden className="i-ri-book-open-line size-4" />
        </IconButton>
        <IconButton size="sm" variant="ghost" aria-label={labels.more}>
          <span aria-hidden className="i-ri-more-line size-4" />
        </IconButton>
        <IconButton size="sm" variant="ghost" aria-label={labels.close} onClick={onClose}>
          <span aria-hidden className="i-ri-close-line size-4" />
        </IconButton>
      </div>
      <div className="flex border-b border-[#E8E8EA] px-3.5" role="tablist">
        {(['settings', 'last-run'] as const).map((key) => {
          const active = tab === key
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              className={cn(
                'mr-4 border-b-2 py-2 text-[11px] font-semibold tracking-wider',
                active
                  ? 'border-[#FF8C00] text-[#0A0A0B]'
                  : 'border-transparent text-[#8A8A93] hover:text-[#3D3D42]',
              )}
              onClick={() => setTab(key)}
            >
              {key === 'settings' ? labels.settings : labels.lastRun}
            </button>
          )
        })}
      </div>
      <div className="flex grow flex-col gap-3.5 overflow-auto p-3.5">
        {tab === 'settings'
          ? sections
          : (lastRun ?? <div className="text-xs text-[#8A8A93]">—</div>)}
      </div>
    </aside>
  )
}

/** 段落标题(大写小字) */
export function PanelSectionLabel({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-[#3D3D42] uppercase">
      {children}
      {extra && <span className="ml-auto font-normal text-[#8A8A93] normal-case">{extra}</span>}
    </div>
  )
}
