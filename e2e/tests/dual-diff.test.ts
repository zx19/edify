import type { CollectedScenarioResult } from '../support/cucumber-messages'
import type { TrackRunSummary } from '../support/dual-diff'
import { describe, expect, it } from 'vite-plus/test'
import { buildDualDiffReport, missingScenarioStatus } from '../support/dual-diff'

const result = (uri: string, name: string, status: string): CollectedScenarioResult => ({
  key: `${uri}::${name}`,
  uri,
  name,
  status: status as CollectedScenarioResult['status'],
  passed: status === 'passed',
})

const trackSummary = (
  track: 'old' | 'new',
  exitCode: number,
  scenarioCount: number,
): TrackRunSummary => ({
  track,
  baseURL: track === 'new' ? 'http://127.0.0.1:3001' : 'http://127.0.0.1:3000',
  exitCode,
  scenarioCount,
})

const buildReport = (
  oldScenarios: CollectedScenarioResult[],
  newScenarios: CollectedScenarioResult[],
  exitCodes: { old: number; new: number } = { old: 0, new: 0 },
) =>
  buildDualDiffReport({
    oldRun: {
      summary: trackSummary('old', exitCodes.old, oldScenarios.length),
      scenarios: oldScenarios,
    },
    newRun: {
      summary: trackSummary('new', exitCodes.new, newScenarios.length),
      scenarios: newScenarios,
    },
    generatedAt: '2026-10-10T00:00:00.000Z',
    commit: 'deadbeef',
  })

describe('buildDualDiffReport', () => {
  it('reports full alignment when both tracks agree on every scenario verdict', () => {
    const report = buildReport(
      [
        result('features/chat.feature', 'sends a message', 'passed'),
        result('features/chat.feature', 'rejects empty input', 'failed'),
      ],
      [
        result('features/chat.feature', 'sends a message', 'passed'),
        result('features/chat.feature', 'rejects empty input', 'failed'),
      ],
      { old: 1, new: 1 },
    )

    expect(report.aligned).toBe(true)
    expect(report.diffs).toEqual([])
    expect(report.summary).toEqual({
      total: 2,
      aligned: 2,
      diff: 0,
      missingInOld: 0,
      missingInNew: 0,
    })
    expect(report.scenarios.map((scenario) => scenario.key)).toEqual([
      'features/chat.feature::sends a message',
      'features/chat.feature::rejects empty input',
    ])
    expect(report.generatedAt).toBe('2026-10-10T00:00:00.000Z')
    expect(report.commit).toBe('deadbeef')
  })

  it('lists scenarios whose verdicts diverge between tracks', () => {
    const report = buildReport(
      [
        result('features/chat.feature', 'sends a message', 'passed'),
        result('features/chat.feature', 'persists the conversation', 'passed'),
      ],
      [
        result('features/chat.feature', 'sends a message', 'passed'),
        result('features/chat.feature', 'persists the conversation', 'failed'),
      ],
      { old: 0, new: 1 },
    )

    expect(report.aligned).toBe(false)
    expect(report.summary).toEqual({
      total: 2,
      aligned: 1,
      diff: 1,
      missingInOld: 0,
      missingInNew: 0,
    })
    expect(report.diffs).toEqual([
      {
        key: 'features/chat.feature::persists the conversation',
        uri: 'features/chat.feature',
        name: 'persists the conversation',
        oldStatus: 'passed',
        newStatus: 'failed',
        aligned: false,
      },
    ])
    expect(report.scenarios).toHaveLength(2)
    expect(report.scenarios[0]?.aligned).toBe(true)
  })

  it('flags scenarios missing from one track', () => {
    const report = buildReport(
      [result('features/chat.feature', 'sends a message', 'passed')],
      [
        result('features/chat.feature', 'sends a message', 'passed'),
        result('features/chat.feature', 'opens the drawer', 'passed'),
      ],
    )

    expect(report.aligned).toBe(false)
    expect(report.summary).toEqual({
      total: 2,
      aligned: 1,
      diff: 1,
      missingInOld: 1,
      missingInNew: 0,
    })
    expect(report.diffs).toEqual([
      {
        key: 'features/chat.feature::opens the drawer',
        uri: 'features/chat.feature',
        name: 'opens the drawer',
        oldStatus: missingScenarioStatus,
        newStatus: 'passed',
        aligned: false,
      },
    ])
    // Old-track order is preserved; new-only scenarios are appended.
    expect(report.scenarios.map((scenario) => scenario.key)).toEqual([
      'features/chat.feature::sends a message',
      'features/chat.feature::opens the drawer',
    ])
  })

  it('flags scenarios missing from the new track', () => {
    const report = buildReport(
      [
        result('features/chat.feature', 'sends a message', 'passed'),
        result('features/chat.feature', 'uses a legacy sidebar', 'passed'),
      ],
      [result('features/chat.feature', 'sends a message', 'passed')],
    )

    expect(report.aligned).toBe(false)
    expect(report.summary.missingInNew).toBe(1)
    expect(report.diffs[0]).toMatchObject({
      oldStatus: 'passed',
      newStatus: missingScenarioStatus,
      aligned: false,
    })
  })
})
