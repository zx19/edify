import type { EnableType } from '../../../types'
import type { FileUpload } from '@/app/components/base/features/types'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Operation from '../operation'

vi.mock('@/app/components/base/file-uploader', () => ({
  FileUploaderInChatInput: ({ readonly }: { readonly?: boolean }) => (
    <div data-testid="file-uploader" data-readonly={readonly} />
  ),
}))

describe('Operation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render send button always', () => {
      render(<Operation onSend={vi.fn()} />)

      expect(screen.getByRole('button'))!.toBeInTheDocument()
    })

    it('should render file uploader when fileConfig.enabled is true', () => {
      const fileConfig: FileUpload = { enabled: true } as FileUpload

      render(<Operation onSend={vi.fn()} fileConfig={fileConfig} />)

      expect(screen.getByTestId('file-uploader'))!.toBeInTheDocument()
    })

    it('should not render file uploader when fileConfig is undefined', () => {
      render(<Operation onSend={vi.fn()} />)

      expect(screen.queryByTestId('file-uploader')).not.toBeInTheDocument()
    })

    it('should render voice input button when speech-to-text is enabled with a handler', () => {
      const speechConfig: EnableType = { enabled: true }

      render(
        <Operation onSend={vi.fn()} speechToTextConfig={speechConfig} onShowVoiceInput={vi.fn()} />,
      )

      expect(screen.getByRole('button', { name: 'common.voiceInput.start' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'common.operation.send' })).toBeInTheDocument()
    })

    it('should render file upload before voice input when both actions are enabled', () => {
      const fileConfig: FileUpload = { enabled: true } as FileUpload
      const speechConfig: EnableType = { enabled: true }

      render(
        <Operation
          onSend={vi.fn()}
          fileConfig={fileConfig}
          speechToTextConfig={speechConfig}
          onShowVoiceInput={vi.fn()}
        />,
      )

      const fileUploader = screen.getByTestId('file-uploader')
      const voiceButton = screen.getByRole('button', { name: 'common.voiceInput.start' })

      expect(
        fileUploader.compareDocumentPosition(voiceButton) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    })

    it('should not render voice input button when speechToTextConfig.enabled is false', () => {
      const speechConfig: EnableType = { enabled: false }

      render(<Operation onSend={vi.fn()} speechToTextConfig={speechConfig} />)

      expect(screen.getAllByRole('button')).toHaveLength(1)
    })
  })

  describe('Send Button Behavior', () => {
    it('should call onSend when clicked and not readonly', async () => {
      const user = userEvent.setup()
      const onSend = vi.fn()

      render(<Operation onSend={onSend} />)

      await user.click(screen.getByRole('button'))

      expect(onSend).toHaveBeenCalledTimes(1)
    })

    it('should not call onSend when readonly is true', async () => {
      const user = userEvent.setup()
      const onSend = vi.fn()

      render(<Operation onSend={onSend} readonly />)

      await user.click(screen.getByRole('button'))

      expect(onSend).not.toHaveBeenCalled()
    })
  })

  // D4：发送⇄停止同键位——响应中发送键变形 ■（aria-label 切停止语义、点击调 onStopResponding）
  describe('Send/Stop Dual State (D4)', () => {
    it('should morph the send button into a stop button while responding', async () => {
      const user = userEvent.setup()
      const onSend = vi.fn()
      const onStopResponding = vi.fn()

      render(<Operation onSend={onSend} isResponding onStopResponding={onStopResponding} />)

      const stopButton = screen.getByRole('button', {
        name: 'appDebug.operation.stopResponding',
      })
      expect(stopButton).toBeEnabled()
      expect(
        screen.queryByRole('button', { name: 'common.operation.send' }),
      ).not.toBeInTheDocument()

      await user.click(stopButton)

      expect(onStopResponding).toHaveBeenCalledTimes(1)
      expect(onSend).not.toHaveBeenCalled()
    })

    it('should keep the stop button enabled even when send is disabled (empty content)', () => {
      render(<Operation onSend={vi.fn()} disabled isResponding onStopResponding={vi.fn()} />)

      expect(
        screen.getByRole('button', { name: 'appDebug.operation.stopResponding' }),
      ).toBeEnabled()
    })

    it('should keep the stop button clickable when sendButtonLoading is set', async () => {
      const user = userEvent.setup()
      const onStopResponding = vi.fn()

      render(
        <Operation
          onSend={vi.fn()}
          sendButtonLoading
          isResponding
          onStopResponding={onStopResponding}
        />,
      )

      const stopButton = screen.getByRole('button', {
        name: 'appDebug.operation.stopResponding',
      })
      expect(stopButton).toBeEnabled()

      await user.click(stopButton)
      expect(onStopResponding).toHaveBeenCalledTimes(1)
    })

    it('should keep send semantics while responding when no stop handler is provided', async () => {
      const user = userEvent.setup()
      const onSend = vi.fn()

      render(<Operation onSend={onSend} isResponding />)

      const sendButton = screen.getByRole('button', { name: 'common.operation.send' })
      await user.click(sendButton)

      expect(onSend).toHaveBeenCalledTimes(1)
    })

    it('should not call the stop handler when readonly', async () => {
      const user = userEvent.setup()
      const onStopResponding = vi.fn()

      render(
        <Operation onSend={vi.fn()} readonly isResponding onStopResponding={onStopResponding} />,
      )

      const stopButton = screen.getByRole('button', {
        name: 'appDebug.operation.stopResponding',
      })
      expect(stopButton).toBeDisabled()

      await user.click(stopButton)

      expect(onStopResponding).not.toHaveBeenCalled()
    })

    it('should restore the send button when responding ends', () => {
      const { rerender } = render(
        <Operation onSend={vi.fn()} isResponding onStopResponding={vi.fn()} />,
      )
      expect(
        screen.getByRole('button', { name: 'appDebug.operation.stopResponding' }),
      ).toBeInTheDocument()

      rerender(<Operation onSend={vi.fn()} isResponding={false} onStopResponding={vi.fn()} />)

      expect(screen.getByRole('button', { name: 'common.operation.send' })).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'appDebug.operation.stopResponding' }),
      ).not.toBeInTheDocument()
    })
  })

  describe('Voice Input Button', () => {
    it('should call onShowVoiceInput when clicked', async () => {
      const user = userEvent.setup()
      const onShowVoiceInput = vi.fn()

      render(
        <Operation
          onSend={vi.fn()}
          speechToTextConfig={{ enabled: true }}
          onShowVoiceInput={onShowVoiceInput}
        />,
      )

      const voiceButton = screen.getByRole('button', { name: 'common.voiceInput.start' })

      await user.click(voiceButton!)

      expect(onShowVoiceInput).toHaveBeenCalledTimes(1)
    })

    it('should disable voice button when readonly is true', async () => {
      const user = userEvent.setup()
      const onShowVoiceInput = vi.fn()

      render(
        <Operation
          onSend={vi.fn()}
          speechToTextConfig={{ enabled: true }}
          onShowVoiceInput={onShowVoiceInput}
          readonly
        />,
      )

      const voiceButton = screen.getByRole('button', { name: 'common.voiceInput.start' })

      expect(voiceButton)!.toBeDisabled()

      await user.click(voiceButton!)

      expect(onShowVoiceInput).not.toHaveBeenCalled()
    })
  })
})
