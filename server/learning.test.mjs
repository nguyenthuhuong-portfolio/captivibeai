import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeLearningReference, normalizeLearningOutput, parseLearningRequest } from './learning.mjs'

test('accepts an authenticated personal reference with pasted content', () => {
  const result = parseLearningRequest({
    scope: 'personal',
    title: 'Beauty hook',
    sourceUrl: '',
    referenceText: 'Một caption tham khảo đủ nội dung để phân tích phong cách.',
    platform: 'instagram',
    category: 'beauty',
  })
  assert.equal(result.success, true)
  assert.equal(result.data.scope, 'personal')
})

test('requires a URL or pasted reference text', () => {
  const result = parseLearningRequest({ scope: 'global', title: 'Empty', platform: 'all', category: 'general' })
  assert.equal(result.success, false)
  assert.equal(result.code, 'reference_required')
})

test('rejects non-HTTPS URLs', () => {
  const result = parseLearningRequest({
    scope: 'global', title: 'Bad URL', sourceUrl: 'http://example.com/post',
    referenceText: '', platform: 'all', category: 'general',
  })
  assert.equal(result.success, false)
  assert.equal(result.code, 'invalid_reference_url')
})

test('rejects unsupported platform values', () => {
  const result = parseLearningRequest({
    scope: 'global', title: 'Bad platform', sourceUrl: 'https://example.com/post',
    referenceText: '', platform: 'threads', category: 'general',
  })
  assert.equal(result.success, false)
  assert.equal(result.code, 'invalid_learning_request')
})


test('does not pretend to read a URL when no post text was pasted', async () => {
  const result = await analyzeLearningReference({
    title: 'Community post', sourceUrl: 'https://example.com/post', referenceText: '',
    platform: 'facebook', category: 'general',
  }, undefined, Date.now() + 1000)
  assert.equal(result.source_status, 'url_unavailable')
  assert.match(result.summary, /Paste the caption or post content/)
})


test('normalizes harmless model output variations before schema validation', () => {
  const result = normalizeLearningOutput({
    summary: '  Phân tích phong cách bài viết với cách mở đầu trực diện và nhịp nhanh.  ',
    recommended_style: 'Năng động, gần gũi',
    hook_patterns: ['Mở bằng câu hỏi bất ngờ'.repeat(20), '', 4, 'Dẫn vào vấn đề'],
    structure_patterns: [],
    emoji_guidance: 'Dùng emoji ở headline và điểm nhấn',
    tone_patterns: ['Thân thiện'],
    cta_patterns: [], hashtag_patterns: [], do_patterns: [], avoid_patterns: [],
    quality_score: 87.7,
  })
  assert.equal(result.source_status, 'text_only')
  assert.equal(result.quality_score, 88)
  assert.equal(result.hook_patterns.length, 2)
  assert.equal(result.hook_patterns[0].length, 180)
  assert.deepEqual(result.structure_patterns, [])
})

test('supplies safe defaults when optional style lists are omitted', () => {
  const result = normalizeLearningOutput({})
  assert.match(result.summary, /Phân tích/)
  assert.deepEqual(result.hook_patterns, [])
  assert.equal(result.quality_score, 0)
})
