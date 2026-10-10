import { describe, expect, it } from 'vite-plus/test'
import {
  assertCucumberScenariosStarted,
  collectScenarioResults,
  countStartedCucumberScenarios,
} from '../support/cucumber-messages'

describe('countStartedCucumberScenarios', () => {
  it('counts test case start messages', () => {
    const report = [
      JSON.stringify({ meta: { protocolVersion: '32.3.1' } }),
      JSON.stringify({ testCaseStarted: { id: 'first' } }),
      JSON.stringify({ testCaseStarted: { id: 'second' } }),
      '',
    ].join('\n')

    expect(countStartedCucumberScenarios(report)).toBe(2)
  })

  it('returns zero when the selector starts no scenarios', () => {
    const report = [
      JSON.stringify({ meta: { protocolVersion: '32.3.1' } }),
      JSON.stringify({ testRunStarted: { timestamp: {} } }),
      JSON.stringify({ testRunFinished: { timestamp: {} } }),
    ].join('\n')

    expect(countStartedCucumberScenarios(report)).toBe(0)
    expect(() => assertCucumberScenariosStarted(report)).toThrow(
      'Cucumber selected zero scenarios.',
    )
  })
})

const line = (value: unknown) => JSON.stringify(value)

describe('collectScenarioResults', () => {
  it('collects per-scenario verdicts keyed by uri and name', () => {
    const report = [
      line({ meta: { protocolVersion: '32.3.1' } }),
      line({ pickle: { id: 'p1', uri: 'features/chat.feature', name: 'Scenario one' } }),
      line({ pickle: { id: 'p2', uri: 'features/chat.feature', name: 'Scenario one' } }),
      line({ testCase: { id: 'tc1', pickleId: 'p1' } }),
      line({ testCase: { id: 'tc2', pickleId: 'p2' } }),
      line({ testCaseStarted: { id: 'tcs1', testCaseId: 'tc1' } }),
      line({
        testStepFinished: { testCaseStartedId: 'tcs1', testStepResult: { status: 'PASSED' } },
      }),
      line({ testCaseFinished: { testCaseStartedId: 'tcs1' } }),
      line({ testCaseStarted: { id: 'tcs2', testCaseId: 'tc2' } }),
      line({
        testStepFinished: { testCaseStartedId: 'tcs2', testStepResult: { status: 'PASSED' } },
      }),
      line({
        testStepFinished: { testCaseStartedId: 'tcs2', testStepResult: { status: 'FAILED' } },
      }),
      line({ testCaseFinished: { testCaseStartedId: 'tcs2' } }),
      '',
    ].join('\n')

    expect(collectScenarioResults(report)).toEqual([
      {
        key: 'features/chat.feature::Scenario one',
        uri: 'features/chat.feature',
        name: 'Scenario one',
        status: 'passed',
        passed: true,
      },
      {
        key: 'features/chat.feature::Scenario one#2',
        uri: 'features/chat.feature',
        name: 'Scenario one',
        status: 'failed',
        passed: false,
      },
    ])
  })

  it('keeps the last attempt verdict when a scenario is retried', () => {
    const report = [
      line({ pickle: { id: 'p1', uri: 'features/chat.feature', name: 'Flaky scenario' } }),
      line({ testCase: { id: 'tc1', pickleId: 'p1' } }),
      line({ testCaseStarted: { id: 'tcs1', testCaseId: 'tc1' } }),
      line({
        testStepFinished: { testCaseStartedId: 'tcs1', testStepResult: { status: 'FAILED' } },
      }),
      line({ testCaseFinished: { testCaseStartedId: 'tcs1' } }),
      line({ testCaseStarted: { id: 'tcs2', testCaseId: 'tc1' } }),
      line({
        testStepFinished: { testCaseStartedId: 'tcs2', testStepResult: { status: 'PASSED' } },
      }),
      line({ testCaseFinished: { testCaseStartedId: 'tcs2' } }),
    ].join('\n')

    expect(collectScenarioResults(report)).toEqual([
      {
        key: 'features/chat.feature::Flaky scenario',
        uri: 'features/chat.feature',
        name: 'Flaky scenario',
        status: 'passed',
        passed: true,
      },
    ])
  })

  it('marks started scenarios without finished steps as unknown', () => {
    const report = [
      line({ pickle: { id: 'p1', uri: 'features/chat.feature', name: 'Interrupted scenario' } }),
      line({ testCase: { id: 'tc1', pickleId: 'p1' } }),
      line({ testCaseStarted: { id: 'tcs1', testCaseId: 'tc1' } }),
    ].join('\n')

    expect(collectScenarioResults(report)).toEqual([
      {
        key: 'features/chat.feature::Interrupted scenario',
        uri: 'features/chat.feature',
        name: 'Interrupted scenario',
        status: 'unknown',
        passed: false,
      },
    ])
  })
})
