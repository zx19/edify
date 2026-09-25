import type { ChatWithHistoryContextValue } from '../../context'
import type { AppData, ConversationItem } from '@/models/share'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { useChatWithHistoryContext } from '../../context'
import Header from '../index'

// Mock context module
vi.mock('../../context', () => ({
  useChatWithHistoryContext: vi.fn(),
}))

// Mock InputsFormContent
vi.mock('@/app/components/base/chat/chat-with-history/inputs-form/content', () => ({
  default: () => <div data-testid="inputs-form-content">InputsFormContent</div>,
}))

const mockAppData: AppData = {
  app_id: 'app-1',
  site: {
    title: 'Test App',
    icon_type: 'emoji',
    icon: '🤖',
    icon_background: '#fff',
    icon_url: '',
  },
  end_user_id: 'user-1',
  custom_config: null,
  can_replace_logo: false,
}

// 默认值不再含 sidebarCollapseState/handleSidebarCollapse：壳层去侧栏后 header 不消费 collapse 语义
const mockContextDefaults: ChatWithHistoryContextValue = {
  appData: mockAppData,
  currentConversationId: '',
  currentConversationItem: undefined,
  inputsForms: [],
  pinnedConversationList: [],
  handlePinConversation: vi.fn(),
  handleUnpinConversation: vi.fn(),
  handleRenameConversation: vi.fn(),
  handleDeleteConversation: vi.fn(),
  handleNewConversation: vi.fn(),
  isResponding: false,
  conversationRenaming: false,
  showConfig: false,
} as unknown as ChatWithHistoryContextValue

type HeaderProps = Readonly<{
  onOpenDrawer?: () => void
  drawerEnabled?: boolean
}>

const setup = (
  overrides: Partial<ChatWithHistoryContextValue> = {},
  props: HeaderProps = { drawerEnabled: true },
) => {
  vi.mocked(useChatWithHistoryContext).mockReturnValue({
    ...mockContextDefaults,
    ...overrides,
  })
  return render(<Header {...props} />)
}

