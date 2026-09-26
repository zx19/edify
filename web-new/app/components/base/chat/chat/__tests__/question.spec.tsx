import type { Theme } from '../../embedded-chatbot/theme/theme'
import type { ChatConfig, ChatItem, OnRegenerate } from '../../types'
import type { FileEntity } from '@/app/components/base/file-uploader/types'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from '@xsl/lomva-ui/toast'
import copy from 'copy-to-clipboard'
import * as React from 'react'
import { ChatContextProvider } from '../context-provider'
import Question from '../question'

// Global Mocks
vi.mock('@react-aria/interactions', () => ({
  useFocusVisible: () => ({ isFocusVisible: false }),
}))
vi.mock('../content-switch', () => ({
  default: ({
    count,
    currentIndex,
    switchSibling,
    prevDisabled,
    nextDisabled,
  }: {
    count?: number
    currentIndex?: number
    switchSibling: (direction: 'prev' | 'next') => void
    prevDisabled: boolean
    nextDisabled: boolean
  }) => {
    if (!(count && count > 1 && currentIndex !== undefined)) return null

    return (
      <div data-testid="content-switch">
        <button
          type="button"
          aria-label="Previous"
          onClick={() => switchSibling('prev')}
          disabled={prevDisabled}
        >
          Previous
        </button>
        <button
          type="button"
          aria-label="Next"
          onClick={() => switchSibling('next')}
          disabled={nextDisabled}
        >
          Next
        </button>
      </div>
    )
  },
}))
vi.mock('copy-to-clipboard', () => ({ default: vi.fn() }))
vi.mock('@/app/components/base/markdown', () => ({
  Markdown: ({ content }: { content: string }) => <div className="markdown-body">{content}</div>,
}))

type RenderProps = {
  theme?: Theme | null
  questionIcon?: React.ReactNode
  enableEdit?: boolean
  switchSibling?: (siblingMessageId: string) => void
  hideAvatar?: boolean
  answerIcon?: React.ReactNode
}

const makeItem = (overrides: Partial<ChatItem> = {}): ChatItem =>
  ({
    id: 'q-1',
    content: 'This is the question content',
    message_files: [],
    siblingCount: 3,
    siblingIndex: 0,
    prevSibling: null,
    nextSibling: 'q-2',
    ...overrides,
  }) as unknown as ChatItem

const renderWithProvider = (
  item: ChatItem,
  onRegenerate: OnRegenerate = vi.fn() as unknown as OnRegenerate,
  props: RenderProps = {},
) => {
  return render(
    <ChatContextProvider
      config={{} as unknown as ChatConfig | undefined}
      isResponding={false}
      chatList={[]}
      showPromptLog={false}
      questionIcon={props.questionIcon}
      answerIcon={props.answerIcon}
      onSend={vi.fn()}
      onRegenerate={onRegenerate}
      onAnnotationEdited={vi.fn()}
      onAnnotationAdded={vi.fn()}
      onAnnotationRemoved={vi.fn()}
      disableFeedback={false}
      onFeedback={vi.fn()}
      getHumanInputNodeData={vi.fn()}
    >
      <Question
        item={item}
        theme={props.theme}
        questionIcon={props.questionIcon}
        enableEdit={props.enableEdit}
        switchSibling={props.switchSibling}
        hideAvatar={props.hideAvatar}
      />
    </ChatContextProvider>,
  )
}

