import type { CollectedScenarioResult } from '../support/cucumber-messages'
import type { ManagedProcess } from '../support/process'
import type { E2EWebTrack } from '../support/track'
import type { SeedOptions } from './seed-runner'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { runCleanupTasks } from '../support/cleanup'
import {
  assertCucumberScenariosStarted,
  collectScenarioResults,
} from '../support/cucumber-messages'
import { buildDualDiffReport } from '../support/dual-diff'
import { startLoggedProcess, stopManagedProcess, waitForUrl } from '../support/process'
import { defaultBaseURLForTrack, supportedWebTracks } from '../support/track'
import { startWebServer, stopWebServer } from '../support/web-server'
import { apiURL, baseURL, llmStubBaseURL, reuseExistingWebServer } from '../test-env'
import { e2eDir, isMainModule, rootDir, runCommand } from './common'
import { parseRunOptions, shouldStartManagedAgentBackend } from './run-options'
import { runSeed } from './seed-runner'
import { resetState, startMiddleware, stopMiddleware } from './setup'
import './env-register'

const hasCustomTags = (forwardArgs: string[]) =>
  forwardArgs.some((arg) => arg === '--tags' || arg.startsWith('--tags='))

const fullNonExternalTags =
  'not @axe and not @prepared and not @external-model and not @external-tool'
const seedCeleryQueues = 'dataset,priority_dataset,workflow_based_app_execution'

const readLogTail = async (logFilePath: string) => {
  const content = await readFile(logFilePath, 'utf8').catch(() => '')

  return content.trim().split(/\r?\n/).slice(-20).join('\n')
}

const waitForUnexpectedProcessExit = async (
  managedProcess: ManagedProcess,
  shouldIgnoreExit: () => boolean,
) => {
  const { childProcess, label, logFilePath } = managedProcess

  await new Promise<void>((resolve) => {
    if (childProcess.exitCode !== null) {
      resolve()
      return
    }

    childProcess.once('exit', () => resolve())
  })

  if (shouldIgnoreExit()) return

  const logTail = await readLogTail(logFilePath)
  const logTailMessage = logTail ? `\n\nLast ${label} log lines:\n${logTail}` : ''

  throw new Error(`${label} exited before becoming ready. See ${logFilePath}.${logTailMessage}`)
}

const waitForManagedProcess = async ({
  errorMessage,
  managedProcess,
  url,
}: {
  errorMessage: string
  managedProcess: ManagedProcess
  url: string
}) => {
  let waiting = true
  try {
    await Promise.race([
      waitForUrl(url, 180_000, 1_000),
      waitForUnexpectedProcessExit(managedProcess, () => !waiting),
    ])
  } catch (error) {
    if (error instanceof Error && error.message.includes('exited before becoming ready'))
      throw error

    throw new Error(`${errorMessage} See ${managedProcess.logFilePath}.`)
  } finally {
    waiting = false
  }
}

type StackRunOptions = {
  forwardArgs: string[]
  full: boolean
  headed: boolean
  seed?: SeedOptions
  seedOnly: boolean
  /** Set for dual-track passes; undefined keeps the ambient single-pass behavior. */
  track?: E2EWebTrack
}

type StackRunResult = {
  cucumberExitCode?: number
  scenarios?: CollectedScenarioResult[]
}

/**
 * Runs one full stack lifecycle: optional reset, middleware, services, web
 * server, optional seed, Cucumber, and teardown. In dual mode each track gets
 * its own pass with per-track logs and a preserved `cucumber-report-<track>`
 * directory; the single-pass path keeps the historical report layout.
 */
