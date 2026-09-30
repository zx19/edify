'use client'
import type { AppData } from '@/models/share'
import { cn } from '@xsl/lomva-ui/cn'
import { useTranslation } from 'react-i18next'
import ChatWrapper from '@/app/components/base/chat/embedded-chatbot/chat-wrapper'
import Header from '@/app/components/base/chat/embedded-chatbot/header'
import Loading from '@/app/components/base/loading'
import useBreakpoints, { MediaType } from '@/hooks/use-breakpoints'
import useDocumentTitle from '@/hooks/use-document-title'
import { resolveUiConfig } from '@/models/ui-config'
import { AppSourceType } from '@/service/share'
import { isClient } from '@/utils/client'
import { buildAccentStyle } from '../accent-style'
import { EmbeddedChatbotContext, useEmbeddedChatbotContext } from './context'
import { useEmbeddedChatbot } from './hooks'

/**
 * chatbot 单元呈现层回炉（mockup v2 类型2，对照表 v2 §1）：
 * - 外壳：桌面直连 = `--bg` 纯色（灰白渐变退役）；移动端直连 = rounded-2xl 中性卡片
 *   （蓝渐变头退役）浮于 bg-soft 衬底；iframe 气泡窗不渲卡片（宿主 embed.js 自带 chrome）
 * - 家族根自挂 `.webapp-theme` 作用域（shareLayout 已有属双保险）；chat_color_theme →
 *   accent 注入内层卡（chat 单元同机制，createTheme/CssTransform/isDify/DifyLogo 已退役）
 * - powered by 品牌行：footer 居中一行（桌面直移位 header 在 Task 2 收口），
 *   品牌链 = remove_webapp_brand 隐藏 → ui_config.brand.footer_text
 *   → custom_config.replace_webapp_logo → 默认「杏树林」（去 Dify 化口径）
 */
const Chatbot = () => {
  const {
    isMobile,
    allowResetChat,
    appData,
    appChatListDataLoading,
    chatShouldReloadKey,
    handleNewConversation,
  } = useEmbeddedChatbotContext()
  const { t } = useTranslation()

  const site = appData?.site
  const uiConfig = resolveUiConfig(site)
  const customConfig = appData?.custom_config
  const showBrand = !customConfig?.remove_webapp_brand
  // 气泡窗宿主（embed.js）自带卡片 chrome；卡片外壳仅移动端直连（与 header 内同源判断一致）
  const isIframe = isClient ? window.self !== window.top : false
  const isCardShell = isMobile && !isIframe

  useDocumentTitle(site?.title || 'Chat')

  return (
    <div className={cn('h-full', isCardShell && 'bg-[var(--bg-soft)] p-2.5')}>
      <div
        data-testid="chatbot-shell-card"
        className={cn(
          'webapp-theme flex h-full flex-col bg-[var(--bg)]',
          isCardShell && 'overflow-hidden rounded-2xl shadow-[var(--shadow-sm)]',
        )}
        style={buildAccentStyle(site?.chat_color_theme)}
      >
        <Header allowResetChat={allowResetChat} onCreateNewChat={handleNewConversation} />
        {/* 内容区对齐 chat 族壳层：滚动归 chat-root 自理，摘除冗余 overflow-y-auto 防双滚动 */}
        <div className="relative min-h-0 grow">
          {appChatListDataLoading && <Loading type="app" />}
          {!appChatListDataLoading && <ChatWrapper key={chatShouldReloadKey} />}
        </div>
        {showBrand && (
          <div className="flex shrink-0 items-center justify-center gap-1 px-2 pt-1.5 pb-2 text-[11px] tracking-wide text-[var(--text-3)]">
            <span>{t(($) => $['chat.poweredBy'], { ns: 'share' })}</span>
            {uiConfig.brand.footer_text ? (
              <span className="truncate">{uiConfig.brand.footer_text}</span>
            ) : customConfig?.replace_webapp_logo ? (
              <img
                src={`${customConfig.replace_webapp_logo}`}
                alt="logo"
                className="block h-4 w-auto"
              />
            ) : (
              <b className="font-semibold text-[var(--text-2)]">杏树林</b>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const EmbeddedChatbotWrapper = () => {
  const media = useBreakpoints()
  const isMobile = media === MediaType.mobile

  const {
    appData,
    appParams,
    appMeta,
    appChatListDataLoading,
    currentConversationId,
    currentConversationItem,
    appPrevChatList,
    pinnedConversationList,
    conversationList,
    newConversationInputs,
    newConversationInputsRef,
    handleNewConversationInputsChange,
    inputsForms,
    handleNewConversation,
    handleStartChat,
    handleChangeConversation,
    handleNewConversationCompleted,
    chatShouldReloadKey,
    isInstalledApp,
    allowResetChat,
    appId,
    handleFeedback,
    currentChatInstanceRef,
    clearChatList,
    setClearChatList,
    isResponding,
    setIsResponding,
    currentConversationInputs,
    setCurrentConversationInputs,
    allInputsHidden,
    initUserVariables,
  } = useEmbeddedChatbot(AppSourceType.webApp)

  return (
    <EmbeddedChatbotContext.Provider
      value={{
        appSourceType: AppSourceType.webApp,
        appData: (appData as AppData) || null,
        appParams,
        appMeta,
        appChatListDataLoading,
        currentConversationId,
        currentConversationItem,
        appPrevChatList,
        pinnedConversationList,
        conversationList,
        newConversationInputs,
        newConversationInputsRef,
        handleNewConversationInputsChange,
        inputsForms,
        handleNewConversation,
        handleStartChat,
        handleChangeConversation,
        handleNewConversationCompleted,
        chatShouldReloadKey,
        isMobile,
        isInstalledApp,
        allowResetChat,
        appId,
        handleFeedback,
        currentChatInstanceRef,
        clearChatList,
        setClearChatList,
        isResponding,
        setIsResponding,
        currentConversationInputs,
        setCurrentConversationInputs,
        allInputsHidden,
        initUserVariables,
      }}
    >
      <Chatbot />
    </EmbeddedChatbotContext.Provider>
  )
}

const EmbeddedChatbot = () => {
  return <EmbeddedChatbotWrapper />
}

export default EmbeddedChatbot
