import type { ConversationItem } from '@/models/share'

const DAY_MS = 24 * 60 * 60 * 1000

function startOfToday(now: number): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** D2:按 created_at(秒级 epoch)分 今天/昨天/更早;缺时间的进「更早」。 */
export function groupConversationsByTime(
  list: ConversationItem[],
  now = Date.now(),
): { today: ConversationItem[]; yesterday: ConversationItem[]; earlier: ConversationItem[] } {
  const t0 = startOfToday(now)
  const y0 = t0 - DAY_MS
  const today: ConversationItem[] = []
  const yesterday: ConversationItem[] = []
  const earlier: ConversationItem[] = []
  for (const it of list) {
    const ts = (it.created_at ?? 0) * 1000
    if (ts >= t0) today.push(it)
    else if (ts >= y0) yesterday.push(it)
    else earlier.push(it)
  }
  return { today, yesterday, earlier }
}

/** D1:名称子串过滤(前端,范围=已加载列表;分页上限 20 见设计档 §9 待核项)。 */
export function filterConversationsByName(
  list: ConversationItem[],
  query: string,
): ConversationItem[] {
  const kw = query.trim()
  if (!kw) return list
  return list.filter((i) => i.name.includes(kw))
}
