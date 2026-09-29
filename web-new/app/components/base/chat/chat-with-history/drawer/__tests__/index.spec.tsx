import type { ChatWithHistoryContextValue } from '../../context'
import type { ConversationItem } from '@/models/share'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccessMode } from '@/models/access-control'
import { useChatWithHistoryContext } from '../../context'
import ConversationDrawer from '../index'

const { replaceMock, setThemeMock, webAppLogoutMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  setThemeMock: vi.fn(),
  webAppLogoutMock: vi.fn(() => Promise.resolve()),
}))

// Mock List to allow us to trigger operations / selection
vi.mock('../../sidebar/list', () => ({
  default: ({
    list,
    onOperate,
    onChangeConversation,
    title,
    isPin,
  }: {
    list: ConversationItem[]
    onOperate: (type: string, item: ConversationItem) => void
    onChangeConversation: (conversationId: string) => void
    title?: string
    isPin?: boolean
  }) => (
    <div data-testid={isPin ? 'pinned-list' : 'conversation-list'}>
      {title && <div data-testid="list-title">{title}</div>}
      {list.map((item) => (
        <div key={item.id} data-testid={`list-item-${item.id}`}>
          <div>{item.name}</div>
          <button data-testid={`select-${item.id}`} onClick={() => onChangeConversation(item.id)}>
            Select
          </button>
          <button data-testid={`pin-${item.id}`} onClick={() => onOperate('pin', item)}>
            Pin
          </button>
          <button data-testid={`unpin-${item.id}`} onClick={() => onOperate('unpin', item)}>
            Unpin
          </button>
          <button data-testid={`delete-${item.id}`} onClick={() => onOperate('delete', item)}>
            Delete
          </button>
          <button data-testid={`rename-${item.id}`} onClick={() => onOperate('rename', item)}>
            Rename
          </button>
        </div>
      ))}
    </div>
  ),
}))

// Mock context hook
vi.mock('../../context', () => ({
  useChatWithHistoryContext: vi.fn(),
}))

// Mock next-themes (footer theme segment)
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: setThemeMock }),
}))

// Mock next/navigation (footer logout redirect)
vi.mock('@/next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
  usePathname: () => '/chat/abc',
}))

// Mock logout service (footer logout)
vi.mock('@/service/webapp-auth', () => ({
  webAppLogout: webAppLogoutMock,
}))
vi.mock('@/service/webapp-address', () => ({
  resolveWebAppAddress: () => ({ kind: 'default', code: 'abc' }),
}))

const conversation = (id: string, name: string, created_at?: number | null): ConversationItem => ({
  id,
  name,
  inputs: {},
  introduction: '',
  created_at: created_at ?? null,
})

const DAY_MS = 24 * 60 * 60 * 1000
const nowSec = () => Math.floor(Date.now() / 1000)

