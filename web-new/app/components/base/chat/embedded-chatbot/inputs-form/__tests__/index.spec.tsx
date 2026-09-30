/* oxlint-disable typescript/no-explicit-any */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppSourceType } from '@/service/share'
import { useEmbeddedChatbotContext } from '../../context'
import InputsFormNode from '../index'

vi.mock('../../context', () => ({
  useEmbeddedChatbotContext: vi.fn(),
}))

// Mock InputsFormContent to avoid complex integration in this test
vi.mock('../content', () => ({
  default: () => <div data-testid="mock-inputs-form-content" />,
}))

const mockContextValue = {
  appSourceType: AppSourceType.webApp,
  isMobile: false,
  currentConversationId: null,
  theme: undefined,
  handleStartChat: vi.fn(),
  allInputsHidden: false,
  inputsForms: [{ variable: 'test' }],
}

describe('InputsFormNode（v2 折叠条族形态：chevron 卡头 + 状态自治 + accent CTA）', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useEmbeddedChatbotContext).mockReturnValue(mockContextValue as unknown as any)
  })

  it('should return null if allInputsHidden is true', () => {
    vi.mocked(useEmbeddedChatbotContext).mockReturnValue({
      ...mockContextValue,
      allInputsHidden: true,
    } as unknown as any)
    const { container } = render(<InputsFormNode defaultOpen={true} />)
    expect(container.firstChild).toBeNull()
  })

  it('should return null if inputsForms is empty', () => {
    vi.mocked(useEmbeddedChatbotContext).mockReturnValue({
      ...mockContextValue,
      inputsForms: [],
    } as unknown as any)
    const { container } = render(<InputsFormNode defaultOpen={true} />)
    expect(container.firstChild).toBeNull()
  })

  it('defaultOpen=true：展开渲染内容 + 右下「开始对话」accent CTA', () => {
    render(<InputsFormNode defaultOpen={true} />)
    expect(screen.getByText(/chat.chatSettingsTitle/i)).toBeInTheDocument()
    expect(screen.getByTestId('mock-inputs-form-content')).toBeInTheDocument()
    const cta = screen.getByRole('button', { name: 'share.chat.startChat' })
    expect(cta).toBeInTheDocument()
    expect(cta).toHaveClass('bg-[var(--accent)]')
    expect(screen.getByRole('button', { name: /chatSettingsTitle/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('默认折叠（全选填语义）：不渲染内容，chevron aria-expanded=false', () => {
    render(<InputsFormNode />)
    expect(screen.getByText(/chat.chatSettingsTitle/i)).toBeInTheDocument()
    expect(screen.queryByTestId('mock-inputs-form-content')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'share.chat.startChat' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /chatSettingsTitle/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('chevron 卡头折叠/展开自治切换（编辑/关闭文字钮退役）', async () => {
    render(<InputsFormNode />)
    const toggle = screen.getByRole('button', { name: /chatSettingsTitle/i })

    // 旧「编辑」「关闭」文字钮不存在
    expect(screen.queryByRole('button', { name: 'common.operation.edit' })).not.toBeInTheDocument()

    await user.click(toggle)
    expect(screen.getByTestId('mock-inputs-form-content')).toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    await user.click(toggle)
    expect(screen.queryByTestId('mock-inputs-form-content')).not.toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('开始对话：调 handleStartChat 且回调后折叠卡', async () => {
    const handleStartChat = vi.fn((cb: () => void) => cb())

    vi.mocked(useEmbeddedChatbotContext).mockReturnValue({
      ...mockContextValue,
      handleStartChat,
    } as unknown as any)
    render(<InputsFormNode defaultOpen={true} />)
    await user.click(screen.getByRole('button', { name: 'share.chat.startChat' }))
    expect(handleStartChat).toHaveBeenCalled()
    // 回调触发折叠：内容消失
    expect(screen.queryByTestId('mock-inputs-form-content')).not.toBeInTheDocument()
  })

  it('should NOT apply inline theme color to start chat button（createTheme 退役，accent 走 token 注入）', () => {
    vi.mocked(useEmbeddedChatbotContext).mockReturnValue({
      ...mockContextValue,
      theme: {
        primaryColor: '#ff0000',
      },
    } as unknown as any)
    render(<InputsFormNode defaultOpen={true} />)
    const button = screen.getByRole('button', { name: 'share.chat.startChat' })
    expect(button.getAttribute('style') || '').not.toContain('background-color')
  })

  it('无渐变 Divider 装饰带（v2 折叠条族无底部装饰）', () => {
    const { container } = render(<InputsFormNode />)
    expect(container.querySelector('[class*="rotate-180"]')).toBeNull()
  })
})
