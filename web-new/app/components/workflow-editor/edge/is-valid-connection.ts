/** C3 连线校验:禁自环、禁同向重复边 */
export function isValidEditorConnection(
  conn: {
    source: string | null
    target: string | null
    sourceHandle?: string | null
    targetHandle?: string | null
  },
  edges: {
    id: string
    source: string
    target: string
    sourceHandle?: string | null
    targetHandle?: string | null
  }[],
) {
  if (!conn.source || !conn.target) return false
  if (conn.source === conn.target) return false
  return !edges.some(
    (e) =>
      e.source === conn.source &&
      e.target === conn.target &&
      (e.sourceHandle ?? 'source') === (conn.sourceHandle ?? 'source') &&
      (e.targetHandle ?? 'target') === (conn.targetHandle ?? 'target'),
  )
}
