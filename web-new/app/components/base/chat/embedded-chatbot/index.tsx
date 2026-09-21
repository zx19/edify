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
import { buildAccentStyle } from '../accent-style'
import { EmbeddedChatbotContext, useEmbeddedChatbotContext } from './context'
import { useEmbeddedChatbot } from './hooks'

/**
 * chatbot 单元重写（mockup 类型2，对照表 §1/§2/§5）：
 * - 外壳双端同构：白底中性 header + bg-soft 消息区；移动蓝渐变浮卡整体退役
 * - createTheme/CssTransform/isDify/DifyLogo 退役；chat_color_theme → accent 注入（chat 单元同机制）
 * - powered by 底部一行常显，品牌链 = remove_webapp_brand 隐藏 → ui_config.brand.footer_text
 *   → custom_config.replace_webapp_logo → 默认「杏树林」（与 chat 单元口径一致，去 Dify 化）
 */
const Chatbot = () => {
  const {
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

  useDocumentTitle(site?.title || 'Chat')

  return (
    <div
      className="flex h-full flex-col bg-[var(--bg-soft)]"
      style={buildAccentStyle(site?.chat_color_theme)}
    >
      <Header allowResetChat={allowResetChat} onCreateNewChat={handleNewConversation} />
      <div className="flex grow flex-col overflow-y-auto">
        {appChatListDataLoading && <Loading type="app" />}
        {!appChatListDataLoading && <ChatWrapper key={chatShouldReloadKey} />}
      </div>
      {showBrand && (
        <div
          className={cn(
            'flex shrink-0 items-center justify-center gap-1 bg-[var(--bg-soft)] px-2 pt-1 pb-2',
            'text-[11px] tracking-wide text-[var(--text-3)]',
          )}
        >
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
