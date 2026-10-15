import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { isValidEditorConnection } from '../is-valid-connection'

afterEach(cleanup)

describe('isValidEditorConnection(C3 连线校验)', () => {
  const edges = [
    { id: 'e1', source: 'a', target: 'b', sourceHandle: 'source', targetHandle: 'target' },
  ]

  it('禁自环', () => {
    expect(isValidEditorConnection({ source: 'a', target: 'a' }, edges)).toBe(false)
  })

  it('禁同向重复边(同 source/target/handle)', () => {
    expect(isValidEditorConnection({ source: 'a', target: 'b' }, edges)).toBe(false)
  })

  it('允许反向边与不同 handle 的边', () => {
    expect(isValidEditorConnection({ source: 'b', target: 'a' }, edges)).toBe(true)
    expect(isValidEditorConnection({ source: 'a', target: 'b', sourceHandle: 'else' }, edges)).toBe(
      true,
    )
    expect(isValidEditorConnection({ source: 'a', target: 'c' }, edges)).toBe(true)
  })

  it('source/target 缺失为非法', () => {
    expect(isValidEditorConnection({ source: null, target: 'b' }, edges)).toBe(false)
    expect(isValidEditorConnection({ source: 'a', target: null }, edges)).toBe(false)
  })
})
