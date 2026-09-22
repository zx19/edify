'use client'
import type { FC } from 'react'
import { cn } from '@xsl/lomva-ui/cn'
import * as React from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCSVReader } from 'react-papaparse'
import { Csv as CSVIcon } from '@/app/components/base/icons/src/public/files'

type Props = Readonly<{
  onParsed: (data: string[][]) => void
}>

/** CSV 拖放区（重写 2026-09-22）：虚线卡 token 化；hover 拖入 = accent 软底 */
const CSVReader: FC<Props> = ({ onParsed }) => {
  const { t } = useTranslation()
  const { CSVReader } = useCSVReader()
  const [zoneHover, setZoneHover] = useState(false)
  return (
    <CSVReader
      onUploadAccepted={(results: any) => {
        onParsed(results.data)
        setZoneHover(false)
      }}
      onDragOver={(event: DragEvent) => {
        event.preventDefault()
        setZoneHover(true)
      }}
      onDragLeave={(event: DragEvent) => {
        event.preventDefault()
        setZoneHover(false)
      }}
    >
      {({ getRootProps, acceptedFile }: any) => (
        <div
          {...getRootProps()}
          className={cn(
            'flex h-20 items-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-soft)] px-6 text-[13px] transition-colors',
            !acceptedFile && 'justify-center',
            zoneHover && 'border-solid border-[var(--accent)] bg-[var(--accent-soft)]',
            acceptedFile && 'border-solid border-[var(--border)] bg-[var(--card)]',
          )}
        >
          {acceptedFile ? (
            <div className="flex w-full items-center gap-2">
              <CSVIcon className="shrink-0" />
              <div className="flex w-0 grow">
                <span className="max-w-[calc(100%-30px)] truncate text-[var(--text-2)]">
                  {acceptedFile.name.replace(/.csv$/, '')}
                </span>
                <span className="shrink-0 text-[var(--text-3)]">.csv</span>
              </div>
            </div>
          ) : (
            <div className="text-[var(--text-3)]">
              {t(($) => $['generation.csvUploadTitle'], { ns: 'share' })}
              <span className="cursor-pointer font-semibold text-[var(--accent-deep)]">
                {t(($) => $['generation.browse'], { ns: 'share' })}
              </span>
            </div>
          )}
        </div>
      )}
    </CSVReader>
  )
}

export default React.memo(CSVReader)