describe('ConversationDrawer', () => {
  const mockContextValue = {
    isInstalledApp: false,
    appData: {
      site: {
        title: 'Test App',
        icon_type: 'image',
        icon: 'icon-url',
        icon_background: '#fff',
        icon_url: 'http://example.com/icon.png',
      },
      custom_config: {},
    },
    handleNewConversation: vi.fn(),
    pinnedConversationList: [],
    conversationList: [conversation('1', 'Conv 1')],
    currentConversationId: '0',
    handleChangeConversation: vi.fn(),
    handlePinConversation: vi.fn(),
    handleUnpinConversation: vi.fn(),
    conversationRenaming: false,
    handleRenameConversation: vi.fn(),
    handleDeleteConversation: vi.fn(),
    isResponding: false,
  } as unknown as ChatWithHistoryContextValue

  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useChatWithHistoryContext).mockReturnValue(mockContextValue)
  })

  describe('Rendering', () => {
    it('should render dialog with conversation history label', () => {
      render(<ConversationDrawer open onClose={onClose} />)
      expect(
        screen.getByRole('dialog', { name: 'share.chat.conversationHistory' }),
      ).toBeInTheDocument()
    })

    it('should render search input and new chat button', () => {
      render(<ConversationDrawer open onClose={onClose} />)
      expect(screen.getByPlaceholderText('share.chat.searchConversations')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'share.chat.newChat' })).toBeInTheDocument()
    })

    it('should disable new chat button when responding', () => {
      vi.mocked(useChatWithHistoryContext).mockReturnValue({
        ...mockContextValue,
        isResponding: true,
      } as unknown as ChatWithHistoryContextValue)

      render(<ConversationDrawer open onClose={onClose} />)
      expect(screen.getByRole('button', { name: 'share.chat.newChat' })).toBeDisabled()
    })

    it('should translate drawer off-screen when closed', () => {
      render(<ConversationDrawer open={false} onClose={onClose} />)
      const drawer = screen.getByRole('dialog', { name: 'share.chat.conversationHistory' })
      expect(drawer.className).toContain('-translate-x-full')
    })

    it('should translate drawer on-screen when open', () => {
      render(<ConversationDrawer open onClose={onClose} />)
      const drawer = screen.getByRole('dialog', { name: 'share.chat.conversationHistory' })
      expect(drawer.className).toContain('translate-x-0')
    })
  })

  describe('Width per breakpoint (Task 8：桌面 300px / 移动端 85%，随 context isMobile)', () => {
    it('should use 300px width with right border on desktop', () => {
      render(<ConversationDrawer open onClose={onClose} />)
      const drawer = screen.getByRole('dialog', { name: 'share.chat.conversationHistory' })
      expect(drawer.className).toContain('w-[300px]')
      expect(drawer.className).not.toContain('w-[85%]')
      expect(drawer.className).toContain('border-r')
    })

    it('should use 85% width without right border on mobile（mockup：.phone .drawer 85% / border-right:0）', () => {
      vi.mocked(useChatWithHistoryContext).mockReturnValue({
        ...mockContextValue,
        isMobile: true,
      } as unknown as ChatWithHistoryContextValue)

      render(<ConversationDrawer open onClose={onClose} />)
      const drawer = screen.getByRole('dialog', { name: 'share.chat.conversationHistory' })
      expect(drawer.className).toContain('w-[85%]')
      expect(drawer.className).not.toContain('w-[300px]')
      expect(drawer.className).not.toContain('border-r')
    })
  })

  describe('Close interactions', () => {
    it('should call onClose when mask is clicked', async () => {
      const user = userEvent.setup()
      const { container } = render(<ConversationDrawer open onClose={onClose} />)
      await user.click(container.querySelector('[data-testid="drawer-mask"]') as HTMLElement)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when Escape is pressed while open', async () => {
      const user = userEvent.setup()
      render(<ConversationDrawer open onClose={onClose} />)
      await user.keyboard('{Escape}')
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should not call onClose when Escape is pressed while closed', async () => {
      const user = userEvent.setup()
      render(<ConversationDrawer open={false} onClose={onClose} />)
      await user.keyboard('{Escape}')
      expect(onClose).not.toHaveBeenCalled()
    })

    it('should leave drawer open when Escape is consumed by the rename modal', async () => {
      const user = userEvent.setup()
      render(<ConversationDrawer open onClose={onClose} />)

      await user.click(screen.getByTestId('rename-1'))
      expect(screen.getByText('common.chat.renameConversation')).toBeInTheDocument()

      await user.keyboard('{Escape}')
      expect(onClose).not.toHaveBeenCalled()
      await waitFor(() => {
        expect(screen.queryByText('common.chat.renameConversation')).not.toBeInTheDocument()
      })
    })
  })

  describe('Conversation selection', () => {
    it('should change conversation and auto-close when an item is selected', async () => {
      const user = userEvent.setup()
      const handleChangeConversation = vi.fn()
      vi.mocked(useChatWithHistoryContext).mockReturnValue({
        ...mockContextValue,
        handleChangeConversation,
      } as unknown as ChatWithHistoryContextValue)

      render(<ConversationDrawer open onClose={onClose} />)
      await user.click(screen.getByTestId('select-1'))

      expect(handleChangeConversation).toHaveBeenCalledWith('1')
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should start new conversation and auto-close when new chat is clicked', async () => {
      const user = userEvent.setup()
      const handleNewConversation = vi.fn()
      vi.mocked(useChatWithHistoryContext).mockReturnValue({
        ...mockContextValue,
        handleNewConversation,
      } as unknown as ChatWithHistoryContextValue)

      render(<ConversationDrawer open onClose={onClose} />)
      await user.click(screen.getByRole('button', { name: 'share.chat.newChat' }))

      expect(handleNewConversation).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Search filtering (D1)', () => {
    it('should filter conversations by name keyword', async () => {
      const user = userEvent.setup()
      vi.mocked(useChatWithHistoryContext).mockReturnValue({
        ...mockContextValue,
        pinnedConversationList: [conversation('p1', 'Pinned Alpha')],
        conversationList: [conversation('1', 'Alpha topic'), conversation('2', 'Beta topic')],
      } as unknown as ChatWithHistoryContextValue)

      render(<ConversationDrawer open onClose={onClose} />)
      await user.type(screen.getByPlaceholderText('share.chat.searchConversations'), 'Alpha')

      expect(screen.getByText('Alpha topic')).toBeInTheDocument()
      expect(screen.queryByText('Beta topic')).not.toBeInTheDocument()
      expect(screen.getByText('Pinned Alpha')).toBeInTheDocument()
    })

    it('should restore full list when keyword is cleared', async () => {
      const user = userEvent.setup()
      vi.mocked(useChatWithHistoryContext).mockReturnValue({
        ...mockContextValue,
        conversationList: [conversation('1', 'Alpha topic'), conversation('2', 'Beta topic')],
      } as unknown as ChatWithHistoryContextValue)

      render(<ConversationDrawer open onClose={onClose} />)
      const input = screen.getByPlaceholderText('share.chat.searchConversations')
      await user.type(input, 'Alpha')
      expect(screen.queryByText('Beta topic')).not.toBeInTheDocument()

      await user.clear(input)
      expect(screen.getByText('Alpha topic')).toBeInTheDocument()
      expect(screen.getByText('Beta topic')).toBeInTheDocument()
    })
  })

  describe('Time grouping (D2)', () => {
    it('should group unpinned conversations into today/yesterday/earlier', () => {
      vi.mocked(useChatWithHistoryContext).mockReturnValue({
        ...mockContextValue,
        pinnedConversationList: [conversation('p1', 'Pinned One')],
        conversationList: [
          conversation('t1', 'Today Conv', nowSec()),
          conversation('y1', 'Yesterday Conv', Math.floor((Date.now() - DAY_MS) / 1000)),
          conversation('e1', 'Earlier Conv', Math.floor((Date.now() - 7 * DAY_MS) / 1000)),
        ],
      } as unknown as ChatWithHistoryContextValue)

      render(<ConversationDrawer open onClose={onClose} />)
      expect(screen.getByText('share.chat.pinnedTitle')).toBeInTheDocument()
      expect(screen.getByText('share.chat.groupToday')).toBeInTheDocument()
      expect(screen.getByText('share.chat.groupYesterday')).toBeInTheDocument()
      expect(screen.getByText('share.chat.groupEarlier')).toBeInTheDocument()
      expect(screen.getByText('Today Conv')).toBeInTheDocument()
      expect(screen.getByText('Yesterday Conv')).toBeInTheDocument()
      expect(screen.getByText('Earlier Conv')).toBeInTheDocument()
    })

    it('should only render non-empty groups', () => {
      vi.mocked(useChatWithHistoryContext).mockReturnValue({
        ...mockContextValue,
        pinnedConversationList: [],
        conversationList: [conversation('t1', 'Today Conv', nowSec())],
      } as unknown as ChatWithHistoryContextValue)

      render(<ConversationDrawer open onClose={onClose} />)
      expect(screen.getByText('share.chat.groupToday')).toBeInTheDocument()
      expect(screen.queryByText('share.chat.groupYesterday')).not.toBeInTheDocument()
      expect(screen.queryByText('share.chat.groupEarlier')).not.toBeInTheDocument()
      expect(screen.queryByTestId('pinned-list')).not.toBeInTheDocument()
    })
  })

  describe('Pin/Unpin operations', () => {
    it('should call handlePinConversation / handleUnpinConversation', async () => {
      const user = userEvent.setup()
      const handlePinConversation = vi.fn()
      const handleUnpinConversation = vi.fn()
      vi.mocked(useChatWithHistoryContext).mockReturnValue({
        ...mockContextValue,
        handlePinConversation,
        handleUnpinConversation,
      } as unknown as ChatWithHistoryContextValue)

      render(<ConversationDrawer open onClose={onClose} />)
      await user.click(screen.getByTestId('pin-1'))
      expect(handlePinConversation).toHaveBeenCalledWith('1')

      await user.click(screen.getByTestId('unpin-1'))
      expect(handleUnpinConversation).toHaveBeenCalledWith('1')
    })
  })

  describe('Delete confirmation', () => {
    it('should show delete confirmation when delete operation is triggered', async () => {
      const user = userEvent.setup()
      render(<ConversationDrawer open onClose={onClose} />)

      await user.click(screen.getByTestId('delete-1'))
      expect(screen.getByText('share.chat.deleteConversation.title')).toBeInTheDocument()
    })

    it('should call handleDeleteConversation when confirm is clicked', async () => {
      const user = userEvent.setup()
      const handleDeleteConversation = vi.fn()
      vi.mocked(useChatWithHistoryContext).mockReturnValue({
        ...mockContextValue,
        handleDeleteConversation,
      } as unknown as ChatWithHistoryContextValue)

      render(<ConversationDrawer open onClose={onClose} />)
      await user.click(screen.getByTestId('delete-1'))
      await user.click(screen.getByRole('button', { name: 'common.operation.confirm' }))

      expect(handleDeleteConversation).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      )
    })

    it('should close delete confirmation when cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<ConversationDrawer open onClose={onClose} />)

      await user.click(screen.getByTestId('delete-1'))
      expect(screen.getByText('share.chat.deleteConversation.title')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'common.operation.cancel' }))
      await waitFor(() => {
        expect(screen.queryByText('share.chat.deleteConversation.title')).not.toBeInTheDocument()
      })
    })
  })

  describe('Rename modal', () => {
    it('should show rename modal when rename operation is triggered', async () => {
      const user = userEvent.setup()
      render(<ConversationDrawer open onClose={onClose} />)

      await user.click(screen.getByTestId('rename-1'))
      expect(screen.getByText('common.chat.renameConversation')).toBeInTheDocument()
    })

    it('should call handleRenameConversation with the new name', async () => {
      const user = userEvent.setup()
      const handleRenameConversation = vi.fn()
      vi.mocked(useChatWithHistoryContext).mockReturnValue({
        ...mockContextValue,
        handleRenameConversation,
      } as unknown as ChatWithHistoryContextValue)

      render(<ConversationDrawer open onClose={onClose} />)
      await user.click(screen.getByTestId('rename-1'))

      const input = screen.getByDisplayValue('Conv 1')
      await user.clear(input)
      await user.type(input, 'New Name')
      await user.click(screen.getByRole('button', { name: 'common.operation.save' }))

      expect(handleRenameConversation).toHaveBeenCalledWith(
        '1',
        'New Name',
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      )
    })

    it('should close rename modal when cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<ConversationDrawer open onClose={onClose} />)

      await user.click(screen.getByTestId('rename-1'))
      expect(screen.getByText('common.chat.renameConversation')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'common.operation.cancel' }))
      await waitFor(() => {
        expect(screen.queryByText('common.chat.renameConversation')).not.toBeInTheDocument()
      })
    })
  })

  describe('Footer menu (D11)', () => {
    it('should render theme segment and switch theme', async () => {
      const user = userEvent.setup()
      render(<ConversationDrawer open onClose={onClose} />)

      await user.click(screen.getByRole('button', { name: 'common.theme.dark' }))
      expect(setThemeMock).toHaveBeenCalledWith('dark')

      await user.click(screen.getByRole('button', { name: 'common.theme.auto' }))
      expect(setThemeMock).toHaveBeenCalledWith('system')
    })

    it('should render privacy policy link only when site configures it', () => {
      const { unmount } = render(<ConversationDrawer open onClose={onClose} />)
      expect(
        screen.queryByRole('link', { name: /share\.chat\.privacyPolicyMiddle/ }),
      ).not.toBeInTheDocument()
      unmount()

      vi.mocked(useChatWithHistoryContext).mockReturnValue({
        ...mockContextValue,
        appData: {
          ...mockContextValue.appData,
          site: {
            ...(mockContextValue.appData as { site: object }).site,
            privacy_policy: 'https://example.com/privacy',
          },
        },
      } as unknown as ChatWithHistoryContextValue)
      render(<ConversationDrawer open onClose={onClose} />)

      const link = screen.getByRole('link', { name: /share\.chat\.privacyPolicyMiddle/ })
      expect(link).toHaveAttribute('href', 'https://example.com/privacy')
      expect(link).toHaveAttribute('target', '_blank')
    })

    it('should open info modal when about is clicked', async () => {
      const user = userEvent.setup()
      render(<ConversationDrawer open onClose={onClose} />)

      await user.click(screen.getByRole('button', { name: 'common.userProfile.about' }))
      expect(await screen.findByText('Test App')).toBeInTheDocument()
    })

    it('should show logout for non-public access mode and hide when installed app', () => {
      const { unmount } = render(<ConversationDrawer open onClose={onClose} />)
      expect(screen.getByRole('button', { name: 'common.userProfile.logout' })).toBeInTheDocument()
      unmount()

      vi.mocked(useChatWithHistoryContext).mockReturnValue({
        ...mockContextValue,
        isInstalledApp: true,
      } as unknown as ChatWithHistoryContextValue)
      render(<ConversationDrawer open onClose={onClose} />)
      expect(
        screen.queryByRole('button', { name: 'common.userProfile.logout' }),
      ).not.toBeInTheDocument()
    })

    it('should hide logout in public access mode', async () => {
      const { useWebAppStore } = await import('@/context/web-app-context')
      useWebAppStore.setState({ webAppAccessMode: AccessMode.PUBLIC })

      render(<ConversationDrawer open onClose={onClose} />)
      expect(
        screen.queryByRole('button', { name: 'common.userProfile.logout' }),
      ).not.toBeInTheDocument()
    })

    it('should logout and redirect to signin when logout is clicked', async () => {
      const user = userEvent.setup()
      render(<ConversationDrawer open onClose={onClose} />)

      await user.click(screen.getByRole('button', { name: 'common.userProfile.logout' }))
      expect(webAppLogoutMock).toHaveBeenCalledWith({ kind: 'default', code: 'abc' })
      await waitFor(() => {
        expect(replaceMock).toHaveBeenCalledWith('/webapp-signin?redirect_url=/chat/abc')
      })
    })
  })

  describe('Brand row', () => {
    it('should show powered-by with default brand name', () => {
      render(<ConversationDrawer open onClose={onClose} />)
      expect(screen.getByText('share.chat.poweredBy')).toBeInTheDocument()
      expect(screen.getByText('杏树林')).toBeInTheDocument()
    })

    it('should hide brand row when remove_webapp_brand is true', () => {
      vi.mocked(useChatWithHistoryContext).mockReturnValue({
        ...mockContextValue,
        appData: {
          ...mockContextValue.appData,
          custom_config: { remove_webapp_brand: true },
        },
      } as unknown as ChatWithHistoryContextValue)

      render(<ConversationDrawer open onClose={onClose} />)
      expect(screen.queryByText('share.chat.poweredBy')).not.toBeInTheDocument()
    })

    it('should show footer_text from ui_config when configured', () => {
      vi.mocked(useChatWithHistoryContext).mockReturnValue({
        ...mockContextValue,
        appData: {
          ...mockContextValue.appData,
          site: {
            ...(mockContextValue.appData as { site: object }).site,
            ui_config: { brand: { footer_text: 'ACME Corp' } },
          },
        },
      } as unknown as ChatWithHistoryContextValue)

      render(<ConversationDrawer open onClose={onClose} />)
      expect(screen.getByText('ACME Corp')).toBeInTheDocument()
      expect(screen.queryByText('杏树林')).not.toBeInTheDocument()
    })

    it('should show custom logo image when replace_webapp_logo is set', () => {
      vi.mocked(useChatWithHistoryContext).mockReturnValue({
        ...mockContextValue,
        appData: {
          ...mockContextValue.appData,
          custom_config: { replace_webapp_logo: 'http://example.com/custom-logo.png' },
        },
      } as unknown as ChatWithHistoryContextValue)

      render(<ConversationDrawer open onClose={onClose} />)
      const logo = screen.getByRole('img', { name: 'logo' })
      expect(logo).toHaveAttribute('src', 'http://example.com/custom-logo.png')
    })
  })

  describe('Closed-state tab order (T3 修正：关态 inert)', () => {
    it('should set inert when closed and remove it when open', () => {
      const { rerender } = render(<ConversationDrawer open={false} onClose={onClose} />)
      const drawer = screen.getByRole('dialog', { name: 'share.chat.conversationHistory' })
      expect(drawer).toHaveAttribute('inert')

      rerender(<ConversationDrawer open onClose={onClose} />)
      expect(drawer).not.toHaveAttribute('inert')

      rerender(<ConversationDrawer open={false} onClose={onClose} />)
      expect(drawer).toHaveAttribute('inert')
    })
  })

  describe('Search focus on open (T3 修正：open false→true 显式落焦)', () => {
    it('should focus the search input when mounted open', () => {
      render(<ConversationDrawer open onClose={onClose} />)
      expect(screen.getByPlaceholderText('share.chat.searchConversations')).toHaveFocus()
    })

    it('should focus the search input when open flips false → true', () => {
      const { rerender } = render(<ConversationDrawer open={false} onClose={onClose} />)
      const input = screen.getByPlaceholderText('share.chat.searchConversations')
      expect(input).not.toHaveFocus()

      rerender(<ConversationDrawer open onClose={onClose} />)
      expect(input).toHaveFocus()
    })

    it('should not focus the search input while staying closed', () => {
      const { rerender } = render(<ConversationDrawer open={false} onClose={onClose} />)
      rerender(<ConversationDrawer open={false} onClose={onClose} />)
      expect(screen.getByPlaceholderText('share.chat.searchConversations')).not.toHaveFocus()
    })
  })
})
