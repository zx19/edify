import { render, screen } from '@testing-library/react'
import NoData from '../no-data'

describe('NoData（v2 虚线框轻提示，插画/图标退役）', () => {
  it('虚线框 + 引导文案，无 spark 图标', () => {
    const { container } = render(<NoData />)

    const box = screen.getByText('share.generation.noData')
    expect(box).toHaveClass('border-dashed')
    expect(container.querySelector('.i-ri-sparkling-fill')).toBeNull()
  })
})
