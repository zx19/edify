// 双轨 parity：新版 @xsl/ui/button vs 旧版 @langgenius/dify-ui/button
// 执行计划 v2 §5.2 基础组件三层 diff 的 DOM/行为两层——同 props 渲染两版，outerHTML 与行为快照须全等。
// （视觉层走 Storybook 双 stories + screenshot:diff，harness 随 W3 screenshots-sample 落地）
import { Button as LegacyButton } from '@langgenius/dify-ui/button'
import { userEvent } from 'vite-plus/test/browser'
import { render } from 'vitest-browser-react'
import { Button } from '../index'

const matrix = {
  variant: ['primary', 'secondary', 'secondary-accent', 'tertiary', 'ghost', 'ghost-accent'],
  size: ['small', 'medium', 'large'],
  tone: ['default', 'destructive'],
} as const

function buttonHTML(screen: { container: HTMLElement }) {
  const el = screen.container.querySelector('button')
  if (!el) throw new Error('button not rendered')
  return el.outerHTML
}

describe('Button 双轨 parity', () => {
  for (const variant of matrix.variant) {
    for (const size of matrix.size) {
      for (const tone of matrix.tone) {
        it(`DOM diff = 0 @ ${variant}/${size}/${tone}`, async () => {
          const legacy = await render(
            <LegacyButton variant={variant} size={size} tone={tone}>
              对照样本
            </LegacyButton>,
          )
          const next = await render(
            <Button variant={variant} size={size} tone={tone}>
              对照样本
            </Button>,
          )
          expect(buttonHTML(next)).toBe(buttonHTML(legacy))
        })
      }
    }
  }

  it('DOM diff = 0 @ loading/disabled/focusableWhenDisabled 边界组合', async () => {
    const combos = [
      { loading: true },
      { disabled: true },
      { disabled: true, focusableWhenDisabled: true },
      { loading: true, disabled: false },
      { loading: true, focusableWhenDisabled: false },
    ] as const
    for (const props of combos) {
      const legacy = await render(<LegacyButton {...props}>边界</LegacyButton>)
      const next = await render(<Button {...props}>边界</Button>)
      expect(buttonHTML(next)).toBe(buttonHTML(legacy))
    }
  })

  it('行为快照全等：click 回调 / loading 态禁点', async () => {
    let legacyClicks = 0
    let nextClicks = 0
    const legacy = await render(
      <LegacyButton
        onClick={() => {
          legacyClicks += 1
        }}
      >
        点
      </LegacyButton>,
    )
    const next = await render(
      <Button
        onClick={() => {
          nextClicks += 1
        }}
      >
        点
      </Button>,
    )
    await userEvent.click(legacy.container.querySelector('button')!)
    await userEvent.click(next.container.querySelector('button')!)
    expect(nextClicks).toBe(legacyClicks)

    const legacyLoading = await render(
      <LegacyButton
        loading
        onClick={() => {
          legacyClicks += 1
        }}
      >
        点
      </LegacyButton>,
    )
    const nextLoading = await render(
      <Button
        loading
        onClick={() => {
          nextClicks += 1
        }}
      >
        点
      </Button>,
    )
    const legacyDisabled = legacyLoading.container.querySelector('button')!.disabled
    const nextDisabled = nextLoading.container.querySelector('button')!.disabled
    expect(nextDisabled).toBe(legacyDisabled)
  })
})
