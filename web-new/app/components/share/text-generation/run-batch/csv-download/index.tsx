'use client'
import type { FC } from 'react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { useCSVDownloader } from 'react-papaparse'

type ICSVDownloadProps = {
  vars: { name: string }[]
}

const CSVDownload: FC<ICSVDownloadProps> = ({ vars }) => {
  const { t } = useTranslation()
  const { CSVDownloader, Type } = useCSVDownloader()
  const addQueryContentVars = [...vars]
  const template = (() => {
    const res: Record<string, string> = {}
    addQueryContentVars.forEach((item) => {
      res[item.name] = ''
    })
    return res
  })()

  return (
    <div className="mt-6">
      <div className="text-[12.5px] font-semibold text-[var(--text-2)]">
        {t(($) => $['generation.csvStructureTitle'], { ns: 'share' })}
      </div>
      <div className="mt-2 max-h-125 overflow-auto">
        <table className="w-full table-fixed border-separate border-spacing-0 rounded-lg border border-[var(--border)] text-xs">
          <thead className="text-[var(--text-3)]">
            <tr>
              {addQueryContentVars.map((item, i) => (
                <td key={i} className="h-9 border-b border-[var(--border)] pr-2 pl-3">
                  {item.name}
                </td>
              ))}
            </tr>
          </thead>
          <tbody className="text-[var(--text-2)]">
            <tr>
              {addQueryContentVars.map((item, i) => (
                <td key={i} className="h-9 pl-4">
                  {item.name} {t(($) => $['generation.field'], { ns: 'share' })}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <CSVDownloader
        className="mt-2 block cursor-pointer"
        type={Type.Link}
        filename="template"
        bom={true}
        config={{
          // delimiter: ';',
        }}
        data={[template]}
      >
        <div className="flex h-4.5 items-center gap-1 text-[12px] font-semibold text-[var(--accent-deep)]">
          <span aria-hidden className="i-ri-download-2-line size-3" />
          <span>{t(($) => $['generation.downloadTemplate'], { ns: 'share' })}</span>
        </div>
      </CSVDownloader>
    </div>
  )
}
export default React.memo(CSVDownload)
