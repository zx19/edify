import type { CredentialFormSchema } from '@dify/contracts/api/console/workspaces/types.gen'
import type { ConsoleClient } from '../support/api/console-client'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  buildStubModelCredentials,
  ensureStubLlmProvider,
  llmStubApiKey,
  llmStubCredentialName,
  llmStubModelName,
  llmStubProviderName,
} from '../support/api/model-providers'

const stubEndpointUrl = 'http://host.docker.internal:5199/v1'

const formField = (
  field: Partial<CredentialFormSchema> & Pick<CredentialFormSchema, 'type' | 'variable'>,
): CredentialFormSchema =>
  ({
    label: { en_US: field.variable, zh_Hans: field.variable },
    ...field,
  }) as CredentialFormSchema

const openAICompatibleSchema = {
  credential_form_schemas: [
    formField({ type: 'secret-input', variable: 'api_key' }),
    formField({ type: 'text-input', variable: 'endpoint_url' }),
    formField({
      default: 'chat',
      options: [
        { label: { en_US: 'Chat', zh_Hans: 'Chat' }, value: 'chat' },
        { label: { en_US: 'Completion', zh_Hans: 'Completion' }, value: 'completion' },
      ],
      type: 'select',
      variable: 'mode',
    }),
    formField({ default: '4096', type: 'text-input', variable: 'context_size' }),
    formField({ default: '1024', type: 'text-input', variable: 'max_tokens_to_sample' }),
    formField({
      default: 'not-supported',
      options: [
        { label: { en_US: 'Yes', zh_Hans: '是' }, value: 'supported' },
        { label: { en_US: 'No', zh_Hans: '否' }, value: 'not-supported' },
      ],
      type: 'radio',
      variable: 'function_calling',
    }),
    formField({ required: false, type: 'text-input', variable: 'custom_header' }),
  ],
  model: {
    label: { en_US: 'Model Name', zh_Hans: '模型名称' },
    placeholder: null,
  },
}

describe('buildStubModelCredentials', () => {
  it('fills the known OpenAI-compatible fields and honors schema defaults', () => {
    const credentials = buildStubModelCredentials(openAICompatibleSchema, stubEndpointUrl)

    expect(credentials).toEqual({
      api_key: llmStubApiKey,
      context_size: '4096',
      endpoint_url: stubEndpointUrl,
      function_calling: 'not-supported',
      max_tokens_to_sample: '1024',
      mode: 'chat',
    })
  })

  it('forces chat mode even when the schema defaults elsewhere', () => {
    const schema = {
      credential_form_schemas: [
        formField({ default: 'completion', type: 'select', variable: 'mode' }),
      ],
      model: openAICompatibleSchema.model,
    }

    expect(buildStubModelCredentials(schema, stubEndpointUrl)).toEqual({ mode: 'chat' })
  })

  it('picks the first option for required selects without a default', () => {
    const schema = {
      credential_form_schemas: [
        formField({
          options: [
            { label: { en_US: 'A', zh_Hans: 'A' }, value: 'first' },
            { label: { en_US: 'B', zh_Hans: 'B' }, value: 'second' },
          ],
          type: 'select',
          variable: 'stream_mode',
        }),
      ],
      model: openAICompatibleSchema.model,
    }

    expect(buildStubModelCredentials(schema, stubEndpointUrl)).toEqual({ stream_mode: 'first' })
  })

  it('falls back to deterministic values for required fields without defaults', () => {
    const schema = {
      credential_form_schemas: [
        formField({ type: 'text-input', variable: 'context_size' }),
        formField({ type: 'text-input', variable: 'max_tokens' }),
        formField({ type: 'switch', variable: 'stream_options' }),
        formField({ type: 'text-input', variable: 'organization' }),
        formField({ required: false, type: 'text-input', variable: 'optional_thing' }),
      ],
      model: openAICompatibleSchema.model,
    }

    expect(buildStubModelCredentials(schema, stubEndpointUrl)).toEqual({
      context_size: '4096',
      max_tokens: '1024',
      organization: 'e2e-stub',
      stream_options: 'false',
    })
  })
})

type MockClientOptions = {
  credentialEndpointUrl?: string
  currentCredentialId?: string
  defaultModel?: { model: string; provider: string } | null
  includeProvider?: boolean
  modelStatus?: string
  pluginInstalled?: boolean
}

