import { RiEqualizer2Line } from '@remixicon/react'
import { Button } from '@xsl/lomva-ui/button'
import { cn } from '@xsl/lomva-ui/cn'
import { StatusDot } from '@xsl/lomva-ui/status-dot'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

type AuthorizedInDataSourceNodeProps = {
  authorizationsNum: number
  onJumpToDataSourcePage: () => void
}
const AuthorizedInDataSourceNode = ({
  authorizationsNum,
  onJumpToDataSourcePage,
}: AuthorizedInDataSourceNodeProps) => {
  const { t } = useTranslation()

  return (
    <Button size="small" onClick={onJumpToDataSourcePage}>
      <StatusDot status="success" />
      {authorizationsNum > 1
        ? t(($) => $['auth.authorizations'], { ns: 'plugin' })
        : t(($) => $['auth.authorization'], { ns: 'plugin' })}
      <RiEqualizer2Line className={cn('size-3.5 text-components-button-ghost-text')} />
    </Button>
  )
}

export default memo(AuthorizedInDataSourceNode)
