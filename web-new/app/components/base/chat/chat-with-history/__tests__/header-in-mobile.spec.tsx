import type { i18n } from 'i18next'
import type { ChatWithHistoryContextValue } from '../context'
import type { AppData, ConversationItem } from '@/models/share'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as ReactI18next from 'react-i18next'
import { withSelectorKey } from '@/test/i18n-mock'
import { useChatWithHistoryContext } from '../context'
import HeaderInMobile from '../header-in-mobile'

// Mock context module
vi.mock('../context', () => ({
  useChatWithHistoryContext: vi.fn(),
}))

// 变量表单内容体：全屏浮层只断言开合，不断言表单内部
vi.mock('@/app/components/base/chat/chat-with-history/inputs-form/content', () => ({
  default: () => <div data-testid="inputs-form-content">InputsFormContent</div>,
}))

const mockAppData: AppData = {
  app_id: 'test-app',
  custom_config: null,
  site: {
    title: 'Test Chat',
    icon_type: 'emoji',
    icon: '🤖',
    icon_background: '#fff',
    icon_url: '',
  },
}

const mockConversation = (overrides: Partial<ConversationItem> = {}): ConversationItem =>
  ({
    id: 'conv-1',
    name: 'Conv 1',
    inputs: null,
    introduction: '',
    ...overrides,
  }) as ConversationItem

// collapse 契约已随 T9 摘除（抽屉化后无布局驱动语义）：移动 header 本就不消费，默认值同步不含
const mockContextDefaults: ChatWithHistoryContextValue = {
  appData: mockAppData,
  currentConversationId: '',
  currentConversationItem: undefined,
  inputsForms: [],
  pinnedConversationList: [],
  handlePinConversation: vi.fn(),
  handleUnpinConversation: vi.fn(),
  handleDeleteConversation: vi.fn(),
  handleRenameConversation: vi.fn(),
  handleNewConversation: vi.fn(),
  isResponding: false,
  conversationRenaming: false,
} as unknown as ChatWithHistoryContextValue

type HeaderInMobileProps = Readonly<{
  onOpenDrawer?: () => void
  drawerEnabled?: boolean
}>

const setup = (
  overrides: Partial<ChatWithHistoryContextValue> = {},
  props: HeaderInMobileProps = { drawerEnabled: true, onOpenDrawer: vi.fn() },
) => {
  vi.mocked(useChatWithHistoryContext).mockReturnValue({
    ...mockContextDefaults,
    ...overrides,
  })
  return render(<HeaderInMobile {...props} />)
}

