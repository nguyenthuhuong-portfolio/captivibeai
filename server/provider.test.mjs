import test from 'node:test'
import assert from 'node:assert/strict'
import { callOpenAI, DEFAULT_OPENAI_MODEL, ProviderError } from './provider.mjs'

const schema = {
  type: 'object',
  properties: { ok: { type: 'boolean' } },
  required: ['ok'],
}

function outputResponse(text) {
  return new Response(JSON.stringify({
    id: 'resp_test',
    status: 'completed',
    output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }],
  }), { status: 200, headers: { 'content-type': 'application/json' } })
}

test('OpenAI provider sends one Responses API request with server key and strict JSON schema', async () => {
  const originalKey = process.env.OPENAI_API_KEY
  const originalModel = process.env.OPENAI_MODEL_ID
  const originalFetch = globalThis.fetch
  process.env.OPENAI_API_KEY = 'unit-test-secret'
  delete process.env.OPENAI_MODEL_ID
  let requestUrl = ''
  let requestOptions
  globalThis.fetch = async (url, options) => {
    requestUrl = String(url)
    requestOptions = options
    return outputResponse('{"ok":true}')
  }

  try {
    const metrics = { providerAttempts: 0, providerLatencyMs: 0 }
    const result = await callOpenAI({
      prompt: 'Create copy', schema, systemInstruction: 'System prompt',
      requestDeadline: Date.now() + 5000, metrics,
    })
    const body = JSON.parse(requestOptions.body)
    assert.equal(result, '{"ok":true}')
    assert.equal(requestUrl, 'https://api.openai.com/v1/responses')
    assert.equal(requestOptions.headers.authorization, 'Bearer unit-test-secret')
    assert.equal(body.model, DEFAULT_OPENAI_MODEL)
    assert.equal(body.reasoning.effort, 'none')
    assert.equal(body.instructions, 'System prompt')
    assert.equal(body.text.format.type, 'json_schema')
    assert.equal(body.text.format.strict, true)
    assert.equal(body.text.format.schema.additionalProperties, false)
    assert.deepEqual(body.text.format.schema.required, ['ok'])
    assert.equal(body.store, false)
    assert.equal(metrics.providerAttempts, 1)
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = originalKey
    if (originalModel === undefined) delete process.env.OPENAI_MODEL_ID
    else process.env.OPENAI_MODEL_ID = originalModel
  }
})

test('OpenAI provider sends attached images as low-detail data URLs', async () => {
  const originalKey = process.env.OPENAI_API_KEY
  const originalFetch = globalThis.fetch
  process.env.OPENAI_API_KEY = 'unit-test-secret'
  let body
  globalThis.fetch = async (_url, options) => {
    body = JSON.parse(options.body)
    return outputResponse('{"ok":true}')
  }
  try {
    await callOpenAI({
      prompt: 'Inspect image', schema, requestDeadline: Date.now() + 5000,
      images: [{ mimeType: 'image/jpeg', bytes: Buffer.from('small-image') }],
    })
    const image = body.input[0].content[1]
    assert.equal(image.type, 'input_image')
    assert.equal(image.detail, 'low')
    assert.match(image.image_url, /^data:image\/jpeg;base64,/)
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = originalKey
  }
})

test('OpenAI provider fails fast without a server key and does not call the API', async () => {
  const originalKey = process.env.OPENAI_API_KEY
  const originalFetch = globalThis.fetch
  delete process.env.OPENAI_API_KEY
  globalThis.fetch = async () => { throw new Error('fetch should not be called') }
  try {
    await assert.rejects(
      callOpenAI({ prompt: 'test', schema, requestDeadline: Date.now() + 3000 }),
      (error) => error instanceof ProviderError && error.code === 'ai_unavailable' && error.attempts === 0,
    )
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey !== undefined) process.env.OPENAI_API_KEY = originalKey
  }
})

test('OpenAI 503 is never retried; caller can immediately use local sample content', async () => {
  const originalKey = process.env.OPENAI_API_KEY
  const originalFetch = globalThis.fetch
  process.env.OPENAI_API_KEY = 'unit-test-secret'
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return new Response('temporarily unavailable', { status: 503 })
  }
  try {
    await assert.rejects(
      callOpenAI({ prompt: 'test', schema, requestDeadline: Date.now() + 5000 }),
      (error) => error instanceof ProviderError
        && error.code === 'provider_overloaded'
        && error.status === 503
        && error.attempts === 1,
    )
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = originalKey
  }
})

test('OpenAI 429 is returned directly without waiting or retrying', async () => {
  const originalKey = process.env.OPENAI_API_KEY
  const originalFetch = globalThis.fetch
  process.env.OPENAI_API_KEY = 'unit-test-secret'
  let calls = 0
  globalThis.fetch = async () => { calls += 1; return new Response('rate limited', { status: 429 }) }
  try {
    await assert.rejects(
      callOpenAI({ prompt: 'test', schema, requestDeadline: Date.now() + 5000 }),
      (error) => error instanceof ProviderError && error.code === 'provider_rate_limited' && error.status === 429,
    )
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = originalKey
  }
})
