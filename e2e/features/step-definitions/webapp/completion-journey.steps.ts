import type { DifyWorld } from '../../support/world'
import { Given, Then, When } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { createTestApp } from '../../../support/api/apps'
import { ensureStubLlmProvider } from '../../../support/api/model-providers'
import { getAppSiteURL, toTrackWebAppURL } from '../../../support/api/web-apps'
import { llmStubEchoMaxLength, llmStubReplyPrefix } from '../../../support/llm-stub'
import { createE2EResourceName } from '../../../support/naming'

// The prompt template makes the stub echo deterministic end to end: the backend
// renders {{query}} with the filled value into the single user message, and the
// stub echoes that rendered prompt.
const completionPromptTemplate = 'Write a haiku about {{query}}.'
const completionVariableLabel = 'Query'
const completionVariableKey = 'query'

// Accessible name shared by both tracks: the run CTA reads "Execute"
// (share ns generation.run) in old and new track alike.
const runButtonName = 'Execute'

Given(
  'a completion app with a query prompt variable is shared via the stub model',
  { timeout: 120_000 },
  async function (this: DifyWorld) {
    const client = this.getConsoleClient()

    // Seeds the OpenAI-API-compatible provider pointing at the local LLM stub
    // (idempotent) and selects it as the workspace default model.
    const stub = await ensureStubLlmProvider(client)

    // Text-generator app: /completion/<token> route. Easy-UI completion apps
    // serve the latest model config directly — no workflow-style publish step —
    // and the site is enabled by default on creation.
    const app = await createTestApp(
      client,
      createE2EResourceName('App', 'CompletionJourney'),
      'completion',
    )
    this.createdAppIds.push(app.id)
    this.lastCreatedAppName = app.name

    await client.apps.byAppId.modelConfig.post({
      body: {
        model: { completion_params: {}, name: stub.model, provider: stub.provider },
        pre_prompt: completionPromptTemplate,
        prompt_type: 'simple',
        user_input_form: [
          {
            'text-input': {
              default: '',
              label: completionVariableLabel,
              max_length: 48,
              required: true,
              variable: completionVariableKey,
            },
          },
        ],
      },
      params: { app_id: app.id },
    })

    const appDetail = await client.apps.byAppId.get({ params: { app_id: app.id } })
    expect(appDetail.enable_site).toBe(true)

    // The backend issues the URL against APP_WEB_URL (old track); re-root it
    // onto the active track origin so dual-track runs hit the right server.
    this.shareURL = toTrackWebAppURL(getAppSiteURL(appDetail))
  },
)

When('the visitor opens the completion Web App', async function (this: DifyWorld) {
  if (!this.shareURL)
    throw new Error(
      'No completion Web App URL available. Run "a completion app with a query prompt variable is shared via the stub model" first.',
    )

  await this.getPage().goto(this.shareURL, { timeout: 20_000 })
})

Then(
  'the completion run form shows the {string} field',
  async function (this: DifyWorld, label: string) {
    // The run form renders one text input per variable keyed by the variable
    // label as placeholder in both tracks (run-once string branch).
    await expect(this.getPage().getByPlaceholder(label)).toBeVisible({ timeout: 15_000 })
  },
)

When(
  'the visitor fills the completion {string} field with {string}',
  async function (this: DifyWorld, label: string, value: string) {
    await this.getPage().getByPlaceholder(label).fill(value)
  },
)

When('the visitor runs the completion once', async function (this: DifyWorld) {
  await this.getPage().getByRole('button', { name: runButtonName }).click()
})

Then(
  'the stub echo answer to {string} is rendered in the completion result',
  async function (this: DifyWorld, renderedPrompt: string) {
    const expectedEcho = `${llmStubReplyPrefix}${renderedPrompt.slice(0, llmStubEchoMaxLength)}`

    // The result area streams the answer; it settles once the full echo text is
    // present in the result item.
    await expect(this.getPage().getByText(expectedEcho)).toBeVisible({ timeout: 30_000 })
  },
)
