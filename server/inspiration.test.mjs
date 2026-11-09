import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRequestPayload } from './contract.mjs'
import { buildFullPrompt, buildItemPrompt } from './prompts.mjs'

const validIdA = 'd9b1b3dc-3f19-4ca0-8c28-5f737b0b2a01'
const validIdB = 'd9b1b3dc-3f19-4ca0-8c28-5f737b0b2a02'

function baseFull(overrides = {}) {
  return {
    mode: 'full', productName: 'Áo TAG', description: 'Áo đấu mùa giải 2026', audiences: [],
    customAudience: '', tone: 'youthful', outputLanguage: 'vi', platformHint: 'facebook',
    images: [], previousImageInsights: [], ...overrides,
  }
}

test('generation request accepts at most two inspiration IDs and removes duplicates', () => {
  const parsed = parseRequestPayload(baseFull({ inspirationIds: [validIdA, validIdA] }))
  assert.equal(parsed.success, true)
  assert.deepEqual(parsed.data.inspirationIds, [validIdA])
})

test('generation request rejects more than two inspiration IDs', () => {
  const parsed = parseRequestPayload(baseFull({ inspirationIds: [validIdA, validIdB, 'd9b1b3dc-3f19-4ca0-8c28-5f737b0b2a03'] }))
  assert.equal(parsed.success, false)
})

test('full prompt treats selected inspiration as style only', () => {
  const prompt = buildFullPrompt({
    productName: 'Áo TAG', description: 'Áo đấu mùa giải 2026', audiences: [], customAudience: 'Fan FC Online',
    tone: 'youthful', outputLanguage: 'vi', platformHint: 'facebook', objective: null,
    extraDetails: '', images: [], inspirationCards: [{
      title: 'Bài cộng đồng đã duyệt', platform: 'facebook', category: 'general',
      stylePatterns: { recommended_style: 'Hook bất ngờ, câu ngắn, gần gũi' },
    }],
  })
  assert.match(prompt, /USER-SELECTED INSPIRATION — STYLE ONLY/)
  assert.match(prompt, /không copy|do not copy/i)
  assert.match(prompt, /Bài cộng đồng đã duyệt/)
})

test('item prompt keeps the selected inspiration style context', () => {
  const prompt = buildItemPrompt({
    productName: 'Áo TAG', description: 'Áo đấu mùa giải 2026', audiences: [], customAudience: '',
    tone: 'youthful', outputLanguage: 'vi', platformHint: 'facebook', objective: null,
    extraDetails: '', mode: 'item', target: { kind: 'caption', strategy: 'benefit' },
    keep: { captions: [], headlines: [] }, imageInsights: [],
    inspirationCards: [{ title: 'Phong cách viral', stylePatterns: { emoji_guidance: 'Emoji đúng ngữ cảnh' } }],
  })
  assert.match(prompt, /USER-SELECTED INSPIRATION — STYLE ONLY/)
  assert.match(prompt, /Phong cách viral/)
})
