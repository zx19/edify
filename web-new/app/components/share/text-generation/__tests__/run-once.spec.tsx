import type { PromptConfig } from '@/models/debug'
import type { SiteInfo } from '@/models/share'
import type { VisionSettings } from '@/types/app'
import { render, screen } from '@testing-library/react'
import RunOnce from '../run-once'

/** 最小夹具：RunOnce 为纯 props 组件（无 context） */
const siteInfo = {
  title: 'App',
  icon: '',
  icon_type: 'emoji',
} as SiteInfo

const promptConfig = {
  prompt_variables: [
    { key: 'query', name: '问题', type: 'string', required: true },
    { key: 'flag', name: '确认', type: 'checkbox', required: false },
  ],
} as unknown as PromptConfig

const renderRunOnce = () =>
  render(
    <RunOnce
      siteInfo={siteInfo}
      promptConfig={promptConfig}
      inputs={{ query: '', flag: false }}
      inputsRef={{ current: { query: '', flag: false } }}
      onInputsChange={() => {}}
      onSend={() => {}}
      visionConfig={{ enabled: false } as unknown as VisionSettings}
      onVisionFilesChange={() => {}}
      runControl={null}
    />,
  )

describe('RunOnce 操作条（v2：桌面 sticky 沉底，移动静态）', () => {
  it('清空/运行操作条带 @[900px]:sticky bottom-0（容器查询退化由壳层携带）', () => {
    renderRunOnce()

    const bar = screen.getByRole('button', { name: 'common.operation.clear' }).parentElement!
    expect(bar.className).toContain('@[900px]:sticky')
    expect(bar.className).toContain('@[900px]:bottom-0')
  })

  it('运行/清空双钮渲染（行为不变式回归）', () => {
    renderRunOnce()

    expect(screen.getByRole('button', { name: 'common.operation.clear' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /generation\.run|operation\.run/ }),
    ).toBeInTheDocument()
  })
})
