import { afterEach, describe, expect, it } from 'vite-plus/test'
import { buildStubReplyText, llmStubReplyPrefix, startLlmStubServer } from '../support/llm-stub'

describe('buildStubReplyText', () => {
  it('echoes the last user message with the stub prefix', () => {
    const reply = buildStubReplyText([
      { role: 'user', content: 'first question' },
      { role: 'assistant', content: 'earlier answer' },
      { role: 'user', content: 'final question' },
    ])

    expect(reply).toBe(`${llmStubReplyPrefix}final question`)
  })

  it('truncates the echoed input to 80 characters', () => {
    const longMessage = 'x'.repeat(200)

    const reply = buildStubReplyText([{ role: 'user', content: longMessage }])

    expect(reply).toBe(`${llmStubReplyPrefix}${'x'.repeat(80)}`)
    expect(reply).toHaveLength(llmStubReplyPrefix.length + 80)
  })

  it('joins multimodal text parts and ignores non-text parts', () => {
    const reply = buildStubReplyText([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'look at this' },
          { type: 'image_url', image_url: { url: 'https://example.test/x.png' } },
          { type: 'text', text: 'and describe it' },
        ],
      },
    ])

    expect(reply).toBe(`${llmStubReplyPrefix}look at this\nand describe it`)
  })

  it('echoes an empty reply when the conversation has no user message', () => {
    expect(buildStubReplyText([{ role: 'system', content: 'be nice' }])).toBe(llmStubReplyPrefix)
    expect(buildStubReplyText([])).toBe(llmStubReplyPrefix)
  })

  it('echoes an empty reply for malformed payloads', () => {
    expect(buildStubReplyText(undefined)).toBe(llmStubReplyPrefix)
    expect(buildStubReplyText('not-an-array')).toBe(llmStubReplyPrefix)
    expect(buildStubReplyText([{ role: 'user', content: 42 }])).toBe(llmStubReplyPrefix)
  })
})

describe('llm stub server', () => {
  let handle: Awaited<ReturnType<typeof startLlmStubServer>> | undefined

  afterEach(async () => {
    await handle?.close()
    handle = undefined
  })

  const start = async () => {
    handle = await startLlmStubServer({ host: '127.0.0.1', port: 0 })
    return `http://127.0.0.1:${handle.port}`
  }

  const postChatCompletion = (baseUrl: string, body: unknown) =>
    fetch(`${baseUrl}/v1/chat/completions`, {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })

  it('serves a health check', async () => {
    const baseUrl = await start()

    const response = await fetch(`${baseUrl}/health`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: 'ok' })
  })

  it('answers non-streaming chat completions with the echo payload', async () => {
    const baseUrl = await start()

    const response = await postChatCompletion(baseUrl, {
      messages: [{ role: 'user', content: 'Hello stub' }],
      model: 'e2e-stub-llm',
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    const body = await response.json()
    expect(body.object).toBe('chat.completion')
    expect(body.model).toBe('e2e-stub-llm')
    expect(body.choices).toHaveLength(1)
    expect(body.choices[0]).toMatchObject({
      finish_reason: 'stop',
      index: 0,
      message: { content: `${llmStubReplyPrefix}Hello stub`, role: 'assistant' },
    })
    expect(body.usage).toEqual({ completion_tokens: 0, prompt_tokens: 0, total_tokens: 0 })
  })

  it('defaults the echoed model when the request omits it', async () => {
    const baseUrl = await start()

    const response = await postChatCompletion(baseUrl, {
      messages: [{ role: 'user', content: 'hi' }],
    })
    const body = await response.json()

    expect(body.model).toBe('e2e-stub-llm')
  })

  it('streams chat completions as SSE chunks terminated by [DONE]', async () => {
    const baseUrl = await start()

    const response = await postChatCompletion(baseUrl, {
      messages: [{ role: 'user', content: 'stream me' }],
      model: 'e2e-stub-llm',
      stream: true,
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    const text = await response.text()
    const frames = text.split('\n\n').filter(Boolean)
    const dataLines = frames.map((frame) => frame.replace(/^data: /, ''))

    expect(dataLines.at(-1)).toBe('[DONE]')

    const chunks = dataLines.slice(0, -1).map((line) => JSON.parse(line))
    expect(chunks[0]).toMatchObject({
      choices: [{ delta: { role: 'assistant' }, finish_reason: null, index: 0 }],
      model: 'e2e-stub-llm',
      object: 'chat.completion.chunk',
    })
    const contentChunks = chunks.slice(1, -1)
    expect(contentChunks.length).toBeGreaterThanOrEqual(1)
    expect(contentChunks.map((chunk) => chunk.choices[0].delta.content ?? '').join('')).toBe(
      `${llmStubReplyPrefix}stream me`,
    )
    expect(chunks.at(-1)).toMatchObject({
      choices: [{ delta: {}, finish_reason: 'stop', index: 0 }],
    })
  })

  it('splits long streaming replies into multiple content chunks', async () => {
    const baseUrl = await start()

    const response = await postChatCompletion(baseUrl, {
      messages: [{ role: 'user', content: 'y'.repeat(120) }],
      stream: true,
    })
    const text = await response.text()
    const chunks = text
      .split('\n\n')
      .filter(Boolean)
      .map((frame) => frame.replace(/^data: /, ''))
      .slice(0, -1)
      .map((line) => JSON.parse(line))
    const contentChunks = chunks.slice(1, -1)

    expect(contentChunks.length).toBeGreaterThan(1)
    expect(contentChunks.map((chunk) => chunk.choices[0].delta.content ?? '').join('')).toBe(
      `${llmStubReplyPrefix}${'y'.repeat(80)}`,
    )
  })

  it('rejects unknown routes with 404', async () => {
    const baseUrl = await start()

    const response = await fetch(`${baseUrl}/v1/models`, { method: 'POST' })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ error: { message: expect.any(String) } })
  })

  it('rejects non-POST chat completion calls with 405', async () => {
    const baseUrl = await start()

    const response = await fetch(`${baseUrl}/v1/chat/completions`)

    expect(response.status).toBe(405)
  })

  it('rejects invalid JSON bodies with 400', async () => {
    const baseUrl = await start()

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      body: '{not-json',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })

    expect(response.status).toBe(400)
  })
})
