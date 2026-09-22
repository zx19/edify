import type { FC, RefObject } from 'react'
import type { InputValueTypes, TextGenerationCustomConfig, TextGenerationRunControl } from './types'
import type { PromptConfig, SavedMessage, TextToSpeechConfig } from '@/models/debug'
import type { SiteInfo } from '@/models/share'
import type { VisionFile, VisionSettings } from '@/types/app'
import { cn } from '@xsl/lomva-ui/cn'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@xsl/lomva-ui/tabs'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SavedItems from '@/app/components/app/text-generate/saved-items'
import AppIcon from '@/app/components/base/app-icon'
import Badge from '@/app/components/base/badge'
import { appDefaultIconBackground } from '@/config'
import { AccessMode } from '@/models/access-control'
import { resolveUiConfig } from '@/models/ui-config'
import MenuDropdown from './menu-dropdown'
import RunBatch from './run-batch'
import RunOnce from './run-once'

type TextGenerationSidebarProps = {
  accessMode: AccessMode
  allTasksRun: boolean
  currentTab: string
  customConfig: TextGenerationCustomConfig | null
  inputs: Record<string, InputValueTypes>
  inputsRef: RefObject<Record<string, InputValueTypes>>
  isInstalledApp: boolean
  isPC: boolean
  isWorkflow: boolean
  onBatchSend: (data: string[][]) => void
  onInputsChange: (inputs: Record<string, InputValueTypes>) => void
  onRemoveSavedMessage: (messageId: string) => Promise<void>
  onRunOnceSend: () => void
  onTabChange: (tab: string) => void
  onVisionFilesChange: (files: VisionFile[]) => void
  promptConfig: PromptConfig
  resultExisted: boolean
  runControl: TextGenerationRunControl | null
  savedMessages: SavedMessage[]
  /** ui_config.components.show_batch_tab：批量 tab 默认隐藏（2026-09-22 拍板） */
  showBatchTab: boolean
  siteInfo: SiteInfo
  textToSpeechConfig: TextToSpeechConfig | null
  visionConfig: VisionSettings
}

/**
 * text-generation 族左侧栏（completion/workflow 单元重写 2026-09-22，mockup 类型3）：
 * 单实现消费 token 变量——家族根（../index.tsx）自挂 .webapp-theme 作用域，
 * share 路由与 installed-app 嵌入面同一生效；不做无作用域降级（console debug 不消费本壳）。
 * 品牌链：remove_webapp_brand 隐藏 → ui_config.brand.footer_text → replace_webapp_logo → 默认「杏树林」。
 */