const createMockConsoleClient = ({
  credentialEndpointUrl = stubEndpointUrl,
  currentCredentialId,
  defaultModel = null,
  includeProvider = true,
  modelStatus = 'active',
  pluginInstalled = true,
}: MockClientOptions = {}) => {
  const providerEntry = {
    custom_configuration: {
      custom_models: currentCredentialId
        ? [
            {
              available_model_credentials: [
                { credential_id: currentCredentialId, credential_name: llmStubCredentialName },
              ],
              credentials: null,
              current_credential_id: currentCredentialId,
              current_credential_name: llmStubCredentialName,
              model: llmStubModelName,
              model_type: 'llm',
            },
          ]
        : [],
      status: currentCredentialId ? 'active' : 'no-configure',
    },
    label: { en_US: 'OpenAI API Compatible', zh_Hans: 'OpenAI API Compatible' },
    model_credential_schema: openAICompatibleSchema,
    provider: llmStubProviderName,
  }

  const modelProvidersGet = vi.fn().mockResolvedValue({
    data: includeProvider ? [providerEntry] : [],
  })
  const credentialsGet = vi.fn().mockResolvedValue({
    available_credentials: [],
    credentials: { api_key: '***', endpoint_url: credentialEndpointUrl },
    current_credential_id: currentCredentialId ?? null,
    current_credential_name: llmStubCredentialName,
  })
  const credentialsPost = vi.fn().mockResolvedValue({ result: 'success' })
  const credentialsPut = vi.fn().mockResolvedValue({ result: 'success' })
  const modelTypesGet = vi.fn().mockResolvedValue({
    data: includeProvider
      ? [
          {
            models: currentCredentialId
              ? [{ model: llmStubModelName, model_type: 'llm', status: modelStatus }]
              : [],
            provider: llmStubProviderName,
          },
        ]
      : [],
  })
  const defaultModelGet = vi.fn().mockResolvedValue({
    data: defaultModel
      ? {
          model: defaultModel.model,
          model_type: 'llm',
          provider: { provider: defaultModel.provider },
        }
      : undefined,
  })
  const defaultModelPost = vi.fn().mockResolvedValue({ result: 'success' })
  const installMarketplace = vi.fn().mockResolvedValue({ all_installed: true })

  const client = {
    workspaces: {
      current: {
        defaultModel: { get: defaultModelGet, post: defaultModelPost },
        modelProviders: {
          byProvider: {
            models: {
              credentials: {
                get: credentialsGet,
                post: credentialsPost,
                put: credentialsPut,
              },
            },
          },
          get: modelProvidersGet,
        },
        models: { modelTypes: { byModelType: { get: modelTypesGet } } },
        plugin: {
          install: { marketplace: { post: installMarketplace } },
          list: {
            installations: {
              ids: {
                post: vi.fn().mockResolvedValue({
                  plugins: pluginInstalled
                    ? [{ plugin_id: 'langgenius/openai_api_compatible' }]
                    : [],
                }),
              },
            },
            latestVersions: {
              post: vi.fn().mockResolvedValue({
                versions: {
                  'langgenius/openai_api_compatible': {
                    unique_identifier: 'langgenius/openai_api_compatible:1.0.0@marketplace',
                  },
                },
              }),
            },
          },
        },
      },
    },
  } as unknown as ConsoleClient

  return {
    client,
    credentialsGet,
    credentialsPost,
    credentialsPut,
    defaultModelGet,
    defaultModelPost,
    installMarketplace,
    modelTypesGet,
  }
}

