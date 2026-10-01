import type { SiteInfo } from '@/models/share'
import { render, screen } from '@testing-library/react'
import Header from '../header'

vi.mock('../menu-dropdown', () => ({
  default: () => <button type="button" aria-label="common.operation.more" />,
}))

const siteInfo = {
  title: '理赔材料预审',
  icon: '',
  icon_type: 'emoji',
} as SiteInfo

describe('text-gen Header（40px 极薄，对照表 §2）', () => {
  it('图标 + 应用名（弱化 text-2）+ ⋯ 菜单', () => {
    render(<Header siteInfo={siteInfo} />)

    const header = screen.getByRole('banner')
    expect(header).toHaveClass('h-10', 'px-4')
    const title = screen.getByText('理赔材料预审')
    expect(title).toHaveClass('text-[13px]', 'font-semibold', 'text-[var(--text-2)]')
    expect(screen.getByRole('button', { name: 'common.operation.more' })).toBeInTheDocument()
  })

  it('hideLogout 透传给 ⋯ 菜单', () => {
    render(<Header siteInfo={siteInfo} hideLogout />)
    expect(screen.getByRole('button', { name: 'common.operation.more' })).toBeInTheDocument()
  })
})