const TextGenerationSidebar: FC<TextGenerationSidebarProps> = ({
  accessMode,
  allTasksRun,
  currentTab,
  customConfig,
  inputs,
  inputsRef,
  isInstalledApp,
  isPC,
  isWorkflow,
  onBatchSend,
  onInputsChange,
  onRemoveSavedMessage,
  onRunOnceSend,
  onTabChange,
  onVisionFilesChange,
  promptConfig,
  resultExisted,
  runControl,
  savedMessages,
  showBatchTab,
  siteInfo,
  textToSpeechConfig,
  visionConfig,
}) => {
  const { t } = useTranslation()
  const [descExpanded, setDescExpanded] = useState(false)
  const [showDescToggle, setShowDescToggle] = useState(false)
  const handleDescRef = useCallback((node: HTMLDivElement | null) => {
    setShowDescToggle(!!node && node.scrollHeight > node.clientHeight)
  }, [])
  const uiConfig = resolveUiConfig(siteInfo)

  return (
    <Tabs
      value={currentTab}
      onValueChange={onTabChange}
      className={cn(
        'relative flex h-full shrink-0 flex-col bg-[var(--bg)]',
        isPC
          ? 'w-150 max-w-[50%] border-r border-[var(--border)]'
          : resultExisted
            ? 'h-[calc(100%-64px)]'
            : '',
        isInstalledApp && 'rounded-l-2xl',
      )}
    >
      <div className={cn('shrink-0 space-y-4', isPC ? 'p-5 pb-0' : 'p-4 pb-0')}>
        <div className="flex items-center gap-2.5">
          <AppIcon
            size={isPC ? 'large' : 'small'}
            iconType={siteInfo.icon_type}
            icon={siteInfo.icon}
            background={siteInfo.icon_background || appDefaultIconBackground}
            imageUrl={siteInfo.icon_url}
          />
          <div className="grow truncate text-[14px] font-semibold text-[var(--text-1)]">
            {siteInfo.title}
          </div>
          <MenuDropdown
            hideLogout={isInstalledApp || accessMode === AccessMode.PUBLIC}
            data={siteInfo}
          />
        </div>
        {siteInfo.description && (
          <div>
            <div
              ref={handleDescRef}
              className={cn(
                'relative text-[12.5px] leading-6 wrap-break-word whitespace-pre-wrap text-[var(--text-3)]',
                !descExpanded && 'line-clamp-3',
                descExpanded && 'max-h-32 overflow-y-auto',
              )}
            >
              {siteInfo.description}
              {!descExpanded && showDescToggle && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-linear-to-b from-transparent to-[var(--bg)]" />
              )}
            </div>
            {showDescToggle && (
              <button
                type="button"
                className="mt-0.5 flex items-center gap-0.5 text-[12px] font-semibold text-[var(--accent-deep)] hover:opacity-80"
                onClick={() => setDescExpanded((v) => !v)}
              >
                {descExpanded ? (
                  <>
                    <span aria-hidden className="i-ri-arrow-up-s-line size-3" />
                    {t(($) => $['chat.collapse'], { ns: 'share' })}
                  </>
                ) : (
                  <>
                    <span aria-hidden className="i-ri-arrow-down-s-line size-3" />
                    {t(($) => $['chat.expand'], { ns: 'share' })}
                  </>
                )}
              </button>
            )}
          </div>
        )}
        <TabsList className="w-full border-b border-[var(--border)]">
          <TabsTab value="create">
            <span className="ml-2">{t(($) => $['generation.tabs.create'], { ns: 'share' })}</span>
          </TabsTab>
          {showBatchTab && (
            <TabsTab value="batch">
              <span className="ml-2">{t(($) => $['generation.tabs.batch'], { ns: 'share' })}</span>
            </TabsTab>
          )}
          {!isWorkflow && (
            <TabsTab value="saved" className="ml-auto">
              <span aria-hidden className="i-ri-bookmark-3-line size-4" />
              <span className="ml-2">{t(($) => $['generation.tabs.saved'], { ns: 'share' })}</span>
              {savedMessages.length > 0 && <Badge className="ml-1">{savedMessages.length}</Badge>}
            </TabsTab>
          )}
        </TabsList>
      </div>
      <div
        className={cn(
          'h-0 grow overflow-y-auto bg-[var(--bg)]',
          isPC ? 'px-5' : 'px-4',
          !isPC &&
            resultExisted &&
            customConfig?.remove_webapp_brand &&
            'rounded-b-2xl border-b-[0.5px] border-[var(--border)]',
        )}
      >
        <TabsPanel value="create" keepMounted>
          <RunOnce
            siteInfo={siteInfo}
            inputs={inputs}
            inputsRef={inputsRef}
            onInputsChange={onInputsChange}
            promptConfig={promptConfig}
            onSend={onRunOnceSend}
            visionConfig={visionConfig}
            onVisionFilesChange={onVisionFilesChange}
            runControl={runControl}
          />
        </TabsPanel>
        {showBatchTab && (
          <TabsPanel value="batch" keepMounted>
            <RunBatch
              vars={promptConfig.prompt_variables}
              onSend={onBatchSend}
              isAllFinished={allTasksRun}
            />
          </TabsPanel>
        )}
        {!isWorkflow && (
          <TabsPanel value="saved">
            <SavedItems
              className={cn(isPC ? 'mt-5' : 'mt-4')}
              isShowTextToSpeech={textToSpeechConfig?.enabled}
              list={savedMessages}
              onRemove={onRemoveSavedMessage}
              onStartCreateContent={() => onTabChange('create')}
            />
          </TabsPanel>
        )}
      </div>
      {!customConfig?.remove_webapp_brand && (
        <div
          className={cn(
            'flex shrink-0 items-center gap-1 border-t border-[var(--border)] bg-[var(--bg)] py-2.5 text-[11px] tracking-wide text-[var(--text-3)]',
            isPC ? 'px-5' : 'justify-center px-4',
            !isPC && resultExisted && 'rounded-b-2xl border-b-[0.5px] border-b-[var(--border)]',
          )}
        >
          <span>{t(($) => $['chat.poweredBy'], { ns: 'share' })}</span>
          {uiConfig.brand.footer_text ? (
            <span className="truncate">{uiConfig.brand.footer_text}</span>
          ) : customConfig?.replace_webapp_logo ? (
            <img src={customConfig.replace_webapp_logo} alt="logo" className="block h-4 w-auto" />
          ) : (
            <b className="font-semibold text-[var(--text-2)]">杏树林</b>
          )}
        </div>
      )}
    </Tabs>
  )
}

export default TextGenerationSidebar
