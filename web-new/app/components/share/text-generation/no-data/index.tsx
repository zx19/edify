import type { FC } from 'react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

/**
 * 结果区空态（v2 轻提示，mockup 类型34 .res-empty）：虚线框 + 引导文案；spark 图标退役。
 */
const NoData: FC = () => {
  const { t } = useTranslation()
  return (
    <div className="flex size-full items-center justify-center">
      <div className="w-full rounded-[12px] border-[1.5px] border-dashed border-[var(--border)] px-5 py-9 text-center text-[13px] text-[var(--text-3)]">
        {t(($) => $['generation.noData'], { ns: 'share' })}
      </div>
    </div>
  )
}
export default React.memo(NoData)
