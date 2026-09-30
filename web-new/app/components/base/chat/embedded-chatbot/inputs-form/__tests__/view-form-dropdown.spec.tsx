import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ViewFormDropdown from '../view-form-dropdown'

vi.mock('../content', () => ({
  default: () => <div>Form content</div>,
}))

describe('ViewFormDropdown', () => {
  it('toggles the form settings', async () => {
    const user = userEvent.setup()
    render(<ViewFormDropdown />)

    const trigger = screen.getByRole('button', { name: 'share.chat.viewChatSettings' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Form content')).not.toBeInTheDocument()

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Form content')).toBeInTheDocument()

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Form content')).not.toBeInTheDocument()
  })

  it('variant="text"：渲染文字钮（icon+可见文案，桌面直连形态）', () => {
    render(<ViewFormDropdown variant="text" />)

    const trigger = screen.getByRole('button', { name: 'share.chat.viewChatSettings' })
    expect(trigger).toHaveClass('h-7')
    expect(trigger.textContent).toContain('share.chat.viewChatSettings')
  })

  it('默认 icon 形态（向后兼容）：无可见文案', () => {
    render(<ViewFormDropdown />)

    const trigger = screen.getByRole('button', { name: 'share.chat.viewChatSettings' })
    expect(trigger.textContent).toBe('')
  })
})