describe('Header Component（Task 4：40px 极薄桌面 header）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Structure（对照 mockup 类型1 header）', () => {
    it('should render a 40px banner header', () => {
      setup()
      const header = screen.getByRole('banner')
      expect(header).toHaveClass('h-10')
    })

    it('should render weakened app identity (small icon + name in text-2)', () => {
      setup()
      const titleEl = screen.getByText('Test App')
      expect(titleEl).toHaveClass('font-semibold')
      expect(titleEl).toHaveClass('text-[var(--text-2)]')
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

    it('should never render the legacy expand-sidebar button even when collapse state is true', () => {
      // 壳层已无侧栏列：旧「展开侧栏」钮连同 collapse 逻辑一并删除
      setup({ sidebarCollapseState: true } as Partial<ChatWithHistoryContextValue>)
      expect(
        screen.queryByRole('button', { name: 'layout.sidebar.expandSidebar' }),
      ).not.toBeInTheDocument()
    })

    it('should render the conversation title dropdown only when a conversation exists', () => {
      const mockConv = { id: 'conv-1', name: 'My Chat' } as ConversationItem
      const { unmount } = setup({
        currentConversationId: 'conv-1',
        currentConversationItem: mockConv,
      })
      expect(screen.getByText('My Chat')).toBeInTheDocument()

      unmount()
      // 新会话/欢迎屏：无会话标题（mockup：welcome/form 态隐藏 hd-conv）
      setup({ currentConversationId: '', currentConversationItem: undefined })
      expect(screen.queryByText('My Chat')).not.toBeInTheDocument()
    })

    it('should render exactly the five header actions when everything is on (D11: no ⋯ menu)', () => {
      const mockConv = { id: 'conv-1', name: 'My Chat' } as ConversationItem
      setup({
        currentConversationId: 'conv-1',
        currentConversationItem: mockConv,
        inputsForms: [{ id: 'form-1' }],
      })
      // ☰(1) + 会话标题▾(1) + 查看变量(1) + 重置对话(1) + 新对话(1) = 5
      expect(screen.getAllByRole('button')).toHaveLength(5)
    })
  })

  describe('Right action group', () => {
    it('should render ViewFormDropdown whenever inputs forms exist (mockup form 态无会话也显示)', () => {
      setup({ currentConversationId: '', inputsForms: [{ id: 'form-1' }] })
      expect(
        screen.getByRole('button', { name: 'share.chat.viewChatSettings' }),
      ).toBeInTheDocument()
    })

    it('should not render ViewFormDropdown when inputsForms is empty', () => {
      const mockConv = { id: 'conv-1', name: 'My Chat' } as ConversationItem
      setup({ currentConversationId: 'conv-1', currentConversationItem: mockConv, inputsForms: [] })
      expect(
        screen.queryByRole('button', { name: 'share.chat.viewChatSettings' }),
      ).not.toBeInTheDocument()
    })

    it('should render reset-chat only inside an existing conversation（原位沿用）', () => {
      const mockConv = { id: 'conv-1', name: 'My Chat' } as ConversationItem
      const { unmount } = setup({
        currentConversationId: 'conv-1',
        currentConversationItem: mockConv,
      })
      expect(screen.getByRole('button', { name: 'share.chat.resetChat' })).toBeInTheDocument()

      unmount()
      setup({ currentConversationId: '' })
      expect(screen.queryByRole('button', { name: 'share.chat.resetChat' })).not.toBeInTheDocument()
    })

    it('should always render the new-chat button（对照表：恒在）', () => {
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
  })

  describe('Interactions', () => {
    it('should invoke onOpenDrawer when the ☰ button is clicked', async () => {
      const onOpenDrawer = vi.fn()
      setup({}, { drawerEnabled: true, onOpenDrawer })

      await userEvent.click(screen.getByRole('button', { name: 'share.chat.conversationHistory' }))
      expect(onOpenDrawer).toHaveBeenCalledTimes(1)
    })

    it('should handle new conversation via the reset button', async () => {
      const handleNewConversation = vi.fn()
      setup({ handleNewConversation, currentConversationId: 'conv-1' })

      await userEvent.click(screen.getByRole('button', { name: 'share.chat.resetChat' }))
      expect(handleNewConversation).toHaveBeenCalled()
    })

    it('should handle new conversation via the new-chat button', async () => {
      const handleNewConversation = vi.fn()
      setup({ handleNewConversation, currentConversationId: 'conv-1' })

      await userEvent.click(screen.getByRole('button', { name: 'share.chat.newChatTip' }))
      expect(handleNewConversation).toHaveBeenCalled()
    })

    it('should render operation menu and handle pin', async () => {
      const handlePinConversation = vi.fn()
      const mockConv = { id: 'conv-1', name: 'My Chat' } as ConversationItem
      setup({
        currentConversationId: 'conv-1',
        currentConversationItem: mockConv,
        handlePinConversation,
      })

      await userEvent.click(screen.getByText('My Chat'))

      const pinBtn = await screen.findByText('explore.sidebar.action.pin')
      expect(pinBtn).toBeInTheDocument()

      await userEvent.click(pinBtn)
      expect(handlePinConversation).toHaveBeenCalledWith('conv-1')
    })

    it('should handle unpin', async () => {
      const handleUnpinConversation = vi.fn()
      const mockConv = { id: 'conv-1', name: 'My Chat' } as ConversationItem
      setup({
        currentConversationId: 'conv-1',
        currentConversationItem: mockConv,
        handleUnpinConversation,
        pinnedConversationList: [{ id: 'conv-1' } as ConversationItem],
      })

      await userEvent.click(screen.getByText('My Chat'))

      const unpinBtn = await screen.findByText('explore.sidebar.action.unpin')
      await userEvent.click(unpinBtn)

      expect(handleUnpinConversation).toHaveBeenCalledWith('conv-1')
    })

    it('should handle rename cancellation', async () => {
      const mockConv = { id: 'conv-1', name: 'My Chat' } as ConversationItem
      setup({
        currentConversationId: 'conv-1',
        currentConversationItem: mockConv,
      })

      await userEvent.click(screen.getByText('My Chat'))

      const renameMenuBtn = await screen.findByText('explore.sidebar.action.rename')
      await userEvent.click(renameMenuBtn)

      const cancelBtn = await screen.findByText('common.operation.cancel')
      await userEvent.click(cancelBtn)

      await waitFor(() => {
        expect(screen.queryByText('common.chat.renameConversation')).not.toBeInTheDocument()
      })
    })

    it('should handle rename success flow', async () => {
      const handleRenameConversation = vi.fn()
      const mockConv = { id: 'conv-1', name: 'My Chat' } as ConversationItem
      setup({
        currentConversationId: 'conv-1',
        currentConversationItem: mockConv,
        handleRenameConversation,
      })

      await userEvent.click(screen.getByText('My Chat'))

      const renameMenuBtn = await screen.findByText('explore.sidebar.action.rename')
      await userEvent.click(renameMenuBtn)

      expect(await screen.findByText('common.chat.renameConversation')).toBeInTheDocument()

      const input = screen.getByDisplayValue('My Chat')
      await userEvent.clear(input)
      await userEvent.type(input, 'New Name')

      const saveBtn = await screen.findByText('common.operation.save')
      await userEvent.click(saveBtn)

      expect(handleRenameConversation).toHaveBeenCalledWith(
        'conv-1',
        'New Name',
        expect.any(Object),
      )

      const successCallback = handleRenameConversation.mock.calls[0]![2].onSuccess
      await act(async () => {
        successCallback()
      })

      await waitFor(() => {
        expect(screen.queryByText('common.chat.renameConversation')).not.toBeInTheDocument()
      })
    })

    it('should handle delete flow', async () => {
      const handleDeleteConversation = vi.fn()
      const mockConv = { id: 'conv-1', name: 'My Chat' } as ConversationItem
      setup({
        currentConversationId: 'conv-1',
        currentConversationItem: mockConv,
        handleDeleteConversation,
      })

      await userEvent.click(screen.getByText('My Chat'))

      const deleteMenuBtn = await screen.findByText('explore.sidebar.action.delete')
      await userEvent.click(deleteMenuBtn)

      expect(handleDeleteConversation).not.toHaveBeenCalled()
      expect(await screen.findByText('share.chat.deleteConversation.title')).toBeInTheDocument()

      const confirmBtn = await screen.findByText('common.operation.confirm')
      await userEvent.click(confirmBtn)

      expect(handleDeleteConversation).toHaveBeenCalledWith('conv-1', expect.any(Object))

      const successCallback = handleDeleteConversation.mock.calls[0]![1].onSuccess
      await act(async () => {
        successCallback()
      })

      await waitFor(() => {
        expect(screen.queryByText('share.chat.deleteConversation.title')).not.toBeInTheDocument()
      })
    })

    it('should handle delete cancellation', async () => {
      const mockConv = { id: 'conv-1', name: 'My Chat' } as ConversationItem
      setup({
        currentConversationId: 'conv-1',
        currentConversationItem: mockConv,
      })

      await userEvent.click(screen.getByText('My Chat'))

      const deleteMenuBtn = await screen.findByText('explore.sidebar.action.delete')
      await userEvent.click(deleteMenuBtn)

      const cancelBtn = await screen.findByText('common.operation.cancel')
      await userEvent.click(cancelBtn)

      await waitFor(() => {
        expect(screen.queryByText('share.chat.deleteConversation.title')).not.toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases', () => {
    it('should render app icon from URL when icon_url is provided', () => {
      setup({
        appData: {
          ...mockAppData,
          site: {
            ...mockAppData.site,
            icon_type: 'image',
            icon_url: 'https://example.com/icon.png',
          },
        },
      })
      const img = screen.getByAltText('app icon')
      expect(img).toHaveAttribute('src', 'https://example.com/icon.png')
    })

    it('should handle undefined appData gracefully (optional chaining)', () => {
      setup({ appData: null as unknown as AppData })
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0)
    })

    it('should handle missing name in conversation item', () => {
      const mockConv = { id: 'conv-1', name: '' } as ConversationItem
      const { container } = setup({
        currentConversationId: 'conv-1',
        currentConversationItem: mockConv,
      })
      // 会话名下拉 trigger 仍存在（名称为空时仅显示箭头）
      expect(container.querySelector('.i-ri-arrow-down-s-line')).toBeInTheDocument()
    })

    it('should not render the title dropdown when conversation item is missing despite an id', () => {
      setup({ currentConversationId: 'conv-1', currentConversationItem: undefined })
      expect(screen.queryByText('My Chat')).not.toBeInTheDocument()
    })

    it('should pass empty rename value when conversation name is undefined', async () => {
      const mockConv = { id: 'conv-1' } as ConversationItem
      const { container } = setup({
        currentConversationId: 'conv-1',
        currentConversationItem: mockConv,
      })

      const operationTrigger = container
        .querySelector('.i-ri-arrow-down-s-line')!
        .closest('button') as HTMLElement
      await userEvent.click(operationTrigger)
      await userEvent.click(await screen.findByText('explore.sidebar.action.rename'))

      const input = screen.getByRole('textbox') as HTMLInputElement
      expect(input.value).toBe('')
    })
  })
})
