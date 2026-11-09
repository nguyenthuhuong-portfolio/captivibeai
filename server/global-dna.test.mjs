import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGlobalDna, hashGlobalDnaSources, parseGlobalDnaSources } from './global-dna.mjs'

const sourceSet = () => Array.from({ length: 10 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  position: index + 1,
  title: `Admin seed ${index + 1}`,
  source_text: `A sufficiently detailed original marketing post sample number ${index + 1} with a hook, clear benefits and an appropriate next step.`,
}))

const profile = {
  brand_voice: 'Friendly, confident and conversational while remaining credible and clear.',
  hook_patterns: ['Open with a relatable moment.', 'Ask a useful question.', 'Lead with a clear benefit.'],
  rhythm_and_structure: 'Use varied sentence lengths and short paragraphs with visual breathing room.',
  emoji_style: 'Use relevant emojis as signposts, not decoration, and keep formal copy restrained.',
  persuasion_patterns: ['Explain the practical value.', 'Make benefits easy to scan.', 'Build confidence without pressure.'],
  cta_style: 'End with one natural next step that is supported by the current brief.',
  wording_preferences: ['Use concrete verbs.', 'Prefer conversational phrasing.', 'Avoid empty superlatives.'],
  do_rules: ['Keep the hook specific.', 'Use natural line breaks.', 'Vary the copy angle.', 'Make benefits scannable.'],
  avoid_rules: ['Do not invent claims.', 'Avoid generic openings.', 'Do not copy source wording.', 'Avoid forced emoji strings.'],
}

test('requires exactly ten admin seed source posts', () => {
  assert.equal(parseGlobalDnaSources(sourceSet()).success, true)
  assert.equal(parseGlobalDnaSources(sourceSet().slice(0, 9)).code, 'dna_requires_exactly_10_sources')
})

test('hashes source snapshots deterministically regardless of array order', () => {
  const sources = sourceSet()
  assert.equal(hashGlobalDnaSources(sources), hashGlobalDnaSources([...sources].reverse()))
  assert.notEqual(hashGlobalDnaSources(sources), hashGlobalDnaSources(sources.map((row, index) => index === 0 ? { ...row, title: 'Changed admin title' } : row)))
})

test('rejects invalid positions, short content and oversized combined sources', () => {
  const duplicatePosition = sourceSet()
  duplicatePosition[9].position = 9
  assert.equal(parseGlobalDnaSources(duplicatePosition).code, 'dna_source_positions_invalid')

  const shortPost = sourceSet()
  shortPost[0].source_text = 'Too short'
  assert.equal(parseGlobalDnaSources(shortPost).success, false)

  const oversized = sourceSet().map((row) => ({ ...row, source_text: row.source_text.padEnd(3100, 'x') }))
  assert.equal(parseGlobalDnaSources(oversized).code, 'dna_sources_too_long')
})

test('builds one compact profile with one provider request for all ten posts', async () => {
  const previousFetch = global.fetch
  const previousKey = process.env.OPENAI_API_KEY
  let calls = 0
  let sentBody
  process.env.OPENAI_API_KEY = 'test-key'
  global.fetch = async (_url, init) => {
    calls += 1
    sentBody = JSON.parse(init.body)
    return new Response(JSON.stringify({ output_text: JSON.stringify({ profile }) }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    const result = await buildGlobalDna(sourceSet(), new AbortController().signal, Date.now() + 5000, {})
    assert.deepEqual(result, profile)
    assert.equal(calls, 1)
    assert.equal(sentBody.reasoning.effort, 'none')
    assert.equal(sentBody.store, false)
    assert.equal(sentBody.max_output_tokens, 1400)
    assert.match(sentBody.input[0].content[0].text, /exactly ten admin-selected writing examples/i)
  } finally {
    global.fetch = previousFetch
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previousKey
  }
})


test('reports only safe schema diagnostics when the provider output misses a field constraint', async () => {
  const previousFetch = global.fetch
  const previousKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = 'test-key'
  global.fetch = async () => new Response(JSON.stringify({
    output_text: JSON.stringify({ profile: { ...profile, brand_voice: 'Too short' } }),
  }), { status: 200, headers: { 'content-type': 'application/json' } })

  try {
    await assert.rejects(
      buildGlobalDna(sourceSet(), new AbortController().signal, Date.now() + 5000, {}),
      (error) => {
        assert.equal(error.code, 'dna_invalid_output')
        assert.equal(error.details?.reason, 'schema_validation')
        assert.ok(error.details?.issues?.some((issue) => issue.path === 'brand_voice'))
        assert.equal(JSON.stringify(error.details).includes('Too short'), false)
        return true
      },
    )
  } finally {
    global.fetch = previousFetch
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previousKey
  }
})
