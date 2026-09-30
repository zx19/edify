import type { ReactElement, RefObject } from 'react'
import type { ChatConfig } from '../../types'
import type { AppData, AppMeta, ConversationItem } from '@/models/share'
import { screen } from '@testing-library/react'
import { vi } from 'vite-plus/test'
import useBreakpoints, { MediaType } from '@/hooks/use-breakpoints'
import { renderWithConsoleQuery } from '@/test/console/query-data'
import { useEmbeddedChatbot } from '../hooks'
import EmbeddedChatbot from '../index'

const render = (ui: ReactElement) => renderWithConsoleQuery(ui)

vi.mock('../hooks', () => ({
  useEmbeddedChatbot: vi.fn(),
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

vi.mock('../chat-wrapper', () => ({
  __esModule: true,
  default: () => <div>chat area</div>,
}))

vi.mock('../header', () => ({
  __esModule: true,
  default: () => <div role="banner">chat header</div>,
}))

type EmbeddedChatbotHookReturn = ReturnType<typeof useEmbeddedChatbot>

const createAppData = (chatColorTheme = 'blue', chatColorThemeInverted = false): AppData => ({
  app_id: 'app-1',
  can_replace_logo: true,
  custom_config: {
    remove_webapp_brand: false,
    replace_webapp_logo: '',
  },
  enable_site: true,
  end_user_id: 'user-1',
  site: {
    title: 'Embedded App',
    chat_color_theme: chatColorTheme,
    chat_color_theme_inverted: chatColorThemeInverted,
  },
})

const createHookReturn = (
  overrides: Partial<EmbeddedChatbotHookReturn> = {},
): EmbeddedChatbotHookReturn => {
  const base: EmbeddedChatbotHookReturn = {
    appSourceType: 'webApp' as EmbeddedChatbotHookReturn['appSourceType'],
    isInstalledApp: false,
    appId: 'app-1',
    currentConversationId: '',
    currentConversationItem: undefined,
    removeConversationIdInfo: vi.fn(),
    handleConversationIdInfoChange: vi.fn(),
    appData: createAppData(),
    appParams: {} as ChatConfig,
    appMeta: { tool_icons: {} } as AppMeta,
    appPinnedConversationData: { data: [], has_more: false, limit: 20 },
    appConversationData: { data: [], has_more: false, limit: 20 },
    appConversationDataLoading: false,
    appChatListData: { data: [], has_more: false, limit: 20 },
    appChatListDataLoading: false,
    appPrevChatList: [],
    pinnedConversationList: [] as ConversationItem[],
    conversationList: [] as ConversationItem[],
    setShowNewConversationItemInList: vi.fn(),
    newConversationInputs: {},
    newConversationInputsRef: { current: {} } as unknown as RefObject<Record<string, unknown>>,
    handleNewConversationInputsChange: vi.fn(),
    inputsForms: [],
    handleNewConversation: vi.fn(),
    handleStartChat: vi.fn(),
    handleChangeConversation: vi.fn(),
    handleNewConversationCompleted: vi.fn(),
    newConversationId: '',
    chatShouldReloadKey: 'reload-key',
    allowResetChat: true,
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

  return {
    ...base,
    ...overrides,
  }
}

/** 壳层内层卡（webapp-theme 作用域 + accent 注入点） */
const getShellCard = (container: HTMLElement) =>
  container.querySelector('[data-testid="chatbot-shell-card"]') as HTMLElement

describe('EmbeddedChatbot index', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useBreakpoints).mockReturnValue(MediaType.mobile)
    vi.mocked(useEmbeddedChatbot).mockReturnValue(createHookReturn())
  })

  describe('Loading and chat content', () => {
    it('should show loading state before chat content', () => {
      vi.mocked(useEmbeddedChatbot).mockReturnValue(
        createHookReturn({ appChatListDataLoading: true }),
      )

      render(<EmbeddedChatbot />)

      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.queryByText('chat area')).not.toBeInTheDocument()
    })

    it('should render chat content when loading finishes', () => {
      render(<EmbeddedChatbot />)

      expect(screen.getByText('chat area')).toBeInTheDocument()
    })
  })

  describe('壳层形态（v2：--bg 纯色 + 移动端卡片复位）', () => {
    it('内层卡自挂 webapp-theme 作用域且底色 var(--bg)', () => {
      const { container } = render(<EmbeddedChatbot />)

      expect(getShellCard(container)).toHaveClass(
        'webapp-theme',
        'flex',
        'h-full',
        'flex-col',
        'bg-[var(--bg)]',
      )
    })

    it('桌面直连：无卡片包装（无 rounded-2xl/shadow），外层无衬底', () => {
      vi.mocked(useBreakpoints).mockReturnValue(MediaType.pc)
      const { container } = render(<EmbeddedChatbot />)

      const card = getShellCard(container)
      expect(card.className).not.toContain('rounded-2xl')
      expect(card.className).not.toContain('shadow')
      expect(card.parentElement).toHaveClass('h-full')
      expect(card.parentElement!.className).not.toContain('p-2.5')
    })

    it('移动端直连：卡片 rounded-2xl + shadow-sm + overflow-hidden，外层 bg-soft + p-2.5', () => {
      // beforeEach 默认 MediaType.mobile；jsdom window.self===window.top → 非 iframe
      const { container } = render(<EmbeddedChatbot />)

      const card = getShellCard(container)
      expect(card).toHaveClass('overflow-hidden', 'rounded-2xl', 'shadow-[var(--shadow-sm)]')
      expect(card.parentElement).toHaveClass('bg-[var(--bg-soft)]', 'p-2.5')
    })

    it('footer 品牌行为透明底（无 bg-soft）', () => {
      render(<EmbeddedChatbot />)

      const footer = screen.getByText('share.chat.poweredBy').parentElement as HTMLElement
      expect(footer.className).not.toContain('bg-[')
    })
  })

  describe('Accent injection（chat_color_theme → --accent 族，替代 createTheme）', () => {
    it('injects accent tokens on shell card when chat_color_theme set', () => {
      const { container } = render(<EmbeddedChatbot />)

      const style = getShellCard(container).getAttribute('style') || ''
      expect(style).toContain('--accent: blue')
      expect(style).toContain('--accent-deep')
      expect(style).toContain('--accent-soft')
    })

    it('keeps accent isolated between chat roots', () => {
      vi.mocked(useEmbeddedChatbot)
        .mockReturnValueOnce(createHookReturn({ appData: createAppData('#FF0000') }))
        .mockReturnValueOnce(createHookReturn({ appData: createAppData('#00FF00') }))

      const { container } = render(
        <>
          <EmbeddedChatbot />
          <EmbeddedChatbot />
        </>,
      )

      const styles = [...container.querySelectorAll('[data-testid="chatbot-shell-card"]')].map(
        (el) => el.getAttribute('style') || '',
      )
      expect(styles).toHaveLength(2)
      expect(styles[0]).toContain('--accent: #FF0000')
      expect(styles[1]).toContain('--accent: #00FF00')
    })

    it('updates accent when site configuration changes', () => {
      vi.mocked(useEmbeddedChatbot).mockReturnValue(
        createHookReturn({ appData: createAppData('#123456') }),
      )
      const { container, rerender } = render(<EmbeddedChatbot />)

      expect(getShellCard(container).getAttribute('style')).toContain('--accent: #123456')

      vi.mocked(useEmbeddedChatbot).mockReturnValue(
        createHookReturn({ appData: createAppData('#654321') }),
      )
      rerender(<EmbeddedChatbot />)

      expect(getShellCard(container).getAttribute('style')).toContain('--accent: #654321')
    })

    it('injects nothing when chat_color_theme absent', () => {
      vi.mocked(useEmbeddedChatbot).mockReturnValue(
        createHookReturn({
          appData: {
            ...createAppData(),
            site: { title: 'Embedded App' },
          } as AppData,
        }),
      )
      const { container } = render(<EmbeddedChatbot />)

      expect(getShellCard(container).getAttribute('style')).toBeNull()
    })
  })

  describe('Powered by branding（底部一行，双端统一）', () => {
    it('shows ui_config.brand.footer_text when configured', () => {
      vi.mocked(useEmbeddedChatbot).mockReturnValue(
        createHookReturn({
          appData: {
            ...createAppData(),
            site: {
              title: 'Embedded App',
              ui_config: { brand: { footer_text: 'Powered by 自定义品牌' } },
            },
          } as AppData,
        }),
      )

      render(<EmbeddedChatbot />)

      expect(screen.getByText('share.chat.poweredBy')).toBeInTheDocument()
      expect(screen.getByText('Powered by 自定义品牌')).toBeInTheDocument()
    })

    it('should show custom logo when replace_webapp_logo set and no footer_text', () => {
      vi.mocked(useEmbeddedChatbot).mockReturnValue(
        createHookReturn({
          appData: {
            ...createAppData(),
            custom_config: {
              remove_webapp_brand: false,
              replace_webapp_logo: 'https://example.com/custom-logo.png',
            },
          },
        }),
      )

      render(<EmbeddedChatbot />)

      expect(screen.getByText('share.chat.poweredBy')).toBeInTheDocument()
      expect(screen.getByAltText('logo')).toHaveAttribute(
        'src',
        'https://example.com/custom-logo.png',
      )
    })

    it('should show default 杏树林 when nothing configured', () => {
      render(<EmbeddedChatbot />)

      expect(screen.getByText('share.chat.poweredBy')).toBeInTheDocument()
      expect(screen.getByText('杏树林')).toBeInTheDocument()
    })

    it('should hide powered by section when branding is removed', () => {
      vi.mocked(useEmbeddedChatbot).mockReturnValue(
        createHookReturn({
          appData: {
            ...createAppData(),
            custom_config: {
              remove_webapp_brand: true,
              replace_webapp_logo: '',
            },
          },
        }),
      )

      render(<EmbeddedChatbot />)

      expect(screen.queryByText('share.chat.poweredBy')).not.toBeInTheDocument()
    })

    it('should ALSO show powered by on desktop（双端统一拍板，不再是移动端专属）', () => {
      vi.mocked(useBreakpoints).mockReturnValue(MediaType.pc)
      vi.mocked(useEmbeddedChatbot).mockReturnValue(createHookReturn())

      render(<EmbeddedChatbot />)

      expect(screen.getByText('share.chat.poweredBy')).toBeInTheDocument()
      expect(screen.getByText('chat header')).toBeInTheDocument()
    })
  })
})