const runStackOnce = async ({
  forwardArgs,
  full,
  headed,
  seed,
  seedOnly,
  track,
}: StackRunOptions): Promise<StackRunResult> => {
  const startAgentBackendForRun = shouldStartManagedAgentBackend()
  const cucumberReportDir = path.join(e2eDir, 'cucumber-report')
  const logDir = path.join(e2eDir, '.logs')
  const logSuffix = track ? `-${track}` : ''
  const webServerBaseURL = track ? defaultBaseURLForTrack(track) : baseURL
  let apiProcess: ManagedProcess | undefined
  let celeryProcess: ManagedProcess | undefined
  let difyAgentProcess: ManagedProcess | undefined
  let llmStubProcess: ManagedProcess | undefined
  let middlewareStarted = false
  let shellctlProcess: ManagedProcess | undefined

  let cleanupPromise: Promise<void> | undefined
  const cleanup = async () => {
    if (!cleanupPromise) {
      cleanupPromise = (async () => {
        const cleanupErrors = await runCleanupTasks([
          { label: 'Stop web server', run: stopWebServer },
          { label: 'Stop celery worker', run: () => stopManagedProcess(celeryProcess) },
          { label: 'Stop API server', run: () => stopManagedProcess(apiProcess) },
          { label: 'Stop agent backend', run: () => stopManagedProcess(difyAgentProcess) },
          { label: 'Stop LLM stub', run: () => stopManagedProcess(llmStubProcess) },
          { label: 'Stop shellctl sandbox', run: () => stopManagedProcess(shellctlProcess) },
          ...(middlewareStarted ? [{ label: 'Stop middleware', run: stopMiddleware }] : []),
        ])

        if (cleanupErrors.length > 0)
          throw new Error(`E2E teardown errors:\n${cleanupErrors.join('\n')}`)
      })()
    }

    await cleanupPromise
  }

  const onTerminate = () => {
    void cleanup()
      .catch((error) => {
        console.error(error instanceof Error ? error.message : String(error))
      })
      .finally(() => {
        process.exit(1)
      })
  }

  process.once('SIGINT', onTerminate)
  process.once('SIGTERM', onTerminate)

  try {
    if (full) await resetState()

    if (full) {
      middlewareStarted = true
      await startMiddleware()
    }

    if (!seedOnly) await rm(cucumberReportDir, { force: true, recursive: true })
    await mkdir(logDir, { recursive: true })

    llmStubProcess = await startLoggedProcess({
      command: 'npx',
      args: ['tsx', './scripts/setup.ts', 'llm-stub'],
      cwd: e2eDir,
      label: 'llm stub',
      logFilePath: path.join(logDir, `cucumber-llm-stub${logSuffix}.log`),
    })
    await waitForManagedProcess({
      errorMessage: 'LLM stub did not become ready.',
      managedProcess: llmStubProcess,
      url: `${llmStubBaseURL}/health`,
    })

    if (startAgentBackendForRun) {
      shellctlProcess = await startLoggedProcess({
        command: 'npx',
        args: ['tsx', './scripts/setup.ts', 'shellctl-sandbox'],
        cwd: e2eDir,
        label: 'shellctl sandbox',
        logFilePath: path.join(logDir, `cucumber-shellctl-sandbox${logSuffix}.log`),
      })
      const shellctlPort = process.env.E2E_SHELLCTL_PORT || '5004'
      await waitForManagedProcess({
        errorMessage: 'Shellctl sandbox did not become ready.',
        managedProcess: shellctlProcess,
        url: `http://127.0.0.1:${shellctlPort}/healthz`,
      })

      difyAgentProcess = await startLoggedProcess({
        command: 'npx',
        args: ['tsx', './scripts/setup.ts', 'agent-backend'],
        cwd: e2eDir,
        env: { E2E_START_AGENT_BACKEND: '1' },
        label: 'agent backend',
        logFilePath: path.join(logDir, `cucumber-agent-backend${logSuffix}.log`),
      })
      const agentBackendPort = process.env.E2E_AGENT_BACKEND_PORT || '5050'
      await waitForManagedProcess({
        errorMessage: 'Agent backend did not become ready.',
        managedProcess: difyAgentProcess,
        url: `http://127.0.0.1:${agentBackendPort}/openapi.json`,
      })
    }

    apiProcess = await startLoggedProcess({
      command: 'npx',
      args: ['tsx', './scripts/setup.ts', 'api'],
      cwd: e2eDir,
      env: startAgentBackendForRun ? { E2E_START_AGENT_BACKEND: '1' } : undefined,
      label: 'api server',
      logFilePath: path.join(logDir, `cucumber-api${logSuffix}.log`),
    })
    await waitForManagedProcess({
      errorMessage: `API did not become ready at ${apiURL}/health.`,
      managedProcess: apiProcess,
      url: `${apiURL}/health`,
    })

    celeryProcess = await startLoggedProcess({
      command: 'npx',
      args: [
        'tsx',
        './scripts/setup.ts',
        'celery',
        ...(seed ? ['--queues', seedCeleryQueues] : []),
      ],
      cwd: e2eDir,
      label: 'celery worker',
      logFilePath: path.join(logDir, `cucumber-celery${logSuffix}.log`),
    })

    await startWebServer({
      baseURL: webServerBaseURL,
      command: 'npx',
      args: ['tsx', './scripts/setup.ts', 'web'],
      cwd: e2eDir,
      env: track ? { E2E_WEB_TRACK: track } : undefined,
      logFilePath: path.join(logDir, `cucumber-web${logSuffix}.log`),
      // Dual passes must own their web server so each track serves its own build.
      reuseExistingServer: track ? false : reuseExistingWebServer,
      timeoutMs: 300_000,
    })

    if (seed) await runSeed(seed)

    let cucumberExitCode: number | undefined
    let scenarios: CollectedScenarioResult[] | undefined

    if (!seedOnly) {
      const cucumberEnv: NodeJS.ProcessEnv = {
        ...process.env,
        CUCUMBER_HEADLESS: headed ? '0' : '1',
        ...(track ? { E2E_WEB_TRACK: track } : {}),
      }

      if (full && !hasCustomTags(forwardArgs)) cucumberEnv.E2E_CUCUMBER_TAGS = fullNonExternalTags

      const result = await runCommand({
        command: 'npx',
        args: [
          'tsx',
          './node_modules/@cucumber/cucumber/bin/cucumber.js',
          '--config',
          './cucumber.config.ts',
          ...forwardArgs,
        ],
        cwd: e2eDir,
        env: cucumberEnv,
      })
      cucumberExitCode = result.exitCode

      let messages: string | undefined
      try {
        messages = await readFile(path.join(cucumberReportDir, 'report.ndjson'), 'utf8')
      } catch (error) {
        if (result.exitCode === 0) throw error
      }

      if (result.exitCode === 0) assertCucumberScenariosStarted(messages ?? '')

      if (track) {
        scenarios = collectScenarioResults(messages ?? '')
        const preservedReportDir = path.join(e2eDir, `cucumber-report-${track}`)
        await rm(preservedReportDir, { force: true, recursive: true })
        await rename(cucumberReportDir, preservedReportDir).catch(() => undefined)
      }
    }

    return { cucumberExitCode, scenarios }
  } finally {
    process.off('SIGINT', onTerminate)
    process.off('SIGTERM', onTerminate)
    await cleanup()
  }
}

