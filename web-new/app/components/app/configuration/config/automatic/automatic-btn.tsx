'use client'
import type { FC } from 'react'
import { RiSparklingFill } from '@remixicon/react'
import { Button } from '@xsl/ui/button'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

type IAutomaticBtnProps = {
  onClick: () => void
}
const AutomaticBtn: FC<IAutomaticBtnProps> = ({ onClick }) => {
  const { t } = useTranslation()

  return (
    <Button variant="secondary-accent" size="small" onClick={onClick}>
      <RiSparklingFill className="size-3.5" />
      <span>{t(($) => $['operation.automatic'], { ns: 'appDebug' })}</span>
    </Button>
  )
}
export default React.memo(AutomaticBtn)
