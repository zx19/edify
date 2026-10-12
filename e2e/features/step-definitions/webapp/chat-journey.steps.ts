import type { DifyWorld } from '../../support/world'
import { Given, Then, When } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { createTestApp } from '../../../support/api/apps'
import { ensureStubLlmProvider } from '../../../support/api/model-providers'
import { getAppSiteURL, toTrackWebAppURL } from '../../../support/api/web-apps'
import { llmStubEchoMaxLength, llmStubReplyPrefix } from '../../../support/llm-stub'
import { createE2EResourceName } from '../../../support/naming'
import { trackSelector } from '../../../support/track'

// The opening statement doubles as the welcome-screen anchor: both tracks must
// render it before the first message is sent.
const chatJourneyOpeningStatement = 'Welcome to the E2E chat journey!'

// Accessible names shared by both tracks. The drawer CTA (new track) and the
// sidebar button (old track) both read "Start New chat"; the new-track header
// button carries the "Already in a new chat" aria-label and is never targeted.
const newChatButtonName = 'Start New chat'
const conversationHistoryName = 'Conversation history'

const getComposer = (world: DifyWorld) =>
  world.getPage().getByTestId('chat-footer').getByRole('textbox')

// chat-answer-container 两轨均有 data-testid（旧轨 answer/index.tsx 同时带 class）。
// 注意：欢迎态旧轨开场白渲染在 welcome 块而非 answer 气泡（chat-wrapper welcome 分支），
// 所以欢迎屏断言不能用本 locator——发送后有真实气泡才可用。
const getAnswerContainers = (world: DifyWorld) =>
  world.getPage().getByTestId('chat-answer-container')

Given(
  'a chat app with an opening statement is shared via the stub model',
  { timeout: 120_000 },
  async function (this: DifyWorld) {
    const client = this.getConsoleClient()

    // Seeds the OpenAI-API-compatible provider pointing at the local LLM stub
    // (idempotent) and selects it as the workspace default model.
    const stub = await ensureStubLlmProvider(client)

    // Basic chatbot app: /chat/<token> route. Easy-UI chat apps serve the
    // latest model config directly — no workflow-style publish step — and the
    // site is enabled by default on creation.
    const app = await createTestApp(client, createE2EResourceName('App', 'ChatJourney'), 'chat')
    this.createdAppIds.push(app.id)
    this.lastCreatedAppName = app.name

    await client.apps.byAppId.modelConfig.post({
      body: {
        model: { completion_params: {}, name: stub.model, provider: stub.provider },
        opening_statement: chatJourneyOpeningStatement,
        suggested_questions: [],
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

When('the visitor opens the chat Web App', async function (this: DifyWorld) {
  if (!this.shareURL)
    throw new Error(
      'No chat Web App URL available. Run "a chat app with an opening statement is shared via the stub model" first.',
    )

  await this.getPage().goto(this.shareURL, { timeout: 20_000 })
})

Then('the chat welcome screen shows the opening statement', async function (this: DifyWorld) {
  const page = this.getPage()

  // Shared contract: the composer is available in the welcome state.
  await expect(getComposer(this)).toBeVisible({ timeout: 15_000 })

  await trackSelector(
    // Old track: Dify original — the opening statement renders in the dedicated
    // welcome block（chat-wrapper.tsx welcome 分支的 Markdown，无 testid、非
    // answer 气泡——四跑实证 .chat-answer-container 命不中），用唯一文案断言。
    // 左侧栏持有会话管理；新会话无任何用户提问。
    async () => {
      await expect(page.getByText(chatJourneyOpeningStatement)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByTestId('question-content')).toHaveCount(0)
      await expect(page.getByRole('button', { name: newChatButtonName })).toBeVisible()
    },
    // New track: centered empty-state welcome screen (mockup 类型1) keyed by
    // the welcome-screen testid.
    async () => {
      await expect(page.getByTestId('welcome-screen')).toContainText(chatJourneyOpeningStatement, {
        timeout: 15_000,
      })
    },
  )()
})

When(
  'the visitor sends {string} in the chat composer',
  async function (this: DifyWorld, message: string) {
    const composer = getComposer(this)
    await composer.fill(message)
    await this.getPage().getByTestId('chat-footer').getByRole('button', { name: 'Send' }).click()
  },
)

Then(
  'the stub echo answer to {string} is rendered in the chat',
  async function (this: DifyWorld, message: string) {
    const page = this.getPage()
    const expectedEcho = `${llmStubReplyPrefix}${message.slice(0, llmStubEchoMaxLength)}`

    // The sent question renders, then the streamed answer settles once the
    // full echo text is present in the last answer bubble.
    await expect(page.getByTestId('question-content').last()).toContainText(message, {
      timeout: 15_000,
    })
    await expect(getAnswerContainers(this).last()).toContainText(expectedEcho, {
      timeout: 30_000,
    })
  },
)

Then(
  'the conversation {string} appears in the conversation history',
  async function (this: DifyWorld, conversationName: string) {
    const page = this.getPage()

    // The first-message conversation name equals the query deterministically:
    // it starts as the query and the stub cannot produce a JSON title, so the
    // backend rename falls back to the query as well.
    await trackSelector(
      // Old track: the conversation shows up in the always-on left sidebar.
      async () => {
        await expect(page.getByTitle(conversationName, { exact: true })).toBeVisible({
          timeout: 15_000,
        })
      },
      // New track: conversation management lives in the overlay drawer (D1/D2);
      // open it from the 40px header first.
      async () => {
        await page.getByRole('button', { name: conversationHistoryName }).click()
        const drawer = page.getByRole('dialog', { name: conversationHistoryName })
        await expect(drawer.getByTitle(conversationName, { exact: true })).toBeVisible({
          timeout: 15_000,
        })
      },
    )()
  },
)

When('the visitor starts a new conversation', async function (this: DifyWorld) {
  const page = this.getPage()

  await trackSelector(
    // Old track: the sidebar "Start New chat" button.
    async () => {
      await page.getByRole('button', { name: newChatButtonName }).click()
    },
    // New track: the drawer CTA. 抽屉可能已被上一步（会话历史）打开——此时 header
    // ☰ 被抽屉蒙层盖住点不动（四跑实证 click 超时），开态则直点 CTA。
    async () => {
      const drawer = page.getByRole('dialog', { name: conversationHistoryName })
      if (!(await drawer.isVisible().catch(() => false)))
        await page.getByRole('button', { name: conversationHistoryName }).click()
      await drawer.getByRole('button', { name: newChatButtonName }).click()
    },
  )()
})