describe('HeaderInMobile（Task 8：移动端极薄 header，对照桌面 header 与 mockup 移动端帧）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Structure', () => {
    it('should render a 40px banner header without bottom border（极薄，同桌面）', () => {
      setup()
      const header = screen.getByRole('banner')
      expect(header).toHaveClass('h-10')
      expect(header.className).not.toContain('border-b')
    })

    it('should render the drawer entry (☰) with conversation-history label when drawerEnabled', () => {
      setup({}, { drawerEnabled: true, onOpenDrawer: vi.fn() })
      expect(
        screen.getByRole('button', { name: 'share.chat.conversationHistory' }),
      ).toBeInTheDocument()
    })

    it('should hide the drawer entry when drawerEnabled is false', () => {
      setup({}, { drawerEnabled: false, onOpenDrawer: vi.fn() })
      expect(
        screen.queryByRole('button', { name: 'share.chat.conversationHistory' }),
      ).not.toBeInTheDocument()
    })

    it('should render weakened app identity (icon + name in text-2) when no conversation', () => {
      setup({ currentConversationId: '', currentConversationItem: undefined })
      const titleEl = screen.getByText('Test Chat')
      expect(titleEl).toHaveClass('font-semibold')
      expect(titleEl).toHaveClass('text-[var(--text-2)]')
    })

    it('should render the conversation title dropdown instead of app identity inside a conversation', () => {
      setup({
        currentConversationId: 'conv-1',
        currentConversationItem: mockConversation(),
      })
      expect(screen.getByText('Conv 1')).toBeInTheDocument()
      // mockup 移动端帧：会话态只显示会话标题，不再显示应用名
      expect(screen.queryByText('Test Chat')).not.toBeInTheDocument()
    })

    it('should never render the legacy expand-sidebar button', () => {
      setup()
      expect(
        screen.queryByRole('button', { name: 'layout.sidebar.expandSidebar' }),
      ).not.toBeInTheDocument()
    })

    it('should not render a ⋯ more menu (D11：菜单唯一落点=抽屉底部)', () => {
      setup({
        currentConversationId: 'conv-1',
        currentConversationItem: mockConversation(),
        inputsForms: [{ variable: 'v', label: 'V', type: 'text', required: true }],
      })
      expect(
        screen.queryByRole('button', { name: 'common.operation.more' }),
      ).not.toBeInTheDocument()
    })
  })

  describe('Drawer entry (replaces legacy sidebar overlay)', () => {
    it('should invoke onOpenDrawer when ☰ is clicked instead of opening a local overlay', async () => {
      const onOpenDrawer = vi.fn()
      setup({}, { drawerEnabled: true, onOpenDrawer })

      await userEvent.click(screen.getByRole('button', { name: 'share.chat.conversationHistory' }))
      expect(onOpenDrawer).toHaveBeenCalledTimes(1)
      // legacy 全屏侧栏浮层已删除：不再有本地 overlay
      expect(screen.queryByTestId('mobile-sidebar-overlay')).not.toBeInTheDocument()
      expect(screen.queryByTestId('sidebar-content')).not.toBeInTheDocument()
    })

    it('should never render the legacy sidebar overlay path', () => {
      setup()
      expect(screen.queryByTestId('mobile-sidebar-overlay')).not.toBeInTheDocument()
    })
  })

  describe('Right action group（对照桌面 header，图标钮移动适配）', () => {
    it('should render view-chat-settings entry whenever inputs forms exist', () => {
      setup({
        inputsForms: [{ variable: 'v', label: 'V', type: 'text', required: true }],
      })
      expect(
        screen.getByRole('button', { name: 'share.chat.viewChatSettings' }),
      ).toBeInTheDocument()
    })

    it('should not render view-chat-settings entry when inputsForms is empty', () => {
      setup({ inputsForms: [] })
      expect(
        screen.queryByRole('button', { name: 'share.chat.viewChatSettings' }),
      ).not.toBeInTheDocument()
    })

    it('should render reset-chat only inside an existing conversation', () => {
      const { unmount } = setup({
        currentConversationId: 'conv-1',
        currentConversationItem: mockConversation(),
      })
      expect(screen.getByRole('button', { name: 'share.chat.resetChat' })).toBeInTheDocument()

      unmount()
      setup({ currentConversationId: '', currentConversationItem: undefined })
      expect(screen.queryByRole('button', { name: 'share.chat.resetChat' })).not.toBeInTheDocument()
    })

    it('should always render the new-chat button', () => {
      setup({ currentConversationId: '' }, { drawerEnabled: false })
      expect(screen.getByRole('button', { name: 'share.chat.newChatTip' })).toBeInTheDocument()
    })

    it('should disable new-chat when already in a new conversation', () => {
      setup({ isResponding: false, currentConversationId: '' })
      expect(screen.getByRole('button', { name: 'share.chat.newChatTip' })).toBeDisabled()
    })

    it('should disable new-chat while responding', () => {
      setup({ isResponding: true, currentConversationId: 'conv-1' })
      expect(screen.getByRole('button', { name: 'share.chat.newChatTip' })).toBeDisabled()
    })

    it('should handle new conversation via the reset button', async () => {
      const handleNewConversation = vi.fn()
      setup({
        handleNewConversation,
        currentConversationId: 'conv-1',
        currentConversationItem: mockConversation(),
      })

      await userEvent.click(screen.getByRole('button', { name: 'share.chat.resetChat' }))
      expect(handleNewConversation).toHaveBeenCalled()
    })

    it('should handle new conversation via the new-chat button', async () => {
      const handleNewConversation = vi.fn()
      setup({
        handleNewConversation,
        currentConversationId: 'conv-1',
        currentConversationItem: mockConversation(),
      })

      await userEvent.click(screen.getByRole('button', { name: 'share.chat.newChatTip' }))
      expect(handleNewConversation).toHaveBeenCalled()
    })
  })

  describe('变量设置全屏浮层（保留不动）', () => {
    const withForms = {
      inputsForms: [{ variable: 'v', label: 'V', type: 'text', required: true }],
    }

    it('should open the full-screen chat settings overlay from the right action group', async () => {
      setup(withForms)

      await userEvent.click(screen.getByRole('button', { name: 'share.chat.viewChatSettings' }))
      expect(await screen.findByTestId('mobile-chat-settings-overlay')).toBeInTheDocument()
    })

    it('should close the overlay via mask click and keep it open on inner click', async () => {
      setup(withForms)

      await userEvent.click(screen.getByRole('button', { name: 'share.chat.viewChatSettings' }))
      expect(await screen.findByTestId('mobile-chat-settings-overlay')).toBeInTheDocument()

      // 点浮层内部不收起
      fireEvent.click(screen.getByText('share.chat.chatSettingsTitle'))
      expect(screen.getByTestId('mobile-chat-settings-overlay')).toBeInTheDocument()

      // 点蒙层收起
      fireEvent.click(screen.getByTestId('mobile-chat-settings-overlay'))
      await waitFor(() => {
        expect(screen.queryByTestId('mobile-chat-settings-overlay')).not.toBeInTheDocument()
      })
    })
  })

  describe('Conversation operations（会话标题▾ 下拉）', () => {
    const inConversation = {
      currentConversationId: 'conv-1',
      currentConversationItem: mockConversation(),
      pinnedConversationList: [],
    }

    it('should handle pin conversation', async () => {
      const handlePinConversation = vi.fn()
      setup({ ...inConversation, handlePinConversation })

      await userEvent.click(screen.getByText('Conv 1'))
      await userEvent.click(await screen.findByText('explore.sidebar.action.pin'))
      expect(handlePinConversation).toHaveBeenCalledWith('conv-1')
    })

    it('should handle unpin conversation', async () => {
      const handleUnpinConversation = vi.fn()
      setup({
        ...inConversation,
        handleUnpinConversation,
        pinnedConversationList: [mockConversation()],
      })

      await userEvent.click(screen.getByText('Conv 1'))
      await userEvent.click(await screen.findByText('explore.sidebar.action.unpin'))
      expect(handleUnpinConversation).toHaveBeenCalledWith('conv-1')
    })

    it('should handle rename conversation flow', async () => {
      const handleRenameConversation = vi.fn()
      setup({ ...inConversation, handleRenameConversation })

      await userEvent.click(screen.getByText('Conv 1'))
      await userEvent.click(await screen.findByText('explore.sidebar.action.rename'))

      const input = await screen.findByDisplayValue('Conv 1')
      await userEvent.clear(input)
      await userEvent.type(input, 'New Name')
      await userEvent.click(screen.getByRole('button', { name: 'common.operation.save' }))

      expect(handleRenameConversation).toHaveBeenCalledWith(
        'conv-1',
        'New Name',
        expect.any(Object),
      )
    })

    it('should cancel rename conversation', async () => {
      const handleRenameConversation = vi.fn()
      setup({ ...inConversation, handleRenameConversation })

      await userEvent.click(screen.getByText('Conv 1'))
      await userEvent.click(await screen.findByText('explore.sidebar.action.rename'))

      expect(await screen.findByRole('dialog')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'common.operation.cancel' }))

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
      expect(handleRenameConversation).not.toHaveBeenCalled()
    })

    it('should show loading state while renaming', async () => {
      setup({ ...inConversation, conversationRenaming: true })

      await userEvent.click(screen.getByText('Conv 1'))
      await userEvent.click(await screen.findByText('explore.sidebar.action.rename'))

      expect(await screen.findByRole('dialog')).toBeInTheDocument()
    })

    it('should handle delete conversation flow', async () => {
      const handleDeleteConversation = vi.fn()
      setup({ ...inConversation, handleDeleteConversation })

      await userEvent.click(screen.getByText('Conv 1'))
      await userEvent.click(await screen.findByText('explore.sidebar.action.delete'))

      expect(await screen.findByText('share.chat.deleteConversation.title')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'common.operation.confirm' }))
      expect(handleDeleteConversation).toHaveBeenCalledWith('conv-1', expect.any(Object))
    })

    it('should cancel delete conversation', async () => {
      const handleDeleteConversation = vi.fn()
      setup({ ...inConversation, handleDeleteConversation })

      await userEvent.click(screen.getByText('Conv 1'))
      await userEvent.click(await screen.findByText('explore.sidebar.action.delete'))

      expect(await screen.findByText('share.chat.deleteConversation.title')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'common.operation.cancel' }))

      await waitFor(() => {
        expect(screen.queryByText('share.chat.deleteConversation.title')).not.toBeInTheDocument()
      })
      expect(handleDeleteConversation).not.toHaveBeenCalled()
    })

    it('should use empty string fallback for delete content translation', async () => {
      const handleDeleteConversation = vi.fn()
      const useTranslationSpy = vi.spyOn(ReactI18next, 'useTranslation')
      useTranslationSpy.mockReturnValue({
        t: withSelectorKey((key: string) => (key === 'chat.deleteConversation.content' ? '' : key)),
        i18n: {} as unknown as i18n,
        ready: true,
        tReady: true,
      } as unknown as ReturnType<typeof ReactI18next.useTranslation>)

      try {
        setup({ ...inConversation, handleDeleteConversation })

        await userEvent.click(screen.getByText('Conv 1'))
        // i18n spy 返回裸 key（无 ns 前缀），用前缀无关 regex 匹配
        await userEvent.click(await screen.findByText(/sidebar\.action\.delete/i))

        const confirm = await screen.findByRole('button', {
          name: /common\.operation\.confirm|operation\.confirm/i,
        })
        await userEvent.click(confirm)
        expect(handleDeleteConversation).toHaveBeenCalledWith('conv-1', expect.any(Object))
      } finally {
        useTranslationSpy.mockRestore()
      }
    })

    it('should use empty string fallback for rename modal name', async () => {
      const handleRenameConversation = vi.fn()
      const { container } = setup({
        ...inConversation,
        currentConversationItem: mockConversation({ name: '' }),
        handleRenameConversation,
      })

      // 空名会话：通过下拉箭头定位触发器
      const trigger = container.querySelector('.i-ri-arrow-down-s-line')?.closest('button')
      expect(trigger).not.toBeNull()
      await userEvent.click(trigger as HTMLElement)
      await userEvent.click(await screen.findByText('explore.sidebar.action.rename'))

      const input = await screen.findByRole('textbox')
      expect(input).toHaveValue('')

      await userEvent.type(input, 'Renamed from empty')
      await userEvent.click(screen.getByRole('button', { name: 'common.operation.save' }))
      expect(handleRenameConversation).toHaveBeenCalledWith(
        'conv-1',
        'Renamed from empty',
        expect.any(Object),
      )
    })
  })
})
