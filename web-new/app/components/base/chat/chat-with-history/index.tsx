'use client'
import type { InstalledAppResponse } from '@dify/contracts/api/console/installed-apps/types.gen'
import type { CSSProperties, FC } from 'react'
import type { ChatProps } from '../chat'
import { cn } from '@xsl/lomva-ui/cn'
import { useEffect, useState } from 'react'
import Loading from '@/app/components/base/loading'
import useBreakpoints, { MediaType } from '@/hooks/use-breakpoints'
import useDocumentTitle from '@/hooks/use-document-title'
import { resolveUiConfig } from '@/models/ui-config'
import ChatWrapper from './chat-wrapper'
import { ChatWithHistoryContext, useChatWithHistoryContext } from './context'
import Header from './header'
import HeaderInMobile from './header-in-mobile'
import { useChatWithHistory } from './hooks'
import Sidebar from './sidebar'

type ChatWithHistoryProps = {
  className?: string
}

/**
 * chat_color_theme → 作用域 accent 三档注入（替代 createTheme 内联样式机制，design §3.2）：
 * - 未配置 = 不注入，继承 tokens.css 作用域默认橙
 * - 配置后 = 壳层根 inline 覆盖 --accent/--accent-deep/--accent-soft，发送钮/CTA/选中态随之换色
 * - chat_color_theme_inverted：旧语义=定制色 header 白底反色；新 header 恒中性（mockup 扁平化），
 *   无视觉落点（功能对照表核销注记）
 */
function buildAccentStyle(chatColorTheme: string | null | undefined): CSSProperties | undefined {
  if (!chatColorTheme) return undefined
  return {
    '--accent': chatColorTheme,
    '--accent-deep': `color-mix(in srgb, ${chatColorTheme}, black 12%)`,
    '--accent-soft': `color-mix(in srgb, ${chatColorTheme} 10%, transparent)`,
    '--accent-pill-bg': `color-mix(in srgb, ${chatColorTheme} 12%, transparent)`,
    '--accent-pill-fg': `color-mix(in srgb, ${chatColorTheme}, black 12%)`,
  } as CSSProperties
}

const ChatWithHistory: FC<ChatWithHistoryProps> = ({ className }) => {
  const { appData, appChatListDataLoading, chatShouldReloadKey, isMobile, sidebarCollapseState } =
    useChatWithHistoryContext()
  const isSidebarCollapsed = sidebarCollapseState
  const site = appData?.site
  // ui_config：show_conversation_sidebar=false → 侧栏整隐，hover 浮出面板也关闭（降级走 header 操作组）
  const uiConfig = resolveUiConfig(site)
  const sidebarEnabled = uiConfig.layout.show_conversation_sidebar

  const [showSidePanel, setShowSidePanel] = useState(false)

  useEffect(() => {
    if (!isSidebarCollapsed) setShowSidePanel(false)
  }, [isSidebarCollapsed])

  useDocumentTitle(site?.title || 'Chat')

  const accentStyle = buildAccentStyle(site?.chat_color_theme)

  return (
    <div
      className={cn('webapp-theme flex h-full bg-[var(--bg)]', isMobile && 'flex-col', className)}
      style={accentStyle}
    >
      {!isMobile && sidebarEnabled && (
        <div
          className={cn(
            'flex w-62 flex-col border-r border-[var(--border)] transition-all duration-200 ease-in-out',
            isSidebarCollapsed && 'w-0 overflow-hidden border-0 p-0!',
          )}
        >
          <Sidebar />
        </div>
      )}
      {isMobile && <HeaderInMobile />}
      <div className={cn('relative grow', isMobile && 'h-[calc(100%-56px)]')}>
        {isSidebarCollapsed && sidebarEnabled && (
          <div
            className={cn(
              'absolute top-0 z-20 flex h-full w-[256px] flex-col transition-all duration-500 ease-in-out',
              showSidePanel ? 'left-0' : '-left-62',
            )}
            onMouseEnter={() => setShowSidePanel(true)}
            onMouseLeave={() => setShowSidePanel(false)}
          >
            <Sidebar isPanel panelVisible={showSidePanel} />
          </div>
        )}
        <div className="flex h-full flex-col bg-[var(--bg-soft)]">
          {!isMobile && <Header />}
          {appChatListDataLoading && <Loading type="app" />}
          {!appChatListDataLoading && <ChatWrapper key={chatShouldReloadKey} />}
        </div>
      </div>
    </div>
  )
}

type ChatWithHistoryWrapProps = {
  installedAppInfo?: InstalledAppResponse
  className?: string
  isNewAgent?: boolean
  renderAgentContent?: ChatProps['renderAgentContent']
}
const ChatWithHistoryWrap: FC<ChatWithHistoryWrapProps> = ({
  installedAppInfo,
  className,
  isNewAgent = false,
  renderAgentContent,
}) => {
  const media = useBreakpoints()
  const isMobile = media === MediaType.mobile

  const {
    appData,
    appParams,
    appMeta,
    appChatListDataLoading,
    currentConversationId,
    currentConversationItem,
    appPrevChatTree,
    pinnedConversationList,
    conversationList,
    newConversationInputs,
    newConversationInputsRef,
    handleNewConversationInputsChange,
    inputsForms,
    handleNewConversation,
    handleStartChat,
    handleChangeConversation,
    handlePinConversation,
    handleUnpinConversation,
    handleDeleteConversation,
    conversationRenaming,
    handleRenameConversation,
    handleNewConversationCompleted,
    chatShouldReloadKey,
    isInstalledApp,
    appId,
    handleFeedback,
    currentChatInstanceRef,
    sidebarCollapseState,
    handleSidebarCollapse,
    clearChatList,
    setClearChatList,
    isResponding,
    setIsResponding,
    currentConversationInputs,
    setCurrentConversationInputs,
    allInputsHidden,
    initUserVariables,
  } = useChatWithHistory(installedAppInfo)

  return (
    <ChatWithHistoryContext.Provider
      value={{
        appData,
        appParams,
        appMeta,
        appChatListDataLoading,
        currentConversationId,
        currentConversationItem,
        appPrevChatTree,
        pinnedConversationList,
        conversationList,
        newConversationInputs,
        newConversationInputsRef,
        handleNewConversationInputsChange,
        inputsForms,
        handleNewConversation,
        handleStartChat,
        handleChangeConversation,
        handlePinConversation,
        handleUnpinConversation,
        handleDeleteConversation,
        conversationRenaming,
        handleRenameConversation,
        handleNewConversationCompleted,
        chatShouldReloadKey,
        isMobile,
        isInstalledApp,
        appId,
        handleFeedback,
        currentChatInstanceRef,
        sidebarCollapseState,
        handleSidebarCollapse,
        clearChatList,
        setClearChatList,
        isResponding,
        setIsResponding,
        currentConversationInputs,
        setCurrentConversationInputs,
        allInputsHidden,
        initUserVariables,
        isNewAgent,
        renderAgentContent,
      }}
    >
      <ChatWithHistory className={className} />
    </ChatWithHistoryContext.Provider>
  )
}

const ChatWithHistoryWrapWithCheckToken: FC<ChatWithHistoryWrapProps> = ({
  installedAppInfo,
  className,
  isNewAgent,
  renderAgentContent,
}) => {
  return (
    <ChatWithHistoryWrap
      installedAppInfo={installedAppInfo}
      className={className}
      isNewAgent={isNewAgent}
      renderAgentContent={renderAgentContent}
    />
  )
}

export default ChatWithHistoryWrapWithCheckToken