describe('ensureStubLlmProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('creates the model credential and workspace default when nothing is configured', async () => {
    vi.stubEnv('E2E_LLM_STUB_INTERNAL_URL', stubEndpointUrl)
    const createdCredentialId = 'cred-created'
    const { client, credentialsPost, credentialsPut, defaultModelPost } = createMockConsoleClient()
    // After creation the provider list shows the new credential.
    const modelProvidersGet = client.workspaces.current.modelProviders.get as ReturnType<
      typeof vi.fn
    >
    modelProvidersGet
      .mockResolvedValueOnce({
        data: [
          {
            custom_configuration: { custom_models: [], status: 'no-configure' },
            label: { en_US: 'OpenAI API Compatible', zh_Hans: 'OpenAI API Compatible' },
            model_credential_schema: openAICompatibleSchema,
            provider: llmStubProviderName,
          },
        ],
      })
      .mockResolvedValue({
        data: [
          {
            custom_configuration: {
              custom_models: [
                {
                  available_model_credentials: [
                    { credential_id: createdCredentialId, credential_name: llmStubCredentialName },
                  ],
                  credentials: null,
                  current_credential_id: createdCredentialId,
                  current_credential_name: llmStubCredentialName,
                  model: llmStubModelName,
                  model_type: 'llm',
                },
              ],
              status: 'active',
            },
            label: { en_US: 'OpenAI API Compatible', zh_Hans: 'OpenAI API Compatible' },
            model_credential_schema: openAICompatibleSchema,
            provider: llmStubProviderName,
          },
        ],
      })
    const modelTypesGet = client.workspaces.current.models.modelTypes.byModelType.get as ReturnType<
      typeof vi.fn
    >
    modelTypesGet.mockResolvedValue({
      data: [
        {
          models: [{ model: llmStubModelName, model_type: 'llm', status: 'active' }],
          provider: llmStubProviderName,
        },
      ],
    })

    const result = await ensureStubLlmProvider(client)

    expect(result).toEqual({
      credentialId: createdCredentialId,
      model: llmStubModelName,
      outcome: 'created',
      provider: llmStubProviderName,
    })
    expect(credentialsPost).toHaveBeenCalledWith({
      body: {
        credentials: expect.objectContaining({
          api_key: llmStubApiKey,
          endpoint_url: stubEndpointUrl,
          mode: 'chat',
        }),
        model: llmStubModelName,
        model_type: 'llm',
        name: llmStubCredentialName,
      },
      params: { provider: llmStubProviderName },
    })
    expect(credentialsPut).not.toHaveBeenCalled()
    expect(defaultModelPost).toHaveBeenCalledWith({
      body: {
        model_settings: [
          { model: llmStubModelName, model_type: 'llm', provider: llmStubProviderName },
        ],
      },
    })
  })

  it('reuses the existing credential when the endpoint already matches', async () => {
    vi.stubEnv('E2E_LLM_STUB_INTERNAL_URL', stubEndpointUrl)
    const { client, credentialsPost, credentialsPut, defaultModelPost } = createMockConsoleClient({
      currentCredentialId: 'cred-existing',
      defaultModel: { model: llmStubModelName, provider: llmStubProviderName },
    })

    const result = await ensureStubLlmProvider(client)

    expect(result).toEqual({
      credentialId: 'cred-existing',
      model: llmStubModelName,
      outcome: 'verified',
      provider: llmStubProviderName,
    })
    expect(credentialsPost).not.toHaveBeenCalled()
    expect(credentialsPut).not.toHaveBeenCalled()
    expect(defaultModelPost).not.toHaveBeenCalled()
  })

  it('updates the credential when the endpoint drifted', async () => {
    vi.stubEnv('E2E_LLM_STUB_INTERNAL_URL', stubEndpointUrl)
    const { client, credentialsPost, credentialsPut } = createMockConsoleClient({
      credentialEndpointUrl: 'http://host.docker.internal:9999/v1',
      currentCredentialId: 'cred-drifted',
    })

    const result = await ensureStubLlmProvider(client)

    expect(result.outcome).toBe('updated')
    expect(result.credentialId).toBe('cred-drifted')
    expect(credentialsPost).not.toHaveBeenCalled()
    expect(credentialsPut).toHaveBeenCalledWith({
      body: {
        credential_id: 'cred-drifted',
        credentials: expect.objectContaining({ endpoint_url: stubEndpointUrl }),
        model: llmStubModelName,
        model_type: 'llm',
        name: llmStubCredentialName,
      },
      params: { provider: llmStubProviderName },
    })
  })

  it('installs the marketplace plugin when it is missing', async () => {
    vi.stubEnv('E2E_LLM_STUB_INTERNAL_URL', stubEndpointUrl)
    const { client, installMarketplace } = createMockConsoleClient({
      currentCredentialId: 'cred-existing',
      defaultModel: { model: llmStubModelName, provider: llmStubProviderName },
      pluginInstalled: false,
    })

    await ensureStubLlmProvider(client)

    expect(installMarketplace).toHaveBeenCalledWith({
      body: { plugin_unique_identifiers: ['langgenius/openai_api_compatible:1.0.0@marketplace'] },
    })
  })

  it('fails loudly when the provider is not available after plugin bootstrap', async () => {
    vi.stubEnv('E2E_LLM_STUB_INTERNAL_URL', stubEndpointUrl)
    const { client } = createMockConsoleClient({ includeProvider: false })

    await expect(ensureStubLlmProvider(client)).rejects.toThrow(/openai_api_compatible.*not found/i)
  })

  it('fails when the model does not become active after configuration', async () => {
    vi.stubEnv('E2E_LLM_STUB_INTERNAL_URL', stubEndpointUrl)
    const { client } = createMockConsoleClient({
      credentialEndpointUrl: 'http://host.docker.internal:9999/v1',
      currentCredentialId: 'cred-drifted',
      modelStatus: 'no-configure',
    })

    await expect(ensureStubLlmProvider(client)).rejects.toThrow(/not active/i)
  })
})
