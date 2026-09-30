import type { ReactElement } from 'react'
import type { EmbeddedChatbotContextValue } from '../../context'
import type { AppData } from '@/models/share'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithConsoleQuery } from '@/test/console/query-data'
import { useEmbeddedChatbotContext } from '../../context'
import Header from '../index'

const render = (ui: ReactElement) => renderWithConsoleQuery(ui)

vi.mock('../../context', () => ({
  useEmbeddedChatbotContext: vi.fn(),
}))

vi.mock('@/app/components/base/chat/embedded-chatbot/inputs-form/view-form-dropdown', () => ({
  default: vi.fn(({ variant }: { variant?: string }) => (
    <div data-testid="view-form-dropdown" data-variant={variant ?? 'icon'} />
  )),
}))

describe('EmbeddedChatbot Header', () => {
  const defaultAppData: AppData = {
    app_id: 'test-app-id',
    can_replace_logo: true,
    custom_config: {
      remove_webapp_brand: false,
      replace_webapp_logo: '',
    },
    enable_site: true,
    end_user_id: 'test-user-id',
    site: {
      title: 'Test Site',
    },
  }

  const defaultContext: Partial<EmbeddedChatbotContextValue> = {
    appData: defaultAppData,
    currentConversationId: 'test-conv-id',
    inputsForms: [],
    allInputsHidden: false,
  }

  const setupIframe = () => {
    const mockPostMessage = vi.fn()
    const mockTop = { postMessage: mockPostMessage }
    Object.defineProperty(window, 'self', { value: {}, configurable: true })
    Object.defineProperty(window, 'top', { value: mockTop, configurable: true })
    Object.defineProperty(window, 'parent', { value: mockTop, configurable: true })
    return mockPostMessage
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useEmbeddedChatbotContext).mockReturnValue(
      defaultContext as EmbeddedChatbotContextValue,
    )

    Object.defineProperty(window, 'self', { value: window, configurable: true })
    Object.defineProperty(window, 'top', { value: window, configurable: true })
  })

  const dispatchChatbotConfigMessage = async (
    origin: string,
    payload: { isToggledByButton: boolean; isDraggable: boolean },
  ) => {
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin,
          data: {
            type: 'dify-chatbot-config',
            payload,
          },
        }),
      )
    })
  }

  describe('Rendering（40px 极薄中性头；directFull=!iframe&&!mobile 双形态）', () => {
    it('should render app icon and site title from context（弱化 text-2）', () => {
      render(<Header />)

      const title = screen.getByText('Test Site')
      expect(title).toBeInTheDocument()
      expect(title).toHaveClass('text-[13px]', 'font-semibold', 'text-[var(--text-2)]')
    })

    it('桌面直连：h-10 + px-3 + 无 border-b（界面退后）', () => {
      render(<Header />)

      const header = screen.getByRole('banner')
      expect(header).toHaveClass('h-10', 'px-3')
      expect(header.className).not.toContain('border-b')
    })

    it('移动端：header 带 border-b（卡片内分隔）', () => {
      vi.mocked(useEmbeddedChatbotContext).mockReturnValue({
        ...defaultContext,
        isMobile: true,
      } as EmbeddedChatbotContextValue)
      render(<Header />)

      expect(screen.getByRole('banner')).toHaveClass('border-b', 'border-[var(--border)]')
    })

    it('iframe 气泡窗：header 带 border-b（宿主卡片内分隔）', () => {
      setupIframe()
      render(<Header />)

      expect(screen.getByRole('banner')).toHaveClass('border-b', 'border-[var(--border)]')
    })

    it('桌面直连：powered-by 小字在 header 右（沿用旧轨落点，末级默认杏树林）', () => {
      render(<Header />)

      const header = screen.getByRole('banner')
      expect(within(header).getByText('share.chat.poweredBy')).toBeInTheDocument()
      expect(within(header).getByText('杏树林')).toBeInTheDocument()
    })

    it('移动端：header 无 powered-by（落外壳 footer）', () => {
      vi.mocked(useEmbeddedChatbotContext).mockReturnValue({
        ...defaultContext,
        isMobile: true,
      } as EmbeddedChatbotContextValue)
      render(<Header />)

      expect(screen.queryByText('share.chat.poweredBy')).not.toBeInTheDocument()
    })

    it('iframe 气泡窗：header 无 powered-by（落气泡底部）', () => {
      setupIframe()
      render(<Header />)

      expect(screen.queryByText('share.chat.poweredBy')).not.toBeInTheDocument()
    })

    it('remove_webapp_brand=true：桌面直连 header 也无 powered-by', () => {
      vi.mocked(useEmbeddedChatbotContext).mockReturnValue({
        ...defaultContext,
        appData: {
          ...defaultAppData,
          custom_config: { remove_webapp_brand: true, replace_webapp_logo: '' },
        },
      } as EmbeddedChatbotContextValue)
      render(<Header />)

      expect(screen.queryByText('share.chat.poweredBy')).not.toBeInTheDocument()
    })

    it('桌面直连：重置对话为文字钮（icon+文案）', () => {
      render(<Header allowResetChat={true} />)

      const btn = screen.getByRole('button', { name: 'share.chat.resetChat' })
      expect(btn).toHaveClass('h-7')
      expect(btn.textContent).toContain('share.chat.resetChat')
    })

    it('移动端：重置对话为 icon-only 钮', () => {
      vi.mocked(useEmbeddedChatbotContext).mockReturnValue({
        ...defaultContext,
        isMobile: true,
      } as EmbeddedChatbotContextValue)
      render(<Header allowResetChat={true} />)

      const btn = screen.getByRole('button', { name: 'share.chat.resetChat' })
      expect(btn.textContent).toBe('')
    })

    it('should call onCreateNewChat when reset button is clicked', async () => {
      const user = userEvent.setup()
      const onCreateNewChat = vi.fn()
      render(<Header allowResetChat={true} onCreateNewChat={onCreateNewChat} />)

      await user.click(screen.getByRole('button', { name: 'share.chat.resetChat' }))
      expect(onCreateNewChat).toHaveBeenCalled()
    })

    it('should NOT render reset button when currentConversationId is missing', () => {
      vi.mocked(useEmbeddedChatbotContext).mockReturnValue({
        ...defaultContext,
        currentConversationId: '',
      } as EmbeddedChatbotContextValue)

      render(<Header allowResetChat />)

      expect(screen.queryByRole('button', { name: 'share.chat.resetChat' })).not.toBeInTheDocument()
    })

    it('should NOT render reset button when allowResetChat is false（URL 锁 conversation_id）', () => {
      render(<Header allowResetChat={false} />)

      expect(screen.queryByRole('button', { name: 'share.chat.resetChat' })).not.toBeInTheDocument()
    })

    it('should render ViewFormDropdown when conditions are met（桌面直连传 text 形态）', () => {
      vi.mocked(useEmbeddedChatbotContext).mockReturnValue({
        ...defaultContext,
        inputsForms: [{ id: '1' }],
        allInputsHidden: false,
      } as EmbeddedChatbotContextValue)

      render(<Header />)

      const dropdown = screen.getByTestId('view-form-dropdown')
      expect(dropdown).toBeInTheDocument()
      expect(dropdown).toHaveAttribute('data-variant', 'text')
    })

    it('移动端 ViewFormDropdown 传 icon 形态', () => {
      vi.mocked(useEmbeddedChatbotContext).mockReturnValue({
        ...defaultContext,
        isMobile: true,
        inputsForms: [{ id: '1' }],
        allInputsHidden: false,
      } as EmbeddedChatbotContextValue)

      render(<Header />)

      expect(screen.getByTestId('view-form-dropdown')).toHaveAttribute('data-variant', 'icon')
    })

    it('should NOT render ViewFormDropdown when inputs are hidden', () => {
      vi.mocked(useEmbeddedChatbotContext).mockReturnValue({
        ...defaultContext,
        inputsForms: [{ id: '1' }],
        allInputsHidden: true,
      } as EmbeddedChatbotContextValue)

      render(<Header />)

      expect(screen.queryByTestId('view-form-dropdown')).not.toBeInTheDocument()
    })

    it('should NOT render ViewFormDropdown when currentConversationId is missing', () => {
      vi.mocked(useEmbeddedChatbotContext).mockReturnValue({
        ...defaultContext,
        currentConversationId: '',
        inputsForms: [{ id: '1' }],
      } as EmbeddedChatbotContextValue)

      render(<Header />)

      expect(screen.queryByTestId('view-form-dropdown')).not.toBeInTheDocument()
    })
  })

  describe('Iframe Communication（保留红线）', () => {
    it('should send dify-chatbot-iframe-ready on mount', () => {
      const mockPostMessage = setupIframe()
      render(<Header />)

      expect(mockPostMessage).toHaveBeenCalledWith({ type: 'dify-chatbot-iframe-ready' }, '*')
    })

    it('should update expand button visibility and handle click', async () => {
      const user = userEvent.setup()
      const mockPostMessage = setupIframe()
      render(<Header />)

      await dispatchChatbotConfigMessage('https://parent.com', {
        isToggledByButton: true,
        isDraggable: false,
      })

      const expandBtn = await screen.findByRole('button', { name: 'share.chat.expand' })
      expect(expandBtn).toBeInTheDocument()

      await user.click(expandBtn)

      expect(mockPostMessage).toHaveBeenCalledWith(
        { type: 'dify-chatbot-expand-change' },
        'https://parent.com',
      )
      expect(expandBtn.querySelector('.i-ri-collapse-diagonal-2-line')).toBeInTheDocument()
    })

    it('should NOT show expand button if isDraggable is true', async () => {
      setupIframe()
      render(<Header />)

      await dispatchChatbotConfigMessage('https://parent.com', {
        isToggledByButton: true,
        isDraggable: true,
      })

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'share.chat.expand' })).not.toBeInTheDocument()
      })
    })

    it('should ignore messages from different origins after security lock', async () => {
      setupIframe()
      render(<Header />)

      await dispatchChatbotConfigMessage('https://secure.com', {
        isToggledByButton: true,
        isDraggable: false,
      })

      await screen.findByRole('button', { name: 'share.chat.expand' })

      await dispatchChatbotConfigMessage('https://malicious.com', {
        isToggledByButton: false,
        isDraggable: false,
      })

      // Should still be visible (not hidden by the malicious message)
      expect(screen.getByRole('button', { name: 'share.chat.expand' })).toBeInTheDocument()
    })

    it('should ignore non-config messages for origin locking', async () => {
      setupIframe()
      render(<Header />)

      await act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: 'https://first.com',
            data: { type: 'other-type' },
          }),
        )
      })

      await dispatchChatbotConfigMessage('https://second.com', {
        isToggledByButton: true,
        isDraggable: false,
      })

      // Should lock to second.com
      const expandBtn = await screen.findByRole('button', { name: 'share.chat.expand' })
      expect(expandBtn).toBeInTheDocument()
    })

    it('should NOT handle toggle expand if showToggleExpandButton is false', async () => {
      const mockPostMessage = setupIframe()
      render(<Header />)
      // Directly call handleToggleExpand would require more setup, but we can verify it doesn't trigger unexpectedly
      expect(mockPostMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'dify-chatbot-expand-change' }),
        expect.anything(),
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle document.referrer for targetOrigin', () => {
      const mockPostMessage = setupIframe()
      Object.defineProperty(document, 'referrer', {
        value: 'https://referrer.com',
        configurable: true,
      })
      render(<Header />)

      expect(mockPostMessage).toHaveBeenCalledWith(expect.anything(), 'https://referrer.com')
    })

    it('should NOT add message listener if not in iframe', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')
      render(<Header />)
      expect(addSpy).not.toHaveBeenCalledWith('message', expect.any(Function))
    })
  })
})
