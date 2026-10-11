import type { DifyWorld } from '../../support/world'
import { Given, Then, When } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { createTestApp } from '../../../support/api/apps'
import { ensureStubLlmProvider } from '../../../support/api/model-providers'
import { getAppChatbotURL, toTrackWebAppURL } from '../../../support/api/web-apps'
import { createE2EResourceName } from '../../../support/naming'
import { trackSelector } from '../../../support/track'

// The opening statement is the welcome anchor; the required variable gates the
// first message until the visitor fills the chat settings form.
const chatbotJourneyOpeningStatement = 'Welcome to the E2E chatbot journey!'
const chatbotVariableLabel = 'Visitor name'
const chatbotVariableKey = 'visitor_name'

// Accessible name shared by both tracks: the variables-form CTA reads "Start Chat"
// (share ns chat.startChat) in old and new track alike. Matching stays
// case-insensitive substring (Playwright getByRole default) because the old track
// renders the label uppercase via CSS.
const startChatButtonName = 'Start Chat'

const getStartChatButton = (world: DifyWorld) =>
  world.getPage().getByRole('button', { name: startChatButtonName })

Given(
  'a chatbot app with a required variable and an opening statement is shared via the stub model',
  { timeout: 120_000 },
  async function (this: DifyWorld) {
    const client = this.getConsoleClient()

    // Seeds the OpenAI-API-compatible provider pointing at the local LLM stub
    // (idempotent) and selects it as the workspace default model.
    const stub = await ensureStubLlmProvider(client)

    // Basic chatbot app: the /chatbot/<token> embed-shaped route shares the chat
    // app's site token. Easy-UI chat apps serve the latest model config directly
    // — no workflow-style publish step — and the site is enabled by default.
    const app = await createTestApp(client, createE2EResourceName('App', 'ChatbotJourney'), 'chat')
    this.createdAppIds.push(app.id)
    this.lastCreatedAppName = app.name

    await client.apps.byAppId.modelConfig.post({
      body: {
        model: { completion_params: {}, name: stub.model, provider: stub.provider },
        opening_statement: chatbotJourneyOpeningStatement,
        suggested_questions: [],
        user_input_form: [
          {
            'text-input': {
              default: '',
              label: chatbotVariableLabel,
              max_length: 48,
              required: true,
              variable: chatbotVariableKey,
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
    this.shareURL = toTrackWebAppURL(getAppChatbotURL(appDetail))
  },
)

When('the visitor opens the chatbot Web App', async function (this: DifyWorld) {
  if (!this.shareURL)
    throw new Error(
      'No chatbot Web App URL available. Run "a chatbot app with a required variable and an opening statement is shared via the stub model" first.',
    )

  await this.getPage().goto(this.shareURL, { timeout: 20_000 })
})

Then(
  'the chatbot variables form shows the required {string} field',
  async function (this: DifyWorld, label: string) {
    const page = this.getPage()

    // inputs-form-node and inputs-form-item-<variable> are real data-testid
    // attributes in BOTH tracks (verified in web/ and web-new
    // embedded-chatbot/inputs-form) — no track fork needed for the form card.
    await expect(page.getByTestId('inputs-form-node')).toBeVisible({ timeout: 15_000 })
    const formItem = page.getByTestId(`inputs-form-item-${chatbotVariableKey}`)
    await expect(formItem).toBeVisible()
    await expect(formItem).toContainText(label)

    await trackSelector(
      // Old track: the expanded form card replaces the welcome bubble, so the
      // opening statement is intentionally not asserted at this point.
      async () => {},
      // New track: the centered welcome screen renders the opening statement
      // alongside the form card from the start.
      async () => {
        await expect(page.getByTestId('welcome-screen')).toContainText(
          chatbotJourneyOpeningStatement,
        )
      },
    )()
  },
)

When('the visitor starts the chatbot chat', async function (this: DifyWorld) {
  await getStartChatButton(this).click()
})

Then(
  'the chatbot variables form stays open with a required-field reminder',
  async function (this: DifyWorld) {
    const page = this.getPage()

    // Required-field validation carries the appDebug errorMessage.valueOfVarRequired
    // toast ("<label> value can not be empty") in both tracks; the form card must
    // stay open, so the Start Chat CTA remains on the page.
    await expect(
      page.getByText(`${chatbotVariableLabel} value can not be empty`).first(),
    ).toBeVisible()
    await expect(getStartChatButton(this)).toBeVisible()
  },
)

When(
  'the visitor fills the chatbot variable {string} with {string}',
  async function (this: DifyWorld, _label: string, value: string) {
    await this.getPage()
      .getByTestId(`inputs-form-item-${chatbotVariableKey}`)
      .getByRole('textbox')
      .fill(value)
  },
)

Then('the chatbot chat starts with the opening statement', async function (this: DifyWorld) {
  const page = this.getPage()

  // Shared contract: a successful start collapses the variables form card, which
  // unmounts the Start Chat CTA in both tracks.
  await expect(getStartChatButton(this)).toBeHidden()

  await trackSelector(
    // Old track: once the form collapses, the opening statement renders as the
    // welcome bubble.
    async () => {
      await expect(page.getByText(chatbotJourneyOpeningStatement)).toBeVisible({ timeout: 15_000 })
    },
    // New track: the centered welcome screen owns the opening statement.
    async () => {
      await expect(page.getByTestId('welcome-screen')).toContainText(
        chatbotJourneyOpeningStatement,
        { timeout: 15_000 },
      )
    },
  )()
})
