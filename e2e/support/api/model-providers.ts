import type {
  CredentialFormSchema,
  ModelCredentialSchema,
} from '@dify/contracts/api/console/workspaces/types.gen'
import type { ConsoleClient } from './console-client'
import { llmStubPort } from '../../test-env'
import { bootstrapMarketplacePlugins } from '../marketplace-plugins'

/**
 * Seeds the deterministic LLM stub as the workspace's OpenAI-API-compatible
 * provider. WebApp journeys call this from fixtures before publishing apps so
 * chat/completion requests resolve to the local stub instead of a real model.
 *
 * The helper is idempotent: a credential already pointing at the stub endpoint
 * is reused, a drifted one is updated in place, and the plugin install is a
 * no-op once present.
 */

export const llmStubPluginId = 'langgenius/openai_api_compatible'
export const llmStubProviderName = 'langgenius/openai_api_compatible/openai_api_compatible'
export const llmStubModelName = 'e2e-stub-llm'
export const llmStubCredentialName = 'E2E LLM Stub'
export const llmStubApiKey = 'e2e-stub-api-key'
export const llmStubPluginIdsEnv = 'E2E_LLM_STUB_PLUGIN_IDS'
export const llmStubInternalUrlEnv = 'E2E_LLM_STUB_INTERNAL_URL'

/**
 * Endpoint the plugin daemon container uses to reach the stub. The daemon runs
 * in Docker while the stub listens on the host, so loopback is not an option;
 * `host.docker.internal` is mapped by the middleware compose file on Linux and
 * natively by Docker Desktop.
 */
export const getLlmStubInternalUrl = () => {
  const explicit = process.env[llmStubInternalUrlEnv]?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')

  return `http://host.docker.internal:${llmStubPort}/v1`
}

const getProviderAlias = (provider: string) =>
  provider.split('/').filter(Boolean).at(-1) ?? provider

export const matchesStubProvider = (provider: string) =>
  provider === llmStubProviderName ||
  getProviderAlias(provider) === getProviderAlias(llmStubProviderName)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const resolveCredentialFieldValue = (
  field: CredentialFormSchema,
  endpointUrl: string,
): string | undefined => {
  // Known openai_api_compatible fields are pinned so the credential is
  // deterministic regardless of plugin version drift in defaults.
  if (field.variable === 'api_key') return llmStubApiKey
  if (field.variable === 'endpoint_url') return endpointUrl
  if (field.variable === 'mode') return 'chat'

  if (field.default) return field.default
  if (field.required === false) return undefined

  const firstOption = field.options?.[0]?.value
  if (firstOption) return firstOption
  if (field.type === 'switch') return 'false'
  if (field.variable === 'context_size') return '4096'
  if (field.variable.startsWith('max_tokens')) return '1024'

  return 'e2e-stub'
}

export const buildStubModelCredentials = (
  schema: Pick<ModelCredentialSchema, 'credential_form_schemas'>,
  endpointUrl: string,
): Record<string, unknown> => {
  const credentials: Record<string, unknown> = {}
  for (const field of schema.credential_form_schemas) {
    const value = resolveCredentialFieldValue(field, endpointUrl)
    if (value !== undefined) credentials[field.variable] = value
  }

  return credentials
}

export type StubLlmProviderOutcome = 'created' | 'updated' | 'verified'

export type EnsureStubLlmProviderResult = {
  credentialId: string
  model: string
  outcome: StubLlmProviderOutcome
  provider: string
}

export type EnsureStubLlmProviderOptions = {
  endpointUrl?: string
  model?: string
}

const findStubProvider = async (client: ConsoleClient) => {
  const body = await client.workspaces.current.modelProviders.get({ query: { model_type: 'llm' } })
  const provider = body.data.find((item) => matchesStubProvider(item.provider))

  return { availableProviders: body.data.map((item) => item.provider), provider }
}

const findStubModelStatus = async (client: ConsoleClient, provider: string, model: string) => {
  const body = await client.workspaces.current.models.modelTypes.byModelType.get({
    params: { model_type: 'llm' },
  })
  const providerEntry = body.data.find((item) => matchesStubProvider(item.provider))

  return providerEntry?.models.find((item) => item.model === model)?.status
}

