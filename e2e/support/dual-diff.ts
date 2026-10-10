import type { CollectedScenarioResult } from './cucumber-messages'
import type { E2EWebTrack } from './track'

export const missingScenarioStatus = 'missing'

export type TrackRunSummary = {
  track: E2EWebTrack
  baseURL: string
  exitCode: number
  scenarioCount: number
}

export type TrackRunResults = {
  summary: TrackRunSummary
  scenarios: CollectedScenarioResult[]
}

export type ScenarioComparison = {
  key: string
  uri: string
  name: string
  oldStatus: string
  newStatus: string
  aligned: boolean
}

export type DualDiffReport = {
  version: 1
  generatedAt: string
  commit: string | null
  tracks: {
    old: TrackRunSummary
    new: TrackRunSummary
  }
  summary: {
    total: number
    aligned: number
    diff: number
    missingInOld: number
    missingInNew: number
  }
  /** True when every scenario has the same verdict on both tracks (contract diff = 0). */
  aligned: boolean
  scenarios: ScenarioComparison[]
  diffs: ScenarioComparison[]
}

/**
 * Aligns per-scenario verdicts from the two tracks. Alignment is exact status
 * equality: any divergence — including a scenario executed on only one track —
 * is a contract diff that must be fixed or registered with a waiver.
 */
export const buildDualDiffReport = ({
  oldRun,
  newRun,
  generatedAt,
  commit = null,
}: {
  oldRun: TrackRunResults
  newRun: TrackRunResults
  generatedAt: string
  commit?: string | null
}): DualDiffReport => {
  const oldByKey = new Map(oldRun.scenarios.map((scenario) => [scenario.key, scenario]))
  const newByKey = new Map(newRun.scenarios.map((scenario) => [scenario.key, scenario]))

  const orderedKeys: string[] = []
  for (const scenario of oldRun.scenarios) orderedKeys.push(scenario.key)
  for (const scenario of newRun.scenarios) {
    if (!oldByKey.has(scenario.key)) orderedKeys.push(scenario.key)
  }

  const scenarios: ScenarioComparison[] = orderedKeys.map((key) => {
    const oldScenario = oldByKey.get(key)
    const newScenario = newByKey.get(key)
    const reference = oldScenario ?? newScenario!

    const oldStatus = oldScenario?.status ?? missingScenarioStatus
    const newStatus = newScenario?.status ?? missingScenarioStatus

    return {
      key,
      uri: reference.uri,
      name: reference.name,
      oldStatus,
      newStatus,
      aligned: oldScenario !== undefined && newScenario !== undefined && oldStatus === newStatus,
    }
  })

  const diffs = scenarios.filter((scenario) => !scenario.aligned)

  return {
    version: 1,
    generatedAt,
    commit,
    tracks: {
      old: oldRun.summary,
      new: newRun.summary,
    },
    summary: {
      total: scenarios.length,
      aligned: scenarios.length - diffs.length,
      diff: diffs.length,
      missingInOld: diffs.filter((scenario) => scenario.oldStatus === missingScenarioStatus).length,
      missingInNew: diffs.filter((scenario) => scenario.newStatus === missingScenarioStatus).length,
    },
    aligned: diffs.length === 0,
    scenarios,
    diffs,
  }
}
