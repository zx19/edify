import type { FC } from 'react'
import type { OnSend } from '../types'
import { Button } from '@xsl/lomva-ui/button'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import Divider from '@/app/components/base/divider'

type TryToAskProps = {
  suggestedQuestions: string[]
  onSend: OnSend
}
const TryToAsk: FC<TryToAskProps> = ({ suggestedQuestions, onSend }) => {
  const { t } = useTranslation()

  return (
    <div className="mb-2 py-2">
      <div className="mb-2.5 flex items-center justify-between gap-2 [.webapp-theme_&]:hidden">
        <Divider bgStyle="gradient" className="h-px w-auto! grow rotate-180" />
        <div className="shrink-0 system-xs-medium-uppercase text-text-tertiary">
          {t(($) => $['feature.suggestedQuestionsAfterAnswer.tryToAsk'], { ns: 'appDebug' })}
        </div>
        <Divider bgStyle="gradient" className="h-px w-auto! grow" />
      </div>
      <div className="flex flex-wrap justify-center [.webapp-theme_&]:flex-col [.webapp-theme_&]:items-start [.webapp-theme_&]:gap-1.5">
        {suggestedQuestions.map((suggestQuestion, index) => (
          <Button
            size="small"
            key={index}
            variant="secondary-accent"
            className="pointer-events-auto mr-1 mb-1 last:mr-0 [.webapp-theme_&]:m-0 [.webapp-theme_&]:rounded-full [.webapp-theme_&]:border [.webapp-theme_&]:border-[var(--border)] [.webapp-theme_&]:bg-[var(--card)] [.webapp-theme_&]:px-3.5 [.webapp-theme_&]:py-[7px] [.webapp-theme_&]:text-[var(--text-2)] [.webapp-theme_&]:shadow-none [.webapp-theme_&]:hover:border-transparent [.webapp-theme_&]:hover:bg-[var(--accent-soft)] [.webapp-theme_&]:hover:text-[var(--accent-deep)]"
            onClick={() => onSend(suggestQuestion)}
          >
            {suggestQuestion}
          </Button>
        ))}
      </div>
    </div>
  )
}

export default memo(TryToAsk)
