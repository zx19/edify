// 双轨 parity：新版 @xsl/ui/select vs 旧版 @langgenius/dify-ui/select
// 口径同 button parity（执行计划 v2 §5.2 + §E.3 normalize 规则：剥随机 id/aria 引用，保留结构/class/文本）。
import {
  SelectContent as LegacyContent,
  SelectItem as LegacyItem,
  SelectItemIndicator as LegacyItemIndicator,
  SelectItemText as LegacyItemText,
  Select as LegacySelect,
  SelectTrigger as LegacyTrigger,
  SelectValue as LegacyValue,
} from '@langgenius/dify-ui/select'
import { page } from 'vite-plus/test/browser'
import { render } from 'vitest-browser-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '../index'

// base-ui 生成的随机 id / aria 引用在归一化中剥离（§E.3：保留语义结构，去动态值）
function normalize(html: string) {
  return html.replace(
    /\s(id|aria-controls|aria-labelledby|aria-describedby|aria-owns|aria-activedescendant|for)="[^"]*"/g,
    '',
  )
}

function triggerHTML(screen: { container: HTMLElement }) {
  const el = screen.container.querySelector('button')
  if (!el) throw new Error('select trigger not rendered')
  return normalize(el.outerHTML)
}

function popupHTML() {
  const popup = document.body.querySelector('[role="listbox"]')
  if (!popup) throw new Error('select popup not rendered')
  return normalize(popup.outerHTML)
}

type SelectProps = {
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
  open?: boolean
  onValueChange?: (value: string | null) => void
}

function renderLegacy(props: SelectProps = {}) {
  return render(
    <div style={{ minHeight: '100vh', minWidth: '100vw', padding: '240px' }}>
      <LegacySelect defaultValue="seattle" {...props}>
        <LegacyTrigger aria-label="city select">
          <LegacyValue />
        </LegacyTrigger>
        <LegacyContent>
          <LegacyItem value="seattle">
            <LegacyItemText>Seattle</LegacyItemText>
            <LegacyItemIndicator />
          </LegacyItem>
          <LegacyItem value="new-york">
            <LegacyItemText>New York</LegacyItemText>
            <LegacyItemIndicator />
          </LegacyItem>
        </LegacyContent>
      </LegacySelect>
    </div>,
  )
}

function renderNext(props: SelectProps = {}) {
  return render(
    <div style={{ minHeight: '100vh', minWidth: '100vw', padding: '240px' }}>
      <Select defaultValue="seattle" {...props}>
        <SelectTrigger aria-label="city select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="seattle">
            <SelectItemText>Seattle</SelectItemText>
            <SelectItemIndicator />
          </SelectItem>
          <SelectItem value="new-york">
            <SelectItemText>New York</SelectItemText>
            <SelectItemIndicator />
          </SelectItem>
        </SelectContent>
      </Select>
    </div>,
  )
}

describe('Select 双轨 parity', () => {
  for (const size of ['small', 'medium', 'large'] as const) {
    it(`DOM diff = 0 @ size ${size}（收起态 trigger）`, async () => {
      const legacy = await renderLegacy({ size })
      const next = await renderNext({ size })
      expect(triggerHTML(next)).toBe(triggerHTML(legacy))
      await legacy.unmount()
      await next.unmount()
    })
  }

  it('DOM diff = 0 @ disabled 收起态', async () => {
    const legacy = await renderLegacy({ disabled: true })
    const next = await renderNext({ disabled: true })
    expect(triggerHTML(next)).toBe(triggerHTML(legacy))
    await legacy.unmount()
    await next.unmount()
  })

  it('DOM diff = 0 @ 展开态 popup（portal 内容，normalize 后）', async () => {
    const legacy = await renderLegacy({ open: true })
    await expect.element(page.getByRole('listbox')).toBeVisible()
    const legacyHTML = popupHTML()
    await legacy.unmount()
    const next = await renderNext({ open: true })
    await expect.element(page.getByRole('listbox')).toBeVisible()
    expect(popupHTML()).toBe(legacyHTML)
    await next.unmount()
  })

  it('行为快照全等：选中项回调值一致', async () => {
    const values: (string | null)[] = []
    const legacy = await renderLegacy({ open: true, onValueChange: (v) => values.push(v) })
    await page.getByText('New York').click()
    await legacy.unmount()

    const next = await renderNext({ open: true, onValueChange: (v) => values.push(v) })
    await page.getByText('New York').click()
    await next.unmount()

    expect(values).toEqual(['new-york', 'new-york'])
  })
})
