// 双轨 parity：新版 @xsl/ui/icon-button vs 旧版 @langgenius/dify-ui/icon-button
// 口径同 button parity（执行计划 v2 §5.2）：同 props 渲染两版，outerHTML 与行为快照全等。
import { IconButton as LegacyIconButton } from '@langgenius/dify-ui/icon-button'
import { userEvent } from 'vite-plus/test/browser'
import { render } from 'vitest-browser-react'
import { IconButton } from '../index'

const matrix = {
  variant: [
    'default',
    'primary',
    'secondary',
    'secondary-accent',
    'tertiary',
    'ghost',
    'ghost-accent',
  ],
  tone: ['default', 'destructive'],
  size: ['xs', 'sm', 'md', 'lg', 'xl'],
} as const

const icon = <svg data-test-icon aria-hidden="true" />

function buttonHTML(screen: { container: HTMLElement }) {
  const el = screen.container.querySelector('button')
  if (!el) throw new Error('icon-button not rendered')
  return el.outerHTML
}

describe('IconButton 双轨 parity', () => {
  for (const variant of matrix.variant) {
    for (const size of matrix.size) {
      for (const tone of matrix.tone) {
        it(`DOM diff = 0 @ ${variant}/${size}/${tone}`, async () => {
          const legacy = await render(
            <LegacyIconButton variant={variant} size={size} tone={tone} aria-label="对照">
              {icon}
            </LegacyIconButton>,
          )
          const next = await render(
            <IconButton variant={variant} size={size} tone={tone} aria-label="对照">
              {icon}
            </IconButton>,
          )
          expect(buttonHTML(next)).toBe(buttonHTML(legacy))
        })
      }
    }
  }

  it('DOM diff = 0 @ disabled / aria-labelledby 边界', async () => {
    const legacy = await render(
      <LegacyIconButton disabled aria-label="对照">
        {icon}
      </LegacyIconButton>,
    )
    const next = await render(
      <IconButton disabled aria-label="对照">
        {icon}
      </IconButton>,
    )
    expect(buttonHTML(next)).toBe(buttonHTML(legacy))
    const legacyLabelled = await render(
      <LegacyIconButton aria-labelledby="ext-label">{icon}</LegacyIconButton>,
    )
    const nextLabelled = await render(<IconButton aria-labelledby="ext-label">{icon}</IconButton>)
    expect(buttonHTML(nextLabelled)).toBe(buttonHTML(legacyLabelled))
  })

  it('行为快照全等：click 回调', async () => {
    let legacyClicks = 0
    let nextClicks = 0
    const legacy = await render(
      <LegacyIconButton
        aria-label="对照"
        onClick={() => {
          legacyClicks += 1
        }}
      >
        {icon}
      </LegacyIconButton>,
    )
    const next = await render(
      <IconButton
        aria-label="对照"
        onClick={() => {
          nextClicks += 1
        }}
      >
        {icon}
      </IconButton>,
    )
    await userEvent.click(legacy.container.querySelector('button')!)
    await userEvent.click(next.container.querySelector('button')!)
    expect(nextClicks).toBe(legacyClicks)
  })
})
