import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'

/**
 * Deterministic OpenAI-compatible LLM stub for E2E runs.
 *
 * The stub answers `POST /v1/chat/completions` with an echo of the last user
 * message so WebApp journeys can exercise real streaming and persistence code
 * paths without touching a real model provider.
 */

export const llmStubReplyPrefix = 'E2E_STUB_REPLY: '
export const llmStubEchoMaxLength = 80
export const llmStubDefaultModel = 'e2e-stub-llm'

const streamChunkLength = 16

type StubMessageContentPart = {
  text?: unknown
  type?: unknown
}

type StubChatMessage = {
  content?: unknown
  role?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const extractMessageText = (content: unknown): string => {
  if (typeof content === 'string') return content

  if (Array.isArray(content)) {
    return content
      .filter(
        (part): part is StubMessageContentPart =>
          isRecord(part) && part.type === 'text' && typeof part.text === 'string',
      )
      .map((part) => part.text as string)
      .join('\n')
  }

  return ''
}

const findLastUserMessage = (messages: unknown): StubChatMessage | undefined => {
  if (!Array.isArray(messages)) return undefined

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (isRecord(message) && message.role === 'user') return message
  }

  return undefined
}

export const buildStubReplyText = (messages: unknown): string => {
  const message = findLastUserMessage(messages)
  const text = extractMessageText(message?.content)

  return `${llmStubReplyPrefix}${text.slice(0, llmStubEchoMaxLength)}`
}

const resolveStubModel = (model: unknown) =>
  typeof model === 'string' && model ? model : llmStubDefaultModel

export const createStubChatCompletionPayload = (body: unknown) => {
  const requestModel = isRecord(body) ? body.model : undefined
  const messages = isRecord(body) ? body.messages : undefined

  return {
    choices: [
      {
        finish_reason: 'stop',
        index: 0,
        message: { content: buildStubReplyText(messages), role: 'assistant' },
      },
    ],
    created: 0,
    id: 'chatcmpl-e2e-stub',
    model: resolveStubModel(requestModel),
    object: 'chat.completion',
    usage: { completion_tokens: 0, prompt_tokens: 0, total_tokens: 0 },
  }
}

const createStreamChunk = (
  model: string,
  delta: Record<string, string>,
  finishReason: string | null,
) =>
  JSON.stringify({
    choices: [{ delta, finish_reason: finishReason, index: 0 }],
    created: 0,
    id: 'chatcmpl-e2e-stub',
    model,
    object: 'chat.completion.chunk',
  })

export const createStubStreamBody = (body: unknown): string => {
  const requestModel = isRecord(body) ? body.model : undefined
  const model = resolveStubModel(requestModel)
  const messages = isRecord(body) ? body.messages : undefined
  const reply = buildStubReplyText(messages)

  const frames: string[] = [createStreamChunk(model, { role: 'assistant' }, null)]
  for (let offset = 0; offset < reply.length; offset += streamChunkLength)
    frames.push(
      createStreamChunk(model, { content: reply.slice(offset, offset + streamChunkLength) }, null),
    )
  frames.push(createStreamChunk(model, {}, 'stop'))
  frames.push('[DONE]')

  return frames.map((frame) => `data: ${frame}\n\n`).join('')
}

const readRequestBody = async (request: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)

  return Buffer.concat(chunks).toString('utf8')
}

const sendJson = (response: ServerResponse, status: number, payload: unknown) => {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(payload))
}

const sendError = (response: ServerResponse, status: number, message: string) => {
  sendJson(response, status, { error: { message, type: 'invalid_request_error' } })
}

export const createLlmStubHandler = () => {
  return async (request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? '/', 'http://localhost')

    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, { status: 'ok' })
      return
    }

    if (url.pathname === '/v1/chat/completions') {
      if (request.method !== 'POST') {
        sendError(response, 405, 'Only POST is supported for /v1/chat/completions.')
        return
      }

      let body: unknown
      try {
        body = JSON.parse(await readRequestBody(request))
      } catch {
        sendError(response, 400, 'Request body must be valid JSON.')
        return
      }

      if (isRecord(body) && body.stream === true) {
        response.writeHead(200, {
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Content-Type': 'text/event-stream',
        })
        response.end(createStubStreamBody(body))
        return
      }

      sendJson(response, 200, createStubChatCompletionPayload(body))
      return
    }

    sendError(response, 404, `Unknown route: ${request.method} ${url.pathname}`)
  }
}

export type LlmStubServerHandle = {
  close: () => Promise<void>
  port: number
  server: Server
}

export const startLlmStubServer = async ({
  host,
  port,
}: {
  host: string
  port: number
}): Promise<LlmStubServerHandle> => {
  const server = createServer((request, response) => {
    void createLlmStubHandler()(request, response).catch((error) => {
      sendError(
        response,
        500,
        `LLM stub failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => resolve())
  })

  const address = server.address()
  const boundPort = typeof address === 'object' && address ? address.port : port

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      }),
    port: boundPort,
    server,
  }
}
