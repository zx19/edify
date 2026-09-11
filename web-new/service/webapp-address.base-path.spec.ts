import { describe, expect, it, vi } from 'vite-plus/test'

// 模拟子路径部署的构建期 basePath（默认 ''，此处强制为 /lomva）
vi.mock('@/utils/var', () => ({ basePath: '/lomva' }))

import { parseWebAppAddress } from './webapp-address'

describe('parseWebAppAddress with basePath', () => {
  it('strips the Next basePath before parsing', () => {
    expect(parseWebAppAddress('/lomva/chat/abc123')).toEqual({ kind: 'default', code: 'abc123' })
    expect(parseWebAppAddress('/lomva/env/workflow/wf-app')).toEqual({
      kind: 'environment',
      code: 'wf-app',
    })
  })

  it('keeps basePath-free paths working', () => {
    expect(parseWebAppAddress('/chat/abc123')).toEqual({ kind: 'default', code: 'abc123' })
  })

  it('does not strip a lookalike segment prefix', () => {
    expect(parseWebAppAddress('/lomvax/chat/abc')).toBeNull()
  })

  it('still rejects malformed sub-path addresses', () => {
    expect(parseWebAppAddress('/lomva/chat')).toBeNull()
    expect(parseWebAppAddress('/lomva/chat/abc/extra')).toBeNull()
  })
})
