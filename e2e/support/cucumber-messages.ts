type CucumberMessage = {
  testCaseStarted?: unknown
}

export const countStartedCucumberScenarios = (contents: string) =>
  contents
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CucumberMessage)
    .filter((message) => message.testCaseStarted !== undefined).length

export const assertCucumberScenariosStarted = (contents: string) => {
  const started = countStartedCucumberScenarios(contents)

  if (started === 0)
    throw new Error('Cucumber selected zero scenarios. Check the active tag expression and paths.')
}

export type CucumberScenarioStatus =
  | 'unknown'
  | 'passed'
  | 'skipped'
  | 'pending'
  | 'undefined'
  | 'ambiguous'
  | 'failed'

export type CollectedScenarioResult = {
  /** Stable cross-run identifier: `<uri>::<name>` with a `#<n>` suffix for repeats. */
  key: string
  uri: string
  name: string
  status: CucumberScenarioStatus
  passed: boolean
}

type Envelope = Record<string, unknown>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

// Severity ordering follows Cucumber's own worst-result semantics: a failed
// step dominates every other outcome.
const statusSeverity: Record<CucumberScenarioStatus, number> = {
  passed: 0,
  unknown: 1,
  skipped: 2,
  pending: 3,
  undefined: 4,
  ambiguous: 5,
  failed: 6,
}

const normalizeStatus = (value: unknown): CucumberScenarioStatus => {
  if (typeof value !== 'string') return 'unknown'

  const normalized = value.toLowerCase() as CucumberScenarioStatus
  return normalized in statusSeverity ? normalized : 'unknown'
}

const worstStatus = (statuses: CucumberScenarioStatus[]): CucumberScenarioStatus => {
  let worst: CucumberScenarioStatus | undefined
  for (const status of statuses) {
    if (worst === undefined || statusSeverity[status] > statusSeverity[worst]) worst = status
  }

  return worst ?? 'unknown'
}

/**
 * Reduces a Cucumber Messages (ndjson) report to one verdict per executed
 * scenario. Keys are stable across runs of the same feature files: pickle ids
 * are random per run, so identity comes from `uri + name` with an occurrence
 * suffix for scenario-outline rows sharing a name. When a scenario is retried,
 * the last attempt's verdict wins, matching Cucumber's own summary semantics.
 */
export const collectScenarioResults = (contents: string): CollectedScenarioResult[] => {
  const pickles = new Map<string, { key: string; uri: string; name: string }>()
  const pickleOrder: string[] = []
  const pickleOccurrences = new Map<string, number>()
  const testCaseToPickle = new Map<string, string>()
  const startedToPickle = new Map<string, string>()
  const attemptStatuses = new Map<string, CucumberScenarioStatus[]>()
  const resultsByPickle = new Map<string, CollectedScenarioResult>()

  for (const line of contents.split(/\r?\n/)) {
    if (!line) continue

    const envelope = JSON.parse(line) as Envelope

    if (isRecord(envelope.pickle)) {
      const { id, uri, name } = envelope.pickle
      if (typeof id !== 'string' || typeof uri !== 'string' || typeof name !== 'string') continue

      const identity = `${uri}::${name}`
      const occurrence = (pickleOccurrences.get(identity) ?? 0) + 1
      pickleOccurrences.set(identity, occurrence)
      const key = occurrence === 1 ? identity : `${identity}#${occurrence}`

      pickles.set(id, { key, uri, name })
      pickleOrder.push(id)
      continue
    }

    if (isRecord(envelope.testCase)) {
      const { id, pickleId } = envelope.testCase
      if (typeof id === 'string' && typeof pickleId === 'string') testCaseToPickle.set(id, pickleId)
      continue
    }

    if (isRecord(envelope.testCaseStarted)) {
      const { id, testCaseId } = envelope.testCaseStarted
      if (typeof id !== 'string' || typeof testCaseId !== 'string') continue

      const pickleId = testCaseToPickle.get(testCaseId)
      if (!pickleId) continue

      startedToPickle.set(id, pickleId)
      attemptStatuses.set(id, [])
      continue
    }

    if (isRecord(envelope.testStepFinished)) {
      const { testCaseStartedId, testStepResult } = envelope.testStepFinished
      if (typeof testCaseStartedId !== 'string') continue

      const statuses = attemptStatuses.get(testCaseStartedId)
      if (!statuses) continue

      statuses.push(normalizeStatus(isRecord(testStepResult) ? testStepResult.status : undefined))
      continue
    }
  }

  // Resolve attempts in stream order so later attempts overwrite earlier ones.
  for (const [startedId, statuses] of attemptStatuses) {
    const pickleId = startedToPickle.get(startedId)
    const pickle = pickleId ? pickles.get(pickleId) : undefined
    if (!pickleId || !pickle) continue

    const status = worstStatus(statuses)
    resultsByPickle.set(pickleId, {
      key: pickle.key,
      uri: pickle.uri,
      name: pickle.name,
      status,
      passed: status === 'passed',
    })
  }

  const results: CollectedScenarioResult[] = []
  for (const pickleId of pickleOrder) {
    const result = resultsByPickle.get(pickleId)
    if (result) results.push(result)
  }

  return results
}
