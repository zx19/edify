import type { ChatWithHistoryContextValue } from '../../context'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { InputVarType } from '@/app/components/workflow/types'
import { useChatWithHistoryContext } from '../../context'
import InputsFormNode from '../index'

// Mocks for components used by InputsFormContent (the real sibling)
vi.mock('@/app/components/workflow/nodes/_base/components/before-run-form/bool-input', () => ({
  default: ({ value, name }: { value: boolean; name: string }) => (
    <div data-testid="mock-bool-input" role="checkbox" aria-checked={value}>
      {name}
    </div>
  ),
}))

vi.mock('@/app/components/workflow/nodes/_base/components/editor/code-editor', () => ({
  default: ({ value, placeholder }: { value: string; placeholder?: React.ReactNode }) => (
    <div data-testid="mock-code-editor">
      <span>{value}</span>
      {placeholder}
    </div>
  ),
}))

vi.mock('@/app/components/base/file-uploader', () => ({
  FileUploaderInAttachmentWrapper: ({ value }: { value?: unknown[] }) => (
    <div data-testid="mock-file-uploader" data-count={value?.length ?? 0} />
  ),
}))

vi.mock('../../context', () => ({
  useChatWithHistoryContext: vi.fn(),
}))

const mockHandleStartChat = vi.fn((cb?: () => void) => {
  if (cb) cb()
})

const defaultContextValues: Partial<ChatWithHistoryContextValue> = {
  isMobile: false,
  currentConversationId: '',
  handleStartChat: mockHandleStartChat,
  allInputsHidden: false,
  theme: undefined,
  inputsForms: [{ variable: 'test_var', type: InputVarType.textInput, label: 'Test Label' }],
  currentConversationInputs: {},
  newConversationInputs: {},
  newConversationInputsRef: { current: {} } as unknown as React.RefObject<Record<string, unknown>>,
  setCurrentConversationInputs: vi.fn(),
  handleNewConversationInputsChange: vi.fn(),
}

const setMockContext = (overrides: Partial<ChatWithHistoryContextValue> = {}) => {
  vi.mocked(useChatWithHistoryContext).mockReturnValue({
    ...defaultContextValues,
    ...overrides,
  } as unknown as ChatWithHistoryContextValue)
}

describe('InputsFormNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setMockContext()
  })

  it('should render nothing if allInputsHidden is true', () => {
    setMockContext({ allInputsHidden: true })
    const { container } = render(<InputsFormNode />)
    expect(container.firstChild).toBeNull()
  })

  it('should render nothing if inputsForms array is empty', () => {
    setMockContext({ inputsForms: [] })
    const { container } = render(<InputsFormNode />)
    expect(container.firstChild).toBeNull()
  })

  it('should collapse by default when defaultOpen is false (全选填折叠为「对话前请完善信息 ▾」)', async () => {
    const user = userEvent.setup()
    render(<InputsFormNode defaultOpen={false} />)

    // 标题行恒在,折叠态文案=对话前请完善信息
    expect(screen.getByText('share.chat.completeInfoBeforeChat')).toBeInTheDocument()
    // 折叠时表单内容不渲染
    expect(screen.queryByText('Test Label')).not.toBeInTheDocument()

    const toggleBtn = screen.getByRole('button', { name: 'share.chat.completeInfoBeforeChat' })
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggleBtn)
    expect(screen.getByText('Test Label')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'share.chat.completeInfoBeforeChat' }),
    ).toHaveAttribute('aria-expanded', 'true')
  })

  it('should expand by default when defaultOpen is true (有必填默认展开)', async () => {
    const user = userEvent.setup()
    setMockContext({
      inputsForms: [
        { variable: 'req', type: InputVarType.textInput, label: 'Required Label', required: true },
      ],
    })
    render(<InputsFormNode defaultOpen={true} />)

    expect(screen.getByText('share.chat.completeInfoBeforeChat')).toBeInTheDocument()
    expect(screen.getByText('Required Label')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'share.chat.completeInfoBeforeChat' }),
    ).toHaveAttribute('aria-expanded', 'true')

    // 展开态仍可手动折叠
    await user.click(screen.getByRole('button', { name: 'share.chat.completeInfoBeforeChat' }))
    expect(screen.queryByText('Required Label')).not.toBeInTheDocument()
  })

  it('should render start chat button with accent styling when no conversation exists', async () => {
    const user = userEvent.setup()
    // theme.primaryColor 内联机制已退役：开始钮吃作用域 accent 类（chat_color_theme 由壳层注入 --accent 覆盖）
    setMockContext({ currentConversationId: '' })

    render(<InputsFormNode defaultOpen={true} />)
    const startBtn = screen.getByRole('button', { name: /share.chat.startChat/i })

    expect(startBtn).toBeInTheDocument()
    expect(startBtn.className).toContain('bg-[var(--accent)]')

    await user.click(startBtn)
    expect(mockHandleStartChat).toHaveBeenCalled()
    // 开始聊天后表单收起(内部状态)
    expect(screen.queryByText('Test Label')).not.toBeInTheDocument()
  })

  it('should not render start chat button when a conversation exists', () => {
    setMockContext({ currentConversationId: 'conv-1' })
    render(<InputsFormNode defaultOpen={true} />)

    expect(screen.getByText('Test Label')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /share.chat.startChat/i })).not.toBeInTheDocument()
  })

  it('should apply mobile specific classes when isMobile is true', () => {
    setMockContext({ isMobile: true })
    render(<InputsFormNode defaultOpen={true} />)

    // 移动端内容区 px-3(桌面 px-4)
    const contentWrapper = screen.getByText('Test Label').closest('[class*="px-3"]')
    expect(contentWrapper).toBeInTheDocument()
  })

  it('should render as a full-width welcome-flow block (表单在欢迎屏流内,与 720 列同宽)', () => {
    const { container } = render(<InputsFormNode defaultOpen={false} />)
    const root = container.firstChild as HTMLElement
    expect(root.className).toContain('w-full')
    expect(root.className).toContain('text-left')
  })
})
