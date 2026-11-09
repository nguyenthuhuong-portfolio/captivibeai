const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
export const DEFAULT_OPENAI_MODEL = 'gpt-6-luna'

export class ProviderError extends Error {
  constructor(code, status = 502, retryable = false, options = {}) {
    super(code)
    this.name = 'ProviderError'
    this.code = code
    this.status = status
    this.retryable = retryable
    this.upstreamStatus = options.upstreamStatus ?? null
    this.attempts = options.attempts ?? 1
    this.details = options.details ?? null
  }
}

function strictSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema
  const copy = structuredClone(schema)
  const visit = (node) => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'object') {
      node.additionalProperties = false
      if (node.properties && typeof node.properties === 'object') {
        node.required = Object.keys(node.properties)
        for (const child of Object.values(node.properties)) visit(child)
      }
    }
    if (node.type === 'array' && node.items) visit(node.items)
  }
  visit(copy)
  return copy
}

function extractOutputText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim()

  const parts = []
  for (const item of data?.output ?? []) {
    if (item?.type === 'message') {
      for (const content of item.content ?? []) {
        if (content?.type === 'output_text' && typeof content.text === 'string') parts.push(content.text)
        if (content?.type === 'refusal') throw new ProviderError('provider_refusal', 422, false)
      }
    }
  }

  const result = parts.join('\n').trim()
  if (result) return result
  if (data?.status === 'incomplete') throw new ProviderError('provider_incomplete_output', 502, false)
  throw new ProviderError('empty_output', 502, false)
}

function mapHttpError(status) {
  if (status === 401 || status === 403) return new ProviderError('openai_auth_error', 503, false, { upstreamStatus: status })
  if (status === 429) return new ProviderError('provider_rate_limited', 429, false, { upstreamStatus: status })
  if (status === 503 || status === 529) return new ProviderError('provider_overloaded', 503, false, { upstreamStatus: status })
  if (status >= 500) return new ProviderError('provider_temporary_error', 502, false, { upstreamStatus: status })
  return new ProviderError('provider_rejected', 502, false, { upstreamStatus: status })
}

/** One OpenAI request only. The caller falls back to local sample content on every failure. */
export async function callOpenAI({
  prompt,
  images = [],
  schema,
  signal,
  requestDeadline,
  systemInstruction,
  maxOutputTokens = 1800,
  metrics,
}) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new ProviderError('ai_unavailable', 503, false, { attempts: 0 })

  const remainingMs = requestDeadline - Date.now()
  if (remainingMs <= 250) throw new ProviderError('provider_timeout', 504, false, { attempts: 0 })

  const started = Date.now()
  if (metrics) metrics.providerAttempts = 1

  const timeoutSignal = AbortSignal.timeout(remainingMs)
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
  const content = [{ type: 'input_text', text: prompt }]
  for (const image of images) {
    const base64 = image.bytes.toString('base64')
    content.push({
      type: 'input_image',
      image_url: `data:${image.mimeType};base64,${base64}`,
      detail: 'low',
    })
  }

  let response
  try {
    response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL_ID || DEFAULT_OPENAI_MODEL,
        reasoning: { effort: 'none' },
        instructions: systemInstruction || '',
        input: [{ role: 'user', content }],
        text: {
          format: {
            type: 'json_schema',
            name: 'captivibe_generation',
            strict: true,
            schema: strictSchema(schema),
          },
          verbosity: 'low',
        },
        max_output_tokens: maxOutputTokens,
        store: false,
      }),
      signal: combinedSignal,
    })
  } catch (error) {
    if (signal?.aborted) throw new ProviderError('request_aborted', 499, false, { attempts: 1 })
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new ProviderError('provider_timeout', 504, false, { attempts: 1 })
    }
    throw new ProviderError('provider_network', 502, false, { attempts: 1 })
  } finally {
    if (metrics) metrics.providerLatencyMs = (metrics.providerLatencyMs || 0) + Date.now() - started
  }

  if (!response.ok) {
    try { await response.body?.cancel() } catch { /* ignore */ }
    throw mapHttpError(response.status)
  }

  let data
  try {
    data = await response.json()
  } catch {
    throw new ProviderError('invalid_provider_response', 502, false, { attempts: 1 })
  }
  return extractOutputText(data)
}
