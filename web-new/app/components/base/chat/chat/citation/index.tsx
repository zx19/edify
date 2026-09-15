import type { FC } from 'react'
import type { CitationItem } from '../type'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Popup from './popup'

export type Resources = {
  documentId: string
  documentName: string
  dataSourceType: string
  sources: CitationItem[]
}

type CitationProps = {
  data: CitationItem[]
  showHitInfo?: boolean
}

/**
 * 引用来源（chat 单元重写，mockup 类型1 消息区）：折叠条 + 卡片列表。
 * - 折叠条：「引用了 N 个来源」+ chevron，点击展开/收起
 * - 卡片列表：每文档一卡（序号/文件名/摘要/score pill），点击卡片开 Popup 命中详情
 * 交互变化经功能对照表批准（原单行 pill + 宽度测量机制废弃，citation-measurement-item 退役）。
 */
const Citation: FC<CitationProps> = ({ data, showHitInfo }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const resources = useMemo(
    () =>
      data.reduce((prev: Resources[], next) => {
        const documentId = next.document_id
        const documentName = next.document_name
        const dataSourceType = next.data_source_type
        const documentIndex = prev.findIndex((i) => i.documentId === documentId)

        if (documentIndex > -1) {
          prev[documentIndex]!.sources.push(next)
        } else {
          prev.push({
            documentId,
            documentName,
            dataSourceType,
            sources: [next],
          })
        }

        return prev
      }, []),
    [data],
  )

  if (resources.length === 0) return null

  return (
    <div className="mt-3">
      <button
        type="button"
        data-testid="citation-title"
        aria-expanded={open}
        className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs text-[var(--text-3)] transition-colors hover:bg-[var(--bg-soft)] hover:text-[var(--text-2)]"
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
          <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
        </svg>
        {t(($) => $['chat.citation.count'], { ns: 'common', count: resources.length })}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          aria-hidden
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-1.5" data-testid="citation-list">
          {resources.map((res, index) => (
            <Popup key={res.documentId} data={res} showHitInfo={showHitInfo} index={index} />
          ))}
        </div>
      )}
    </div>
  )
}

export default Citation
