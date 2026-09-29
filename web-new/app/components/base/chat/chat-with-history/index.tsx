'use client'
import type { InstalledAppResponse } from '@dify/contracts/api/console/installed-apps/types.gen'
import type { FC } from 'react'
import type { ChatProps } from '../chat'
import { cn } from '@xsl/lomva-ui/cn'
import { useEffect, useState } from 'react'
import Loading from '@/app/components/base/loading'
import useBreakpoints, { MediaType } from '@/hooks/use-breakpoints'
import useDocumentTitle from '@/hooks/use-document-title'
import { resolveUiConfig } from '@/models/ui-config'
import { buildAccentStyle } from '../accent-style'
import ChatWrapper from './chat-wrapper'
import { ChatWithHistoryContext, useChatWithHistoryContext } from './context'
import ConversationDrawer from './drawer'
import Header from './header'
import HeaderInMobile from './header-in-mobile'
import { useChatWithHistory } from './hooks'

type ChatWithHistoryProps = {
  className?: string
}

/**
 * 壳层（chat 单元重写，方向 A）：无侧栏列、无悬停浮出面板——会话管理收进 overlay 抽屉。
 * 单列 flex-col：header（桌面/移动二选一）+ 内容区（ChatWrapper / Loading）；
 * 抽屉（含蒙层）挂壳层根：抽屉顶=壳顶，蒙层覆盖 40px header（z-40/50 高于 header）。
 * ⌘K(Ctrl+K) 唤出抽屉；ui_config.layout.show_conversation_sidebar=false → 不渲染抽屉、不响应 ⌘K。
 * 契约注记：sidebarCollapseState/handleSidebarCollapse 在 context/hooks 暂留（chat-wrapper、
 * use-chat-layout 仍消费，Task 5/7 清理），壳层自本任务起不再消费。
 */
const ChatWithHistory: FC<ChatWithHistoryProps> = ({ className }) => {
  const { appData, appChatListDataLoading, chatShouldReloadKey, isMobile } =
    useChatWithHistoryContext()
  const site = appData?.site
  // 键义重映射：show_conversation_sidebar 原侧栏显隐 → 抽屉入口显隐
  const drawerEnabled = resolveUiConfig(site).layout.show_conversation_sidebar
  const [drawerOpen, setDrawerOpen] = useState(false)

  // ⌘K / Ctrl+K 唤出/收起抽屉（聚焦搜索由抽屉自身 open 副作用承担）；ui_config 关时不响应。
  // 抽屉内弹窗（重命名/删除/关于）开着时 ⌘K 让位、不收起抽屉：window 层检测已开 modal——
  // Base UI Dialog/AlertDialog popup 开态带 data-open（抽屉 aside 无 data-open，不误伤）。
  useEffect(() => {
    if (!drawerEnabled) return
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        // DOM 读取上提到调用前：setState updater 须保持纯函数（T4 评审修正）
        const modalOpen = !!document.querySelector(
          '[role="dialog"][data-open], [role="alertdialog"][data-open]',
        )
        setDrawerOpen((v) => (v && modalOpen ? v : !v))
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [drawerEnabled])

  useDocumentTitle(site?.title || 'Chat')

  const accentStyle = buildAccentStyle(site?.chat_color_theme)

  return (
    <div
      className={cn('webapp-theme relative flex h-full flex-col bg-[var(--bg)]', className)}
      style={accentStyle}
    >
      {isMobile ? (
        <HeaderInMobile onOpenDrawer={() => setDrawerOpen(true)} drawerEnabled={drawerEnabled} />
      ) : (
        <Header onOpenDrawer={() => setDrawerOpen(true)} drawerEnabled={drawerEnabled} />
      )}
      <div className="relative min-h-0 grow">
        {appChatListDataLoading && <Loading type="app" />}
        {!appChatListDataLoading && <ChatWrapper key={chatShouldReloadKey} />}
      </div>
      {/* 抽屉挂壳层根（非内容容器）：absolute 定位相对壳根，蒙层/面板覆盖 40px header */}
      {drawerEnabled && (
        <ConversationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      )}
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