describe('Question component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the question as a right-aligned soft capsule (mockup 类型1), with no avatar node', () => {
    const { container } = renderWithProvider(makeItem())

    const capsule = screen.getByTestId('question-content')
    expect(capsule).toHaveClass(
      'w-fit',
      'max-w-[75%]',
      'whitespace-pre-wrap',
      'rounded-[12px]',
      'bg-[var(--bg-soft)]',
      'px-3.5',
      'py-2.5',
      'text-[14px]',
      'leading-[1.65]',
      'text-[var(--text-1)]',
    )
    // 双层时代结束：不再有 var(--chat-bubble-user-*) 内联样式
    expect(capsule.getAttribute('style')).toBeNull()

    const markdown = container.querySelector('.markdown-body')
    expect(markdown).toBeInTheDocument()

    // D3 去头像：无头像节点（hideAvatar/questionIcon 契约暂留但不再渲染）
    expect(container.querySelector('.size-10')).toBeNull()
    expect(container.querySelector('.question-default-user-icon')).toBeNull()
  })

  it('should not render an avatar whether or not hideAvatar is set (D3)', () => {
    const { container } = renderWithProvider(makeItem(), vi.fn() as unknown as OnRegenerate, {
      hideAvatar: true,
    })
    expect(container.querySelector('.size-10')).toBeNull()
  })

  it('should call copy-to-clipboard and show a toast when copy action is clicked', async () => {
    const user = userEvent.setup()
    const toastSpy = vi.spyOn(toast, 'success').mockReturnValue('toast-success')

    renderWithProvider(makeItem())

    const copyBtn = screen.getByRole('button', { name: 'common.operation.copy' })
    await user.click(copyBtn)

    await waitFor(() => {
      expect(copy).toHaveBeenCalledWith('This is the question content')
      expect(toastSpy).toHaveBeenCalled()
    })
  })

  it('should not show edit action when enableEdit is false', () => {
    renderWithProvider(makeItem(), vi.fn() as unknown as OnRegenerate, { enableEdit: false })

    expect(screen.getByRole('button', { name: 'common.operation.copy' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'common.operation.edit' })).not.toBeInTheDocument()
  })

  it('should enter edit mode when edit action clicked, allow editing and call onRegenerate on resend', async () => {
    const user = userEvent.setup()
    const onRegenerate = vi.fn() as unknown as OnRegenerate

    const item = makeItem()
    renderWithProvider(item, onRegenerate)

    const editBtn = screen.getByRole('button', { name: 'common.operation.edit' })
    await user.click(editBtn)

    const textbox = await screen.findByRole('textbox')
    expect(textbox).toHaveValue('This is the question content')

    await user.clear(textbox)
    await user.type(textbox, 'Edited question')

    const resendBtn = screen.getByRole('button', { name: /operation.save/i })
    await user.click(resendBtn)

    await waitFor(() => {
      expect(onRegenerate).toHaveBeenCalledWith(item, { message: 'Edited question', files: [] })
    })
  })

  it('should cancel editing and revert to original markdown when cancel is clicked', async () => {
    const user = userEvent.setup()
    const { container } = renderWithProvider(makeItem())

    const editBtn = screen.getByRole('button', { name: 'common.operation.edit' })
    await user.click(editBtn)

    const textbox = await screen.findByRole('textbox')
    await user.clear(textbox)
    await user.type(textbox, 'Edited question')

    const cancelBtn = await screen.findByRole('button', { name: 'common.operation.cancel' })
    await user.click(cancelBtn)

    await waitFor(() => {
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      const md = container.querySelector('.markdown-body')
      expect(md).toBeInTheDocument()
    })
  })

  it('should confirm editing when Enter is pressed', async () => {
    const user = userEvent.setup()
    const onRegenerate = vi.fn() as unknown as OnRegenerate

    renderWithProvider(makeItem(), onRegenerate)

    await user.click(screen.getByRole('button', { name: 'common.operation.edit' }))
    const textbox = await screen.findByRole('textbox')

    await user.clear(textbox)
    await user.type(textbox, 'Edited with Enter')

    fireEvent.keyDown(textbox, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(onRegenerate).toHaveBeenCalledWith(makeItem(), {
        message: 'Edited with Enter',
        files: [],
      })
    })
  })

  it('should insert a new line when Shift+Enter is pressed', async () => {
    const user = userEvent.setup()
    const onRegenerate = vi.fn() as unknown as OnRegenerate

    renderWithProvider(makeItem(), onRegenerate)

    await user.click(screen.getByRole('button', { name: 'common.operation.edit' }))
    const textbox = await screen.findByRole('textbox')

    await user.clear(textbox)
    await user.type(textbox, 'Line 1')
    await user.type(textbox, '{Shift>}{Enter}{/Shift}')

    expect(textbox).toHaveValue('Line 1\n')
    expect(onRegenerate).not.toHaveBeenCalled()
  })

  it('should not confirm editing when Enter is pressed during IME composition', () => {
    const onRegenerate = vi.fn() as unknown as OnRegenerate

    renderWithProvider(makeItem(), onRegenerate)

    fireEvent.click(screen.getByRole('button', { name: 'common.operation.edit' }))
    const textbox = screen.getByRole('textbox')

    fireEvent.compositionStart(textbox)
    fireEvent.keyDown(textbox, { key: 'Enter', code: 'Enter' })

    expect(onRegenerate).not.toHaveBeenCalled()
    expect(textbox).toHaveValue('This is the question content')
  })

  it('should keep text unchanged and suppress Enter if a new composition starts before previous composition-end timer finishes', async () => {
    vi.useFakeTimers()

    try {
      const onRegenerate = vi.fn() as unknown as OnRegenerate
      renderWithProvider(makeItem(), onRegenerate)

      fireEvent.click(screen.getByRole('button', { name: 'common.operation.edit' }))
      const textbox = screen.getByRole('textbox')
      fireEvent.change(textbox, { target: { value: 'IME guard text' } })

      fireEvent.compositionStart(textbox)
      fireEvent.compositionEnd(textbox)
      fireEvent.compositionStart(textbox)

      vi.advanceTimersByTime(50)

      const blockedEnterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
        cancelable: true,
      })
      textbox.dispatchEvent(blockedEnterEvent)
      expect(onRegenerate).not.toHaveBeenCalled()
      expect(blockedEnterEvent.defaultPrevented).toBe(true)
      expect(textbox).toHaveValue('IME guard text')

      fireEvent.compositionEnd(textbox)
      vi.advanceTimersByTime(50)

      fireEvent.keyDown(textbox, { key: 'Enter', code: 'Enter' })
      expect(onRegenerate).toHaveBeenCalledWith(makeItem(), {
        message: 'IME guard text',
        files: [],
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('should switch siblings when prev/next buttons are clicked', async () => {
    const user = userEvent.setup()
    const switchSibling = vi.fn()
    const item = makeItem({ prevSibling: 'q-prev', nextSibling: 'q-next', siblingIndex: 1 })

    renderWithProvider(item, vi.fn() as unknown as OnRegenerate, { switchSibling })

    const prevBtn = screen.getByRole('button', { name: /previous/i })
    const nextBtn = screen.getByRole('button', { name: /next/i })

    await user.click(prevBtn)
    await user.click(nextBtn)

    expect(switchSibling).toHaveBeenCalledTimes(2)
    expect(switchSibling).toHaveBeenCalledWith('q-prev')
    expect(switchSibling).toHaveBeenCalledWith('q-next')
  })

  it('should render prev disabled when no prevSibling is provided', () => {
    const item = makeItem({
      prevSibling: undefined,
      nextSibling: 'q-next',
      siblingIndex: 0,
      siblingCount: 2,
    })
    renderWithProvider(item, vi.fn() as unknown as OnRegenerate)

    const prevBtn = screen.getByRole('button', { name: /previous/i })
    const nextBtn = screen.getByRole('button', { name: /next/i })

    expect(prevBtn).toBeDisabled()
    expect(nextBtn).not.toBeDisabled()
  })

  it('should render message files block when message_files provided (audio file branch covered)', () => {
    const files = [
      {
        name: 'audio1.mp3',
        url: 'https://example.com/audio1.mp3',
        type: 'audio/mpeg',
        previewUrl: 'https://example.com/audio1.mp3',
        size: 1234,
      } as unknown as FileEntity,
    ]

    renderWithProvider(makeItem({ message_files: files }))

    expect(screen.getByText(/audio1.mp3/i)).toBeInTheDocument()
  })

  it('should reveal the action row only on hover/focus (mockup .msg-ops)', () => {
    renderWithProvider(makeItem())

    expect(screen.getByTestId('action-container')).toHaveClass(
      'opacity-0',
      'transition-opacity',
      'group-hover/question:opacity-100',
      'focus-within:opacity-100',
    )
  })

  it('should cover composition lifecycle preventing enter submitting when composing', async () => {
    const user = userEvent.setup()
    const onRegenerate = vi.fn() as unknown as OnRegenerate
    const item = makeItem()

    renderWithProvider(item, onRegenerate)

    const editBtn = screen.getByRole('button', { name: 'common.operation.edit' })
    await user.click(editBtn)

    const textbox = await screen.findByRole('textbox')
    await user.clear(textbox)

    // Simulate composition start and typing
    act(() => {
      textbox.focus()
    })

    // Simulate composition start
    fireEvent.compositionStart(textbox)

    // Try to press Enter while composing
    fireEvent.keyDown(textbox, { key: 'Enter', code: 'Enter' })

    // Simulate composition end
    fireEvent.compositionEnd(textbox)

    // Expect onRegenerate not to be called because Enter was pressed during composition
    expect(onRegenerate).not.toHaveBeenCalled()

    // Let setTimeout finish its 50ms interval to clear isComposing
    await new Promise((r) => setTimeout(r, 60))

    // Now press Enter after composition is fully cleared
    fireEvent.keyDown(textbox, { key: 'Enter', code: 'Enter' })

    expect(onRegenerate).toHaveBeenCalledWith(item, { message: '', files: [] })
  })

  it('should prevent Enter from submitting when shiftKey is pressed', async () => {
    const user = userEvent.setup()
    const onRegenerate = vi.fn() as unknown as OnRegenerate
    const item = makeItem()

    renderWithProvider(item, onRegenerate)

    await user.click(screen.getByRole('button', { name: 'common.operation.edit' }))
    const textbox = await screen.findByRole('textbox')

    // Press Shift+Enter
    fireEvent.keyDown(textbox, { key: 'Enter', code: 'Enter', shiftKey: true })

    expect(onRegenerate).not.toHaveBeenCalled()
  })

  it('should ignore enter when nativeEvent.isComposing is true', async () => {
    const user = userEvent.setup()
    const onRegenerate = vi.fn() as unknown as OnRegenerate
    renderWithProvider(makeItem(), onRegenerate)

    await user.click(screen.getByRole('button', { name: 'common.operation.edit' }))
    const textbox = await screen.findByRole('textbox')

    // Create an event with nativeEvent.isComposing = true
    const event = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true })
    Object.defineProperty(event, 'isComposing', { value: true, configurable: true })

    fireEvent(textbox, event)
    expect(onRegenerate).not.toHaveBeenCalled()
  })

  it('should clear timer on cancel and on component unmount', async () => {
    const user = userEvent.setup()
    const onRegenerate = vi.fn() as unknown as OnRegenerate
    const { unmount } = renderWithProvider(makeItem(), onRegenerate)

    await user.click(screen.getByRole('button', { name: 'common.operation.edit' }))
    const textbox = await screen.findByRole('textbox')

    fireEvent.compositionStart(textbox)
    fireEvent.compositionEnd(textbox)

    // Timer is now running, let's start another composition to clear it
    fireEvent.compositionStart(textbox)
    fireEvent.compositionEnd(textbox)

    const cancelBtn = await screen.findByRole('button', { name: 'common.operation.cancel' })
    await user.click(cancelBtn)

    // Test unmount clearing timer
    await user.click(screen.getByRole('button', { name: 'common.operation.edit' }))
    const textbox2 = await screen.findByRole('textbox')
    fireEvent.compositionStart(textbox2)
    fireEvent.compositionEnd(textbox2)
    unmount()

    expect(onRegenerate).not.toHaveBeenCalled()
  })

  it('should ignore enter when handleResend with active timer', async () => {
    const user = userEvent.setup()
    const onRegenerate = vi.fn() as unknown as OnRegenerate
    renderWithProvider(makeItem(), onRegenerate)

    await user.click(screen.getByRole('button', { name: 'common.operation.edit' }))
    const textbox = await screen.findByRole('textbox')

    fireEvent.compositionStart(textbox)
    fireEvent.compositionEnd(textbox) // starts timer

    const saveBtn = screen.getByRole('button', { name: 'common.operation.save' })
    await user.click(saveBtn) // handleResend clears timer

    expect(onRegenerate).toHaveBeenCalled()
  })

  it('should not render the default question avatar icon (D3 去头像)', () => {
    const { container } = renderWithProvider(makeItem(), vi.fn() as unknown as OnRegenerate)

    expect(container.querySelector('.question-default-user-icon')).not.toBeInTheDocument()
  })

  it('should accept but not render questionIcon (D3 去头像，契约暂留)', () => {
    const { container } = renderWithProvider(makeItem(), vi.fn() as unknown as OnRegenerate, {
      questionIcon: <div data-testid="custom-question-icon">CustomIcon</div>,
    })

    expect(screen.queryByTestId('custom-question-icon')).not.toBeInTheDocument()
    expect(container.querySelector('.question-default-user-icon')).not.toBeInTheDocument()
  })

  it('should call switchSibling with next sibling ID when next button clicked and nextSibling exists', async () => {
    const user = userEvent.setup()
    const switchSibling = vi.fn()
    const item = makeItem({
      prevSibling: 'q-0',
      nextSibling: 'q-2',
      siblingIndex: 1,
      siblingCount: 3,
    })

    renderWithProvider(item, vi.fn() as unknown as OnRegenerate, { switchSibling })

    const nextBtn = screen.getByRole('button', { name: /next/i })
    await user.click(nextBtn)

    expect(switchSibling).toHaveBeenCalledWith('q-2')
    expect(switchSibling).toHaveBeenCalledTimes(1)
  })

  it('should not call switchSibling when next button clicked but nextSibling is null', async () => {
    const user = userEvent.setup()
    const switchSibling = vi.fn()
    const item = makeItem({
      prevSibling: 'q-0',
      nextSibling: undefined,
      siblingIndex: 2,
      siblingCount: 3,
    })

    renderWithProvider(item, vi.fn() as unknown as OnRegenerate, { switchSibling })

    const nextBtn = screen.getByRole('button', { name: /next/i })
    await user.click(nextBtn)

    expect(switchSibling).not.toHaveBeenCalled()
    expect(nextBtn).toBeDisabled()
  })

  it('should not call switchSibling when prev button clicked but prevSibling is null', async () => {
    const user = userEvent.setup()
    const switchSibling = vi.fn()
    const item = makeItem({
      prevSibling: undefined,
      nextSibling: 'q-2',
      siblingIndex: 0,
      siblingCount: 3,
    })

    renderWithProvider(item, vi.fn() as unknown as OnRegenerate, { switchSibling })

    const prevBtn = screen.getByRole('button', { name: /previous/i })
    await user.click(prevBtn)

    expect(switchSibling).not.toHaveBeenCalled()
    expect(prevBtn).toBeDisabled()
  })

  it('should render next button disabled when nextSibling is null', () => {
    const item = makeItem({
      prevSibling: 'q-0',
      nextSibling: undefined,
      siblingIndex: 2,
      siblingCount: 3,
    })
    renderWithProvider(item, vi.fn() as unknown as OnRegenerate)

    const nextBtn = screen.getByRole('button', { name: /next/i })
    expect(nextBtn).toBeDisabled()
  })

  it('should handle both prev and next siblings being null (only one message)', () => {
    const item = makeItem({
      prevSibling: undefined,
      nextSibling: undefined,
      siblingIndex: 0,
      siblingCount: 1,
    })
    renderWithProvider(item, vi.fn() as unknown as OnRegenerate)

    const prevBtn = screen.queryByRole('button', { name: /previous/i })
    const nextBtn = screen.queryByRole('button', { name: /next/i })

    expect(prevBtn).not.toBeInTheDocument()
    expect(nextBtn).not.toBeInTheDocument()
  })

  it('should render with empty message_files array (no file list)', () => {
    const { container } = renderWithProvider(makeItem({ message_files: [] }))

    expect(container.querySelector('[class*="FileList"]')).not.toBeInTheDocument()
    // Content should still be visible
    expect(screen.getByText('This is the question content')).toBeInTheDocument()
  })

  it('should render with message_files having multiple files', () => {
    const files = [
      {
        name: 'document.pdf',
        url: 'https://example.com/doc.pdf',
        type: 'application/pdf',
        previewUrl: 'https://example.com/doc.pdf',
        size: 5000,
      } as unknown as FileEntity,
      {
        name: 'image.png',
        url: 'https://example.com/img.png',
        type: 'image/png',
        previewUrl: 'https://example.com/img.png',
        size: 3000,
      } as unknown as FileEntity,
    ]

    renderWithProvider(makeItem({ message_files: files }))

    expect(screen.getByText(/document.pdf/i)).toBeInTheDocument()
    expect(screen.getByText(/image.png/i)).toBeInTheDocument()
  })

  it('should hide edit button when enableEdit is explicitly true', () => {
    renderWithProvider(makeItem(), vi.fn() as unknown as OnRegenerate, { enableEdit: true })

    expect(screen.getByRole('button', { name: 'common.operation.edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common.operation.copy' })).toBeInTheDocument()
  })

  it('should show copy button always regardless of enableEdit setting', () => {
    renderWithProvider(makeItem(), vi.fn() as unknown as OnRegenerate, { enableEdit: false })

    expect(screen.getByRole('button', { name: 'common.operation.copy' })).toBeInTheDocument()
  })

  it('should not render content switch when no siblings exist', () => {
    const item = makeItem({
      siblingCount: 1,
      siblingIndex: 0,
      prevSibling: undefined,
      nextSibling: undefined,
    })
    renderWithProvider(item)

    // ContentSwitch should not render when count is 1
    const prevBtn = screen.queryByRole('button', { name: /previous/i })
    const nextBtn = screen.queryByRole('button', { name: /next/i })

    expect(prevBtn).not.toBeInTheDocument()
    expect(nextBtn).not.toBeInTheDocument()
  })

  it('should update edited content as user types', async () => {
    const user = userEvent.setup()
    renderWithProvider(makeItem())

    await user.click(screen.getByRole('button', { name: 'common.operation.edit' }))
    const textbox = await screen.findByRole('textbox')

    expect(textbox).toHaveValue('This is the question content')

    await user.clear(textbox)
    expect(textbox).toHaveValue('')

    await user.type(textbox, 'New content')
    expect(textbox).toHaveValue('New content')
  })

  it('should maintain file list in edit mode with margin adjustment', async () => {
    const user = userEvent.setup()
    const files = [
      {
        name: 'test.txt',
        url: 'https://example.com/test.txt',
        type: 'text/plain',
        previewUrl: 'https://example.com/test.txt',
        size: 100,
      } as unknown as FileEntity,
    ]

    const { container } = renderWithProvider(makeItem({ message_files: files }))

    await user.click(screen.getByRole('button', { name: 'common.operation.edit' }))

    // FileList should be visible in edit mode with mb-3 margin
    expect(screen.getByText(/test.txt/i)).toBeInTheDocument()
    // Target the FileList container directly (it's the first ancestor with FileList-related class)
    const fileListParent = container.querySelector('[class*="flex flex-wrap gap-2"]')
    expect(fileListParent).toHaveClass('mb-3')
  })

  it('should switch the capsule to the mockup edit-box in editing mode', async () => {
    const user = userEvent.setup()
    renderWithProvider(makeItem())

    await user.click(screen.getByRole('button', { name: 'common.operation.edit' }))

    const box = screen.getByTestId('question-content')
    expect(box).not.toHaveClass('bg-[var(--bg-soft)]', 'w-fit')
    expect(box).toHaveClass(
      'w-[min(560px,100%)]',
      'rounded-[12px]',
      'border',
      'border-[var(--border-strong)]',
      'bg-[var(--card)]',
    )
  })

  it('should handle siblings at boundaries (first, middle, last)', async () => {
    const switchSibling = vi.fn()

    // Test first message
    const firstItem = makeItem({
      prevSibling: undefined,
      nextSibling: 'q-2',
      siblingIndex: 0,
      siblingCount: 3,
    })
    const { unmount: unmount1 } = renderWithProvider(
      firstItem,
      vi.fn() as unknown as OnRegenerate,
      { switchSibling },
    )

    let prevBtn = screen.getByRole('button', { name: /previous/i })
    let nextBtn = screen.getByRole('button', { name: /next/i })

    expect(prevBtn).toBeDisabled()
    expect(nextBtn).not.toBeDisabled()

    unmount1()
    vi.clearAllMocks()

    // Test last message
    const lastItem = makeItem({
      prevSibling: 'q-0',
      nextSibling: undefined,
      siblingIndex: 2,
      siblingCount: 3,
    })
    const { unmount: unmount2 } = renderWithProvider(lastItem, vi.fn() as unknown as OnRegenerate, {
      switchSibling,
    })

    prevBtn = screen.getByRole('button', { name: /previous/i })
    nextBtn = screen.getByRole('button', { name: /next/i })

    expect(prevBtn).not.toBeDisabled()
    expect(nextBtn).toBeDisabled()

    unmount2()
  })

  it('should handle rapid composition start/end cycles', async () => {
    const onRegenerate = vi.fn() as unknown as OnRegenerate
    renderWithProvider(makeItem(), onRegenerate)

    await userEvent.click(screen.getByRole('button', { name: 'common.operation.edit' }))
    const textbox = await screen.findByRole('textbox')

    // Rapid composition cycles
    fireEvent.compositionStart(textbox)
    fireEvent.compositionEnd(textbox)
    fireEvent.compositionStart(textbox)
    fireEvent.compositionEnd(textbox)
    fireEvent.compositionStart(textbox)
    fireEvent.compositionEnd(textbox)

    // Press Enter after final composition end
    await new Promise((r) => setTimeout(r, 60))
    fireEvent.keyDown(textbox, { key: 'Enter', code: 'Enter' })

    expect(onRegenerate).toHaveBeenCalled()
  })

  it('should handle Enter key with only whitespace edited content', async () => {
    const user = userEvent.setup()
    const onRegenerate = vi.fn() as unknown as OnRegenerate
    renderWithProvider(makeItem(), onRegenerate)

    await user.click(screen.getByRole('button', { name: 'common.operation.edit' }))
    const textbox = await screen.findByRole('textbox')

    await user.clear(textbox)
    await user.type(textbox, '   ')

    fireEvent.keyDown(textbox, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(onRegenerate).toHaveBeenCalledWith(makeItem(), { message: '   ', files: [] })
    })
  })

  it('should trigger onRegenerate with actual message_files in item', async () => {
    const user = userEvent.setup()
    const onRegenerate = vi.fn() as unknown as OnRegenerate
    const files = [
      {
        name: 'edit-file.txt',
        url: 'https://example.com/edit-file.txt',
        type: 'text/plain',
        previewUrl: 'https://example.com/edit-file.txt',
        size: 200,
      } as unknown as FileEntity,
    ]

    const item = makeItem({ message_files: files })
    renderWithProvider(item, onRegenerate)

    await user.click(screen.getByRole('button', { name: 'common.operation.edit' }))
    const textbox = await screen.findByRole('textbox')

    await user.clear(textbox)
    await user.type(textbox, 'Modified with files')

    fireEvent.keyDown(textbox, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(onRegenerate).toHaveBeenCalledWith(item, { message: 'Modified with files', files })
    })
  })

  it('should clear composition timer when switching editing mode multiple times', async () => {
    const user = userEvent.setup()
    renderWithProvider(makeItem())

    // First edit cycle
    await user.click(screen.getByRole('button', { name: 'common.operation.edit' }))
    let textbox = await screen.findByRole('textbox')
    fireEvent.compositionStart(textbox)
    fireEvent.compositionEnd(textbox)

    // Cancel and re-edit
    let cancelBtn = await screen.findByRole('button', { name: 'common.operation.cancel' })
    await user.click(cancelBtn)

    // Second edit cycle
    await user.click(screen.getByRole('button', { name: 'common.operation.edit' }))
    textbox = await screen.findByRole('textbox')
    expect(textbox).toHaveValue('This is the question content')

    fireEvent.compositionStart(textbox)
    fireEvent.compositionEnd(textbox)

    cancelBtn = await screen.findByRole('button', { name: 'common.operation.cancel' })
    await user.click(cancelBtn)

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('should handle all sibling combinations with switchSibling callback', async () => {
    const user = userEvent.setup()
    const switchSibling = vi.fn()

    // Test with all siblings
    const allItem = makeItem({
      prevSibling: 'q-0',
      nextSibling: 'q-2',
      siblingIndex: 1,
      siblingCount: 3,
    })
    renderWithProvider(allItem, vi.fn() as unknown as OnRegenerate, { switchSibling })

    await user.click(screen.getByRole('button', { name: /previous/i }))
    expect(switchSibling).toHaveBeenCalledWith('q-0')

    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(switchSibling).toHaveBeenCalledWith('q-2')
  })

  it('should handle undefined onRegenerate in handleResend', async () => {
    const user = userEvent.setup()
    render(
      <ChatContextProvider
        config={{} as unknown as ChatConfig}
        isResponding={false}
        chatList={[]}
        showPromptLog={false}
        onSend={vi.fn()}
        onRegenerate={undefined as unknown as OnRegenerate}
        onAnnotationEdited={vi.fn()}
        onAnnotationAdded={vi.fn()}
        onAnnotationRemoved={vi.fn()}
        disableFeedback={false}
        onFeedback={vi.fn()}
        getHumanInputNodeData={vi.fn()}
      >
        <Question item={makeItem()} theme={null} />
      </ChatContextProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'common.operation.edit' }))
    await user.click(screen.getByRole('button', { name: 'common.operation.save' }))
    // Should not throw
  })

  it('should handle missing switchSibling prop', async () => {
    const user = userEvent.setup()
    const item = makeItem({
      prevSibling: 'prev',
      nextSibling: 'next',
      siblingIndex: 1,
      siblingCount: 3,
    })
    renderWithProvider(item, vi.fn() as unknown as OnRegenerate, { switchSibling: undefined })

    const prevBtn = screen.getByRole('button', { name: /previous/i })
    await user.click(prevBtn)
    // Should not throw

    const nextBtn = screen.getByRole('button', { name: /next/i })
    await user.click(nextBtn)
    // Should not throw
  })

  it('should render the capsule purely via new-vision token classes (theme prop 已废弃不消费)', () => {
    const theme = { chatBubbleColorStyle: 'backgroundColor: red' } as unknown as Theme
    renderWithProvider(makeItem(), vi.fn() as unknown as OnRegenerate, { theme })
    const content = screen.getByTestId('question-content')
    // 黑底气泡时代的 var(--chat-bubble-user-*) 内联样式清除；着色全走 class token
    expect(content.getAttribute('style')).toBeNull()
    expect(content).toHaveClass('bg-[var(--bg-soft)]', 'text-[var(--text-1)]')
  })

  it('should handle undefined message_files', () => {
    const item = makeItem({ message_files: undefined as unknown as FileEntity[] })
    const { container } = renderWithProvider(item)
    expect(container.querySelector('[class*="FileList"]')).not.toBeInTheDocument()
  })

  it('should handle handleSwitchSibling call when siblings are missing', async () => {
    const user = userEvent.setup()
    const switchSibling = vi.fn()
    const item = makeItem({
      prevSibling: undefined,
      nextSibling: undefined,
      siblingIndex: 0,
      siblingCount: 2,
    })
    renderWithProvider(item, vi.fn() as unknown as OnRegenerate, { switchSibling })

    const prevBtn = screen.getByRole('button', { name: /previous/i })
    const nextBtn = screen.getByRole('button', { name: /next/i })

    // These will now call switchSibling because of the mock, hit the falsy checks in Question
    await user.click(prevBtn)
    await user.click(nextBtn)

    expect(switchSibling).not.toHaveBeenCalled()
  })

  it('should clear timer on unmount when timer is active', async () => {
    const user = userEvent.setup()
    const { unmount } = renderWithProvider(makeItem())
    await user.click(screen.getByRole('button', { name: 'common.operation.edit' }))
    const textbox = await screen.findByRole('textbox')
    fireEvent.compositionStart(textbox)
    fireEvent.compositionEnd(textbox) // starts timer
    unmount()
    // Should not throw and branch should be hit
  })

  it('should handle handleSwitchSibling with no siblings and missing switchSibling prop', async () => {
    const user = userEvent.setup()
    const item = makeItem({
      prevSibling: undefined,
      nextSibling: undefined,
      siblingIndex: 0,
      siblingCount: 2,
    })
    renderWithProvider(item, vi.fn() as unknown as OnRegenerate, { switchSibling: undefined })

    const prevBtn = screen.getByRole('button', { name: /previous/i })
    await user.click(prevBtn)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument() // No crash
  })
})
