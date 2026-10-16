'use client'

import { cn } from '@xsl/lomva-ui/cn'
import { IconButton } from '@xsl/lomva-ui/icon-button'

/**
 * C5 编辑器顶栏(壳层架构 L1 顶栏的编辑器实例;设计稿 round1 顶栏 + shell-nav §3 面包屑):
 * 左 = 面包屑(返回与路径合一,中间段可点);中 = 保存/发布状态;右 = 协作头像组 + 操作组。
 * 动作全部回调注入(发布/测试运行/历史等由画布壳接线);labels 由 i18n 持有者注入。
 */

export type TopbarBreadcrumb = {
  label: string
  /** 中间段可点;末段(当前页)无 onClick 恒为非链 */
  onClick?: () => void
}

export type EditorTopbarProps = {
  breadcrumbs: TopbarBreadcrumb[]
  statusText: string
  presenceUsers?: { id: string; name: string }[]
  onTestRun?: () => void
  onPublish?: () => void
  onRunHistory?: () => void
  onChecklist?: () => void
  onEnvVars?: () => void
  onVersionHistory?: () => void
  labels: {
    back: string
    testRun: string
    publish: string
    runHistory: string
    checklist: string
    envVars: string
    versionHistory: string
  }
}

export function EditorTopbar({
  breadcrumbs,
  statusText,
  presenceUsers,
  onTestRun,
  onPublish,
  onRunHistory,
  onChecklist,
  onEnvVars,
  onVersionHistory,
  labels,
}: EditorTopbarProps) {
  return (
    <div className="flex h-11 items-center gap-2.5 border-b border-[#E8E8EA] bg-white px-3.5 text-xs text-[#8A8A93]">
      <nav aria-label={labels.back} className="flex items-center gap-1 text-[#3D3D42]">
        {breadcrumbs.map((b, i) => {
          const last = i === breadcrumbs.length - 1
          return (
            <span key={b.label} className="flex items-center gap-1">
              {i === 0 && <span aria-hidden>‹</span>}
              {b.onClick && !last ? (
                <button type="button" className="hover:text-[#0A0A0B]" onClick={b.onClick}>
                  {b.label}
                </button>
              ) : (
                <span className={last ? 'text-[#0A0A0B]' : undefined}>
                  {last ? <b>{b.label}</b> : b.label}
                </span>
              )}
              {!last && <span className="text-[#D9D9DC]">/</span>}
            </span>
          )
        })}
      </nav>
      <span className="text-[#D9D9DC]">|</span>
      <span>{statusText}</span>

      <span className="grow" />

      {presenceUsers && presenceUsers.length > 0 && (
        <span className="flex items-center">
          {presenceUsers.map((u, i) => (
            <span
              key={u.id}
              title={u.name}
              className={cn(
                'grid size-[22px] place-items-center rounded-full text-[10px] text-white',
                i % 2 === 0 ? 'bg-[#0A0A0B]' : 'bg-[#FF8C00]',
                i > 0 && '-ml-1.5 border-[1.5px] border-white',
              )}
            >
              {u.name.slice(0, 1)}
            </span>
          ))}
        </span>
      )}
      {onTestRun && (
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-[9px] border border-[#E8E8EA] px-3 py-1.5 text-xs text-[#3D3D42] hover:border-[#D9D9DC]"
          onClick={onTestRun}
        >
          <span aria-hidden>▶</span> {labels.testRun}
        </button>
      )}
      {onRunHistory && (
        <IconButton size="sm" variant="ghost" aria-label={labels.runHistory} onClick={onRunHistory}>
          <span aria-hidden className="i-ri-history-line size-4" />
        </IconButton>
      )}
      {onChecklist && (
        <IconButton size="sm" variant="ghost" aria-label={labels.checklist} onClick={onChecklist}>
          <span aria-hidden className="i-ri-checkbox-multiple-line size-4" />
        </IconButton>
      )}
      {onEnvVars && (
        <IconButton size="sm" variant="ghost" aria-label={labels.envVars} onClick={onEnvVars}>
          <span aria-hidden className="i-ri-braces-line size-4" />
        </IconButton>
      )}
      {onPublish && (
        <button
          type="button"
          className="rounded-[9px] bg-[#FF8C00] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#E67A00]"
          onClick={onPublish}
        >
          {labels.publish} ▾
        </button>
      )}
      {onVersionHistory && (
        <IconButton
          size="sm"
          variant="ghost"
          aria-label={labels.versionHistory}
          onClick={onVersionHistory}
        >
          <span aria-hidden className="i-ri-git-branch-line size-4" />
        </IconButton>
      )}
    </div>
  )
}
