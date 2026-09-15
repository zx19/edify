import type { FC, MouseEvent } from 'react'
import type { Resources } from './index'
import { Popover, PopoverContent, PopoverTrigger } from '@xsl/lomva-ui/popover'
import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import FileIcon from '@/app/components/base/file-icon'
import Link from '@/next/link'
import { useDocumentDownload } from '@/service/knowledge/use-document'
import { downloadUrl } from '@/utils/download'
import ProgressTooltip from './progress-tooltip'
import Tooltip from './tooltip'

type PopupProps = {
  data: Resources
  showHitInfo?: boolean
  index?: number
}

/**
 * 引用卡片 + 命中详情浮层（chat 单元重写，mockup 类型1）：
 * - trigger = 卡片（序号方块 + 文件名 + 首段摘要两行截断 + score pill 取该文档最高分）
 * - 浮层保留原行为：下载（upload_file/file + dataset_id）、分段列表、命中信息、知识库跳转
 */
const Popup: FC<PopupProps> = ({ data, showHitInfo = false, index = 0 }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const fileType =
    data.dataSourceType !== 'notion' ? /\.([^.]*)$/.exec(data.documentName)?.[1] || '' : 'notion'

  const { mutateAsync: downloadDocument, isPending: isDownloading } = useDocumentDownload()

  const handleDownloadUploadFile = async (e: MouseEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()

    const isUploadFile = data.dataSourceType === 'upload_file' || data.dataSourceType === 'file'
    const datasetId = data.sources?.[0]?.dataset_id
    const documentId = data.documentId || data.sources?.[0]?.document_id
    if (!isUploadFile || !datasetId || !documentId || isDownloading) return

    const res = await downloadDocument({ datasetId, documentId })
    if (res?.url) downloadUrl({ url: res.url, fileName: data.documentName })
  }

  const summary = data.sources[0]?.content ?? ''
  const topScore = showHitInfo
    ? Math.max(0, ...data.sources.map((s) => s.score ?? 0)) || undefined
    : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton={false}
        render={
          <div
            data-testid="popup-trigger"
            className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 transition-colors hover:border-[var(--border-strong)]"
          >
            <div className="grid size-[18px] flex-none place-items-center rounded-md bg-[var(--gray-pill-bg)] text-[11px] font-bold text-[var(--gray-pill-fg)]">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-[12.5px] font-semibold text-[var(--text-1)]">
                <FileIcon type={fileType} className="size-3.5 shrink-0" />
                <span className="truncate">{data.documentName}</span>
              </div>
              {summary && (
                <div className="mt-0.5 line-clamp-2 text-xs text-[var(--text-3)]">{summary}</div>
              )}
            </div>
            {topScore !== undefined && (
              <span className="ml-auto flex-none rounded-full bg-[var(--accent-pill-bg)] px-[7px] py-[2px] text-[11px] font-bold text-[var(--accent-pill-fg)]">
                {topScore.toFixed(2)}
              </span>
            )}
          </div>
        }
      />
      <PopoverContent
        placement="top-start"
        sideOffset={8}
        alignOffset={-2}
        className="border-none bg-transparent shadow-none"
      >
        <div
          data-testid="popup-content"
          className="max-w-90 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-md)]"
        >
          <div className="px-4 pt-3 pb-2">
            <div className="flex h-4.5 items-center">
              <FileIcon type={fileType} className="mr-1 size-4 shrink-0" />
              <div className="truncate text-xs font-medium text-[var(--text-3)]">
                {(data.dataSourceType === 'upload_file' || data.dataSourceType === 'file') &&
                !!data.sources?.[0]?.dataset_id ? (
                  <button
                    type="button"
                    className="cursor-pointer truncate border-none bg-transparent p-0 text-left text-[var(--text-3)] hover:underline"
                    onClick={handleDownloadUploadFile}
                    disabled={isDownloading}
                  >
                    {data.documentName}
                  </button>
                ) : (
                  data.documentName
                )}
              </div>
            </div>
          </div>
          <div className="max-h-112.5 overflow-y-auto border-t border-[var(--border)] px-4 py-0.5">
            <div className="w-full">
              {data.sources.map((source, index) => {
                const itemKey = source.document_id
                  ? `${source.document_id}-${source.segment_position ?? index}`
                  : (source.index_node_hash ?? `${data.documentId ?? 'doc'}-${index}`)

                return (
                  <Fragment key={itemKey}>
                    <div data-testid="popup-source-item" className="group py-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex h-5 items-center rounded-md border border-[var(--border)] px-1.5">
                          <i
                            className="mr-0.5 i-custom-vender-line-general-hash-02 size-3 text-[var(--text-3)]"
                            aria-hidden
                          />
                          <div
                            data-testid="popup-segment-position"
                            className="text-[11px] font-medium text-[var(--text-3)]"
                          >
                            {source.segment_position || index + 1}
                          </div>
                        </div>
                        {showHitInfo && (
                          <Link
                            href={`/datasets/${source.dataset_id}/documents/${source.document_id}`}
                            className="hidden h-4.5 items-center text-xs text-[var(--accent-deep)] group-hover:flex"
                          >
                            {t(($) => $['chat.citation.linkToDataset'], { ns: 'common' })}
                            <i
                              className="ml-1 i-custom-vender-line-arrows-arrow-up-right size-3"
                              aria-hidden
                            />
                          </Link>
                        )}
                      </div>
                      <div
                        data-testid="popup-source-content"
                        className="text-[13px] wrap-break-word text-[var(--text-2)]"
                      >
                        {source.content}
                      </div>
                      {showHitInfo && (
                        <div
                          data-testid="popup-hit-info"
                          className="mt-2 flex flex-wrap items-center text-xs font-medium text-[var(--text-3)]"
                        >
                          <Tooltip
                            text={t(($) => $['chat.citation.characters'], { ns: 'common' })}
                            data={source.word_count}
                            icon={
                              <i
                                className="mr-1 i-custom-vender-line-editor-type-square size-3"
                                aria-hidden
                              />
                            }
                          />
                          <Tooltip
                            text={t(($) => $['chat.citation.hitCount'], { ns: 'common' })}
                            data={source.hit_count}
                            icon={
                              <i
                                className="mr-1 i-custom-vender-line-general-target-04 size-3"
                                aria-hidden
                              />
                            }
                          />
                          <Tooltip
                            text={t(($) => $['chat.citation.vectorHash'], { ns: 'common' })}
                            data={source.index_node_hash?.substring(0, 7)}
                            icon={
                              <i
                                className="mr-1 i-custom-vender-line-editor-bezier-curve-03 size-3"
                                aria-hidden
                              />
                            }
                          />
                          {!!source.score && (
                            <ProgressTooltip data={Number(source.score.toFixed(2))} />
                          )}
                        </div>
                      )}
                    </div>
                    {index !== data.sources.length - 1 && (
                      <div
                        data-testid="popup-source-divider"
                        className="my-1 h-px bg-[var(--border)]"
                      />
                    )}
                  </Fragment>
                )
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default Popup
