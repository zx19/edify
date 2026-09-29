import type { RefObject } from 'react'
import type { ChatConfig } from '@/app/components/base/chat/types'
import type { AppConversationData, AppData, AppMeta, ConversationItem } from '@/models/share'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import ChatWithHistory from '@/app/components/base/chat/chat-with-history'
import { useChatWithHistory } from '@/app/components/base/chat/chat-with-history/hooks'
import useBreakpoints, { MediaType } from '@/hooks/use-breakpoints'
import useDocumentTitle from '@/hooks/use-document-title'
import { renderWithConsoleQuery as render } from '@/test/console/query-data'

vi.mock('@/app/components/base/chat/chat-with-history/hooks', () => ({
  useChatWithHistory: vi.fn(),
}))

// ChatWrapper 挂真实 Chat 渲染链（Markdown/语音/文件等），单测仅关注壳层结构—— stub 成占位
vi.mock('@/app/components/base/chat/chat-with-history/chat-wrapper', () => ({
  default: () => <div data-testid="chat-wrapper" />,
}))

vi.mock('@/hooks/use-breakpoints', () => ({
  default: vi.fn(),
  MediaType: {
    mobile: 'mobile',
    tablet: 'tablet',
    pc: 'pc',
  },
}))

vi.mock('@/hooks/use-document-title', () => ({
  default: vi.fn(),
}))

vi.mock('@/next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
}))

type HookReturn = ReturnType<typeof useChatWithHistory>

const mockAppData = {
  site: { title: 'Test Chat', chat_color_theme: 'blue', chat_color_theme_inverted: false },
} as unknown as AppData

const defaultHookReturn: HookReturn = {
  isInstalledApp: false,
  appId: 'test-app-id',
  currentConversationId: '',
  currentConversationItem: undefined,
  handleConversationIdInfoChange: vi.fn(),
  appData: mockAppData,
  appParams: {} as ChatConfig,
  appMeta: {} as AppMeta,
  appPinnedConversationData: {
    data: [] as ConversationItem[],
    has_more: false,
    limit: 20,
  } as AppConversationData,
  appConversationData: {
    data: [] as ConversationItem[],
    has_more: false,
    limit: 20,
  } as AppConversationData,
  appConversationDataLoading: false,
  appChatListData: {
    data: [] as ConversationItem[],
    has_more: false,
    limit: 20,
  } as AppConversationData,
  appChatListDataLoading: false,
  appPrevChatTree: [],
  pinnedConversationList: [],
  conversationList: [],
  setShowNewConversationItemInList: vi.fn(),
  newConversationInputs: {},
  newConversationInputsRef: { current: {} } as unknown as RefObject<Record<string, unknown>>,
  handleNewConversationInputsChange: vi.fn(),
  inputsForms: [],
  handleNewConversation: vi.fn(),
  handleStartChat: vi.fn(),
  handleChangeConversation: vi.fn(),
  handlePinConversation: vi.fn(),
  handleUnpinConversation: vi.fn(),
  conversationDeleting: false,
  handleDeleteConversation: vi.fn(),
  conversationRenaming: false,
  handleRenameConversation: vi.fn(),
  handleNewConversationCompleted: vi.fn(),
  newConversationId: '',
  chatShouldReloadKey: 'test-reload-key',
  handleFeedback: vi.fn(),
  currentChatInstanceRef: { current: { handleStop: vi.fn() } },
  clearChatList: false,
  setClearChatList: vi.fn(),
  isResponding: false,
  setIsResponding: vi.fn(),
  currentConversationInputs: {},
  setCurrentConversationInputs: vi.fn(),
  allInputsHidden: false,
  initUserVariables: {},
}

describe('Base Chat Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useBreakpoints).mockReturnValue(MediaType.pc)
    vi.mocked(useChatWithHistory).mockReturnValue(defaultHookReturn)
  })

  // Chat-with-history shell integration across layout, responsive shell, and accent setup.
  describe('Chat With History Shell', () => {
    it('sets the document title and opens the conversation drawer via the header entry', async () => {
      const user = userEvent.setup()
      const { container } = render(<ChatWithHistory className="chat-history-shell" />)

      const titles = screen.getAllByText('Test Chat')
      expect(titles.length).toBeGreaterThan(0)
      expect(useDocumentTitle).toHaveBeenCalledWith('Test Chat')
      expect(container.querySelector('.chat-history-shell')).toBeInTheDocument()

      // 旧侧栏壳（悬停浮出面板）已删除：壳层不再渲染 .absolute.top-0.z-20 浮层
      expect(container.querySelector('.absolute.top-0.z-20')).not.toBeInTheDocument()

      // 新结构：40px header 内 ☰ 唤出 overlay 抽屉（关态 -translate-x-full + inert）
      const drawer = container.querySelector('aside[role="dialog"]') as HTMLElement
      expect(drawer).toHaveClass('-translate-x-full')

      await user.click(screen.getByRole('button', { name: 'share.chat.conversationHistory' }))
      expect(drawer).toHaveClass('translate-x-0')
    })

    it('injects accent tokens on the shell root when chat_color_theme changes', () => {
      const { container, rerender } = render(<ChatWithHistory />)

      // chat_color_theme → 壳层根 inline --accent 三档（替代旧 createTheme/context.theme 机制）
      const shell = container.querySelector('.webapp-theme') as HTMLElement
      expect(shell.style.getPropertyValue('--accent')).toBe('blue')

      vi.mocked(useChatWithHistory).mockReturnValue({
        ...defaultHookReturn,
        appData: {
          ...mockAppData,
          site: {
            ...mockAppData.site,
            chat_color_theme: '#654321',
            chat_color_theme_inverted: true,
          },
        },
      })
      rerender(<ChatWithHistory />)

      expect(shell.style.getPropertyValue('--accent')).toBe('#654321')
    })

    it('falls back to the mobile loading shell when site metadata is unavailable', () => {
      vi.mocked(useBreakpoints).mockReturnValue(MediaType.mobile)
      vi.mocked(useChatWithHistory).mockReturnValue({
        ...defaultHookReturn,
        appData: null,
        appChatListDataLoading: true,
      })

      const { container } = render(<ChatWithHistory className="mobile-chat-shell" />)

      expect(useDocumentTitle).toHaveBeenCalledWith('Chat')
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(container.querySelector('.mobile-chat-shell')).toBeInTheDocument()
      // 新移动壳：40px 极薄 header（banner）+ 抽屉入口；旧圆角浮层壳已删除
      expect(screen.getByRole('banner')).toHaveClass('h-10')
      expect(
        screen.getByRole('button', { name: 'share.chat.conversationHistory' }),
      ).toBeInTheDocument()
      expect(container.querySelector('.rounded-t-2xl')).not.toBeInTheDocument()
      expect(container.querySelector('.rounded-2xl')).not.toBeInTheDocument()
    })
  })
})
