import type { FC } from 'react'
import type { ChatItem } from '../../types'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/utils/format'

type MoreProps = {
  more: ChatItem['more']
}

/**
 * 性能行（chat 单元回炉，mockup 类型1 .perf）：
 * D5 收编——渲染在操作条行尾（ml-auto），随操作条 hover/focus 同行显现（推翻 09-13「常显弱化」拍板）；
 * 12px 三级灰（var(--text-3)），单实现消费 var token。
 */
const More: FC<MoreProps> = ({ more }) => {
  const { t } = useTranslation()

  if (!more) return null

  return (
    <div
      className="ml-auto flex items-center text-[12px] text-[var(--text-3)] tabular-nums"
      data-testid="more-container"
    >
      <div
        className="mr-2 max-w-[25%] shrink-0 truncate"
        title={`${t(($) => $['detail.timeConsuming'], { ns: 'appLog' })} ${more.latency}${t(($) => $['detail.second'], { ns: 'appLog' })}`}
        data-testid="more-latency"
      >
        {`${t(($) => $['detail.timeConsuming'], { ns: 'appLog' })} ${more.latency}${t(($) => $['detail.second'], { ns: 'appLog' })}`}
      </div>
      <div
        className="mr-2 max-w-[25%] shrink-0 truncate"
        title={`${t(($) => $['detail.tokenCost'], { ns: 'appLog' })} ${formatNumber(more.tokens)}`}
        data-testid="more-tokens"
      >
        {`${t(($) => $['detail.tokenCost'], { ns: 'appLog' })} ${formatNumber(more.tokens)}`}
      </div>
      {!!more.tokens_per_second && (
        <div
          className="mr-2 max-w-[25%] shrink-0 truncate"
          title={`${more.tokens_per_second} tokens/s`}
          data-testid="more-tps"
        >
          {`${more.tokens_per_second} tokens/s`}
        </div>
      )}
      {!!more.time && (
        <>
          <div className="mx-2 shrink-0">·</div>
          <div className="max-w-[25%] shrink-0 truncate" title={more.time} data-testid="more-time">
            {more.time}
          </div>
        </>
      )}
    </div>
  )
}

export default memo(More)
