import { act, fireEvent, render, screen } from '@testing-library/react'
import { useChatWithHistory } from '../hooks'
import ChatWithHistory from '../index'

type HeaderProps = Readonly<{
  onOpenDrawer?: () => void
  drawerEnabled?: boolean
}>
type HeaderInMobileProps = Readonly<{
  onOpenDrawer?: () => void
}>
type DrawerProps = Readonly<{
  open: boolean
  onClose: () => void
}>

// 捕获子组件 props + 断言侧栏不再被壳层渲染
const { captured, mediaMock, sidebarRenderMock } = vi.hoisted(() => ({
  captured: {
    headerProps: {} as HeaderProps,
    mobileHeaderProps: {} as HeaderInMobileProps,
    drawerProps: { open: false, onClose: () => {} } as DrawerProps,
  },
  mediaMock: { current: 'pc' as 'mobile' | 'tablet' | 'pc' },
  sidebarRenderMock: vi.fn(),
}))

vi.mock('../hooks', () => ({
  useChatWithHistory: vi.fn(),
}))

vi.mock('@/hooks/use-breakpoints', () => ({
  default: () => mediaMock.current,
  MediaType: { mobile: 'mobile', tablet: 'tablet', pc: 'pc' },
}))

// useDocumentTitle 内部走 useSuspenseQuery，壳层测试不关心文档标题
vi.mock('@/hooks/use-document-title', () => ({
  default: vi.fn(),
}))

vi.mock('@/app/components/base/loading', () => ({
  default: () => <div data-testid="loading" />,
}))

vi.mock('../chat-wrapper', () => ({
  default: () => <div data-testid="chat-wrapper" />,
}))

vi.mock('../header', () => ({
  default: (props: HeaderProps) => {
    captured.headerProps = props
    return <div data-testid="header" />
  },
}))

vi.mock('../header-in-mobile', () => ({
  default: (props: HeaderInMobileProps) => {
    captured.mobileHeaderProps = props
    return <div data-testid="header-in-mobile" />
  },
}))

vi.mock('../drawer', () => ({
  default: (props: DrawerProps) => {
    captured.drawerProps = props
    return <div data-testid="conversation-drawer" data-open={String(props.open)} />
  },
}))

vi.mock('../sidebar', () => ({
  default: (props: unknown) => {
    sidebarRenderMock(props)
    return <div data-testid="sidebar" />
  },
}))

const baseSite = {
  title: 'Test App',
  icon_type: 'emoji',
  icon: '🤖',
  icon_background: '#fff',
  icon_url: '',
}

const mockHookValue = (
  siteOverride: Record<string, unknown> = {},
  appChatListDataLoading = false,
) =>
  ({
    appData: {
      app_id: 'app-1',
      site: { ...baseSite, ...siteOverride },
      custom_config: {},
    },
    appChatListDataLoading,
    chatShouldReloadKey: 'reload-1',
    // 其余字段留 undefined：呈现层子组件均被 mock，无人消费
  }) as unknown as ReturnType<typeof useChatWithHistory>

