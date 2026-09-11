// 双轨对照 stories（执行计划 v2 §5.2 视觉层）：同 props 渲染旧版（@langgenius/dify-ui）
// 与新版（@xsl/lomva-ui）Button 并排——screenshot:diff 脚本（W3）对两列截图做像素比对。
// 无作用域类挂载 = 两版都应呈现 Dify 现行视觉（§4 token 注记：新值仅在三主题类下覆盖）。
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Button as LegacyButton } from '@langgenius/dify-ui/button'
import { Button as NewButton } from '@xsl/lomva-ui/button'
import { Fragment } from 'react'

const variants = [
  'primary',
  'secondary',
  'secondary-accent',
  'tertiary',
  'ghost',
  'ghost-accent',
] as const
const sizes = ['small', 'medium', 'large'] as const
const tones = ['default', 'destructive'] as const

const meta = {
  title: 'DoubleTrack/Button',
  parameters: { layout: 'padded' },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const ParityMatrix: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr 1fr',
        gap: '12px 16px',
        alignItems: 'center',
      }}
    >
      <strong>props</strong>
      <strong>legacy（dify-ui）</strong>
      <strong>new（@xsl/lomva-ui）</strong>
      {variants.flatMap((variant) =>
        sizes.flatMap((size) =>
          tones.map((tone) => (
            <Fragment key={`${variant}-${size}-${tone}`}>
              <code>{`${variant} / ${size} / ${tone}`}</code>
              <span>
                <LegacyButton variant={variant} size={size} tone={tone}>
                  对照样本
                </LegacyButton>
              </span>
              <span>
                <NewButton variant={variant} size={size} tone={tone}>
                  对照样本
                </NewButton>
              </span>
            </Fragment>
          )),
        ),
      )}
      <code>loading</code>
      <span>
        <LegacyButton loading>对照样本</LegacyButton>
      </span>
      <span>
        <NewButton loading>对照样本</NewButton>
      </span>
      <code>disabled</code>
      <span>
        <LegacyButton disabled>对照样本</LegacyButton>
      </span>
      <span>
        <NewButton disabled>对照样本</NewButton>
      </span>
    </div>
  ),
}
