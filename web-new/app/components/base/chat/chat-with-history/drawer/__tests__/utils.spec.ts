import type { ConversationItem } from '@/models/share'
import { filterConversationsByName, groupConversationsByTime } from '../utils'

const item = (id: string, name: string, created_at?: number): ConversationItem => ({
  id,
  name,
  inputs: {},
  introduction: '',
  created_at: created_at ?? null,
})

describe('groupConversationsByTime', () => {
  // 2026-09-25 12:00 local
  const now = new Date(2026, 8, 25, 12, 0, 0).getTime()
  const sec = (ms: number) => Math.floor(ms / 1000)

  it('按 今天/昨天/更早 分组,created_at 缺失进更早', () => {
    const today = new Date(2026, 8, 25, 1, 0, 0).getTime()
    const yesterday = new Date(2026, 8, 24, 23, 0, 0).getTime()
    const old = new Date(2026, 8, 1, 10, 0, 0).getTime()
    const r = groupConversationsByTime(
      [
        item('a', '今天会话', sec(today)),
        item('b', '昨天会话', sec(yesterday)),
        item('c', '旧会话', sec(old)),
        item('d', '无时间会话'),
      ],
      now,
    )
    expect(r.today.map((i) => i.id)).toEqual(['a'])
    expect(r.yesterday.map((i) => i.id)).toEqual(['b'])
    expect(r.earlier.map((i) => i.id)).toEqual(['c', 'd'])
  })

  it('空列表返回三个空组', () => {
    expect(groupConversationsByTime([], now)).toEqual({ today: [], yesterday: [], earlier: [] })
  })
})

describe('filterConversationsByName', () => {
  const list = [item('1', '理赔材料清单'), item('2', '退保流程')]
  it('按子串过滤;空串返回原列表', () => {
    expect(filterConversationsByName(list, '理赔').map((i) => i.id)).toEqual(['1'])
    expect(filterConversationsByName(list, '  ')).toHaveLength(2)
    expect(filterConversationsByName(list, '')).toBe(list)
  })
})
