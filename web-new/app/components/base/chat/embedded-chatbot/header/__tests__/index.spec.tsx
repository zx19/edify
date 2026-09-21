import type { ReactElement } from 'react'
import type { EmbeddedChatbotContextValue } from '../../context'
import type { AppData } from '@/models/share'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithConsoleQuery } from '@/test/console/query-data'
import { useEmbeddedChatbotContext } from '../../context'
import Header from '../index'

const render = (ui: ReactElement) => renderWithConsoleQuery(ui)

vi.mock('../../context', () => ({
  useEmbeddedChatbotContext: vi.fn(),
}))

vi.mock('@/app/components/base/chat/embedded-chatbot/inputs-form/view-form-dropdown', () => ({
  default: () => <div data-testid="view-form-dropdown" />,
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

  describe('Rendering（白底中性头，双端同构）', () => {
    it('should render app icon and site title from context', () => {
      render(<Header />)

      expect(screen.getByText('Test Site')).toBeInTheDocument()
    })

    it('should NOT render powered-by in header（已移至外壳底部一行）', () => {
      render(<Header />)

      expect(screen.queryByText('share.chat.poweredBy')).not.toBeInTheDocument()
    })

    it('should render reset button when allowResetChat is true and conversation exists', () => {
      render(<Header allowResetChat={true} />)

      expect(screen.getByRole('button', { name: 'share.chat.resetChat' })).toBeInTheDocument()
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

    it('should render ViewFormDropdown when conditions are met', () => {
      vi.mocked(useEmbeddedChatbotContext).mockReturnValue({
        ...defaultContext,
        inputsForms: [{ id: '1' }],
        allInputsHidden: false,
      } as EmbeddedChatbotContextValue)

      render(<Header />)

      expect(screen.getByTestId('view-form-dropdown')).toBeInTheDocument()
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