const ensureWorkspaceDefaultModel = async (
  client: ConsoleClient,
  provider: string,
  model: string,
) => {
  const current = await client.workspaces.current.defaultModel.get({ query: { model_type: 'llm' } })
  const currentDefault = current.data
  if (currentDefault?.model === model && matchesStubProvider(currentDefault.provider.provider))
    return

  await client.workspaces.current.defaultModel.post({
    body: { model_settings: [{ model, model_type: 'llm', provider }] },
  })
}

const ensureStubPluginInstalled = async (client: ConsoleClient) => {
  const result = await bootstrapMarketplacePlugins(
    { consoleClient: client, dryRun: false, resources: new Map() },
    {
      defaultPluginIds: [llmStubPluginId],
      pluginIdsEnv: llmStubPluginIdsEnv,
      title: 'LLM stub marketplace plugin',
    },
  )

  if (result.status === 'blocked')
    throw new Error(`LLM stub plugin bootstrap failed: ${result.reason ?? 'unknown reason'}`)
}

export const ensureStubLlmProvider = async (
  client: ConsoleClient,
  options: EnsureStubLlmProviderOptions = {},
): Promise<EnsureStubLlmProviderResult> => {
  const model = options.model ?? llmStubModelName
  const endpointUrl = options.endpointUrl ?? getLlmStubInternalUrl()

  await ensureStubPluginInstalled(client)

  const { availableProviders, provider } = await findStubProvider(client)
  if (!provider) {
    const available = availableProviders.length > 0 ? availableProviders.join(', ') : 'none'
    throw new Error(
      `Provider ${llmStubProviderName} not found after plugin bootstrap. Available providers: ${available}.`,
    )
  }
  if (!provider.model_credential_schema)
    throw new Error(`Provider ${provider.provider} does not expose a model credential schema.`)

  const credentials = buildStubModelCredentials(provider.model_credential_schema, endpointUrl)
  const customModel = provider.custom_configuration.custom_models?.find(
    (item) => item.model === model && item.model_type === 'llm',
  )
  const existingCredentialId = customModel?.current_credential_id ?? undefined

  let outcome: StubLlmProviderOutcome = 'created'
  let credentialId = existingCredentialId

  if (existingCredentialId) {
    const current =
      await client.workspaces.current.modelProviders.byProvider.models.credentials.get({
        params: { provider: provider.provider },
        query: { credential_id: existingCredentialId, model, model_type: 'llm' },
      })
    const currentEndpoint = isRecord(current.credentials)
      ? current.credentials.endpoint_url
      : undefined

    if (currentEndpoint === endpointUrl) {
      outcome = 'verified'
    } else {
      await client.workspaces.current.modelProviders.byProvider.models.credentials.put({
        body: {
          credential_id: existingCredentialId,
          credentials,
          model,
          model_type: 'llm',
          name: llmStubCredentialName,
        },
        params: { provider: provider.provider },
      })
      outcome = 'updated'
    }
  } else {
    await client.workspaces.current.modelProviders.byProvider.models.credentials.post({
      body: { credentials, model, model_type: 'llm', name: llmStubCredentialName },
      params: { provider: provider.provider },
    })

    const refreshed = await findStubProvider(client)
    credentialId =
      refreshed.provider?.custom_configuration.custom_models?.find(
        (item) => item.model === model && item.model_type === 'llm',
      )?.current_credential_id ?? undefined
    if (!credentialId)
      throw new Error(
        `Model ${model} credential was created for ${provider.provider} but could not be resolved afterwards.`,
      )
  }

  if (!credentialId)
    throw new Error(`Model ${model} has no usable credential for ${provider.provider}.`)

  const status = await findStubModelStatus(client, provider.provider, model)
  if (status !== 'active')
    throw new Error(
      `Model ${provider.provider}/${model} is not active after credential setup (status: ${status ?? 'missing'}).`,
    )

  await ensureWorkspaceDefaultModel(client, provider.provider, model)

  return { credentialId, model, outcome, provider: provider.provider }
}