const getGitCommitSha = async () => {
  const result = await runCommand({
    command: 'git',
    args: ['rev-parse', 'HEAD'],
    cwd: rootDir,
    stdio: 'pipe',
  })

  return result.exitCode === 0 ? result.stdout.trim() : null
}

/**
 * Dual-track comparison: runs the same scenario selection on the old track
 * (web/, :3000) and the new track (web-new/, :3001) serially, resetting and
 * reseeding before each pass, then writes the scenario-level contract diff to
 * reports/e2e-dual-diff.json. Exit code is non-zero when either pass fails or
 * any scenario verdict diverges between tracks.
 */
const runDual = async ({
  forwardArgs,
  headed,
  seed,
}: {
  forwardArgs: string[]
  headed: boolean
  seed?: SeedOptions
}) => {
  if (process.env.E2E_BASE_URL)
    throw new Error('--dual manages per-track base URLs (:3000/:3001); unset E2E_BASE_URL.')

  const outcomes = {} as Record<E2EWebTrack, StackRunResult>

  for (const track of supportedWebTracks) {
    console.log(`\n[dual] Starting ${track} track pass (${defaultBaseURLForTrack(track)})...`)
    outcomes[track] = await runStackOnce({
      forwardArgs,
      full: true,
      headed,
      seed,
      seedOnly: false,
      track,
    })
    console.log(
      `[dual] ${track} track pass finished with exit code ${outcomes[track].cucumberExitCode ?? 'unknown'}.`,
    )
  }

  const report = buildDualDiffReport({
    oldRun: {
      summary: {
        track: 'old',
        baseURL: defaultBaseURLForTrack('old'),
        exitCode: outcomes.old.cucumberExitCode ?? 1,
        scenarioCount: outcomes.old.scenarios?.length ?? 0,
      },
      scenarios: outcomes.old.scenarios ?? [],
    },
    newRun: {
      summary: {
        track: 'new',
        baseURL: defaultBaseURLForTrack('new'),
        exitCode: outcomes.new.cucumberExitCode ?? 1,
        scenarioCount: outcomes.new.scenarios?.length ?? 0,
      },
      scenarios: outcomes.new.scenarios ?? [],
    },
    generatedAt: new Date().toISOString(),
    commit: await getGitCommitSha(),
  })

  const reportsDir = path.join(e2eDir, 'reports')
  await mkdir(reportsDir, { recursive: true })
  const reportPath = path.join(reportsDir, 'e2e-dual-diff.json')
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  console.log(`[dual] Diff report written to ${reportPath}.`)
  console.log(
    `[dual] ${report.summary.aligned}/${report.summary.total} scenarios aligned, ` +
      `${report.summary.diff} diff(s) (missing in old: ${report.summary.missingInOld}, missing in new: ${report.summary.missingInNew}).`,
  )

  if (!report.aligned) {
    console.error('[dual] Contract diff detected: scenario verdicts diverge between tracks.')
    process.exitCode = 1
    return
  }

  if (outcomes.old.cucumberExitCode !== 0 || outcomes.new.cucumberExitCode !== 0) {
    console.error('[dual] Tracks are aligned but at least one pass has failing scenarios.')
    process.exitCode = 1
    return
  }

  console.log('[dual] Both tracks are green with zero contract diff.')
  process.exitCode = 0
}

const main = async () => {
  const { dual, forwardArgs, full, headed, seed, seedOnly } = parseRunOptions(process.argv.slice(2))

  if (dual) {
    await runDual({ forwardArgs, headed, seed })
    return
  }

  const { cucumberExitCode } = await runStackOnce({ forwardArgs, full, headed, seed, seedOnly })
  if (cucumberExitCode !== undefined) process.exitCode = cucumberExitCode
}

if (isMainModule(import.meta.url)) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