describe('ChatWithHistory 壳层（Task 3：去侧栏列，挂抽屉）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mediaMock.current = 'pc'
    vi.mocked(useChatWithHistory).mockReturnValue(mockHookValue())
  })

  describe('布局结构', () => {
    it('should render header + content without the sidebar column', () => {
      render(<ChatWithHistory />)

      expect(screen.getByTestId('header')).toBeInTheDocument()
      expect(screen.getByTestId('chat-wrapper')).toBeInTheDocument()
      expect(screen.queryByTestId('header-in-mobile')).not.toBeInTheDocument()
      // 侧栏列已删：Sidebar 不再被壳层渲染
      expect(sidebarRenderMock).not.toHaveBeenCalled()
      expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument()
      // 抽屉默认挂载、关态
      expect(screen.getByTestId('conversation-drawer')).toHaveAttribute('data-open', 'false')
    })

    it('should pass onOpenDrawer and drawerEnabled to the desktop header', () => {
      render(<ChatWithHistory />)

      expect(captured.headerProps.onOpenDrawer).toBeInstanceOf(Function)
      expect(captured.headerProps.drawerEnabled).toBe(true)
    })

    it('should render mobile header with onOpenDrawer when mobile', () => {
      mediaMock.current = 'mobile'
      render(<ChatWithHistory />)

      expect(screen.getByTestId('header-in-mobile')).toBeInTheDocument()
      expect(screen.queryByTestId('header')).not.toBeInTheDocument()
      expect(captured.mobileHeaderProps.onOpenDrawer).toBeInstanceOf(Function)
    })

    it('should show loading instead of chat wrapper while chat list is loading', () => {
      vi.mocked(useChatWithHistory).mockReturnValue(mockHookValue({}, true))
      render(<ChatWithHistory />)

      expect(screen.getByTestId('loading')).toBeInTheDocument()
      expect(screen.queryByTestId('chat-wrapper')).not.toBeInTheDocument()
    })

    it('should inject accent style and webapp-theme scope on the root', () => {
      vi.mocked(useChatWithHistory).mockReturnValue(mockHookValue({ chat_color_theme: '#123456' }))
      const { container } = render(<ChatWithHistory />)

      const root = container.firstElementChild as HTMLElement
      expect(root.className).toContain('webapp-theme')
      expect(root.style.getPropertyValue('--accent')).toBe('#123456')
    })
  })

  describe('抽屉开合', () => {
    it('should open the drawer when header onOpenDrawer is invoked', () => {
      render(<ChatWithHistory />)

      act(() => captured.headerProps.onOpenDrawer?.())
      expect(screen.getByTestId('conversation-drawer')).toHaveAttribute('data-open', 'true')

      act(() => captured.drawerProps.onClose())
      expect(screen.getByTestId('conversation-drawer')).toHaveAttribute('data-open', 'false')
    })

    it('should open the drawer from the mobile header', () => {
      mediaMock.current = 'mobile'
      render(<ChatWithHistory />)

      act(() => captured.mobileHeaderProps.onOpenDrawer?.())
      expect(screen.getByTestId('conversation-drawer')).toHaveAttribute('data-open', 'true')
    })

    it('should toggle the drawer with ⌘K', () => {
      render(<ChatWithHistory />)

      fireEvent.keyDown(window, { key: 'k', metaKey: true })
      expect(screen.getByTestId('conversation-drawer')).toHaveAttribute('data-open', 'true')

      fireEvent.keyDown(window, { key: 'k', metaKey: true })
      expect(screen.getByTestId('conversation-drawer')).toHaveAttribute('data-open', 'false')
    })

    it('should toggle the drawer with Ctrl+K', () => {
      render(<ChatWithHistory />)

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
      expect(screen.getByTestId('conversation-drawer')).toHaveAttribute('data-open', 'true')
    })

    it('should not toggle the drawer on bare K or other modifier combos', () => {
      render(<ChatWithHistory />)

      fireEvent.keyDown(window, { key: 'k' })
      fireEvent.keyDown(window, { key: 'k', altKey: true })
      fireEvent.keyDown(window, { key: 'j', metaKey: true })
      expect(screen.getByTestId('conversation-drawer')).toHaveAttribute('data-open', 'false')
    })
  })

  describe('ui_config 门控（show_conversation_sidebar=false）', () => {
    beforeEach(() => {
      vi.mocked(useChatWithHistory).mockReturnValue(
        mockHookValue({ ui_config: { layout: { show_conversation_sidebar: false } } }),
      )
    })

    it('should not render the drawer and should flag drawerEnabled=false to header', () => {
      render(<ChatWithHistory />)

      expect(screen.queryByTestId('conversation-drawer')).not.toBeInTheDocument()
      expect(captured.headerProps.drawerEnabled).toBe(false)
    })

    it('should not respond to ⌘K when the drawer is disabled', () => {
      render(<ChatWithHistory />)

      fireEvent.keyDown(window, { key: 'k', metaKey: true })
      expect(screen.queryByTestId('conversation-drawer')).not.toBeInTheDocument()
    })
  })
})
