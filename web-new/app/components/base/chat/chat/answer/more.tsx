import type { FC } from 'react'
import type { ChatItem } from '../../types'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/utils/format'

type MoreProps = {
  more: ChatItem['more']
}

/**
 * 性能行（chat 单元重写，mockup 类型1）：常显弱化（三级灰小字），msg-foot 行内右侧。
 * 原 hover 才显现改为常显（对照表出入 #2 拍板落点）。
 */
const More: FC<MoreProps> = ({ more }) => {
  const { t } = useTranslation()

  if (!more) return null

  return (
    <div
      className="ml-auto flex items-center text-[11.5px] text-text-quaternary tabular-nums"
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
