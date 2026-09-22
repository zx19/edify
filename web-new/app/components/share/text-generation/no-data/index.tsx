import type { FC } from 'react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

type INoDataProps = {}
/** 结果区空态（重写 2026-09-22）：spark 图标 + 三级灰文案 */
const NoData: FC<INoDataProps> = () => {
  const { t } = useTranslation()
  return (
    <div className="flex size-full flex-col items-center justify-center">
      <span aria-hidden className="i-ri-sparkling-fill size-12 text-[var(--border-strong)]" />
      <div className="mt-2 text-[13px] text-[var(--text-3)]">
        {t(($) => $['generation.noData'], { ns: 'share' })}
      </div>
    </div>
  )
}
export default React.memo(NoData)
