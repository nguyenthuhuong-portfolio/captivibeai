import test from 'node:test'
import assert from 'node:assert/strict'
import {
  fullResponseSchema,
  itemResponseSchema,
  parseRequestPayload,
  normalizeCosmetics,
} from './contract.mjs'

const validFull = {
  captions: [
    { strategy: 'benefit', text: 'Một lợi ích cụ thể của sản phẩm.', score: 82, feedback: 'Nêu lợi ích trực tiếp hơn.' },
    { strategy: 'storytelling', text: 'Một khoảnh khắc đời thường dẫn vào sản phẩm.', score: 80, feedback: 'Rút gọn phần mở đầu.' },
    { strategy: 'problem_solution', text: 'Nêu nhu cầu và vai trò của sản phẩm.', score: 78, feedback: 'Cần gắn sát mô tả hơn.' },
  ],
  headlines: [
    { strategy: 'direct_benefit', text: 'Lợi ích được mô tả rõ ràng', score: 82, feedback: 'Đưa tên sản phẩm lên sớm hơn.' },
    { strategy: 'curiosity', text: 'Điều gì tạo nên điểm riêng?', score: 79, feedback: 'Cụ thể hoá câu hỏi.' },
    { strategy: 'emotional', text: 'Một lựa chọn dành cho nhịp sống của bạn', score: 80, feedback: 'Giảm bớt từ trừu tượng.' },
  ],
  hashtags: ['#Aurora', '#Serum', '#Skincare', '#Routine', '#Beauty'],
  image_insights: [],
}

test('full response accepts exactly 3 captions, 3 headlines and 5 unique tags', () => {
  assert.equal(fullResponseSchema.safeParse(validFull).success, true)
})

test('full response rejects duplicate strategies and invalid hashtag counts', () => {
  const invalid = structuredClone(validFull)
  invalid.captions[2].strategy = 'benefit'
  invalid.hashtags.pop()
  assert.equal(fullResponseSchema.safeParse(invalid).success, false)
})

test('input contract maps only supported modes', () => {
  const result = parseRequestPayload({
    mode: 'full', productName: 'Áo sơ mi', description: 'Áo sơ mi cotton', audiences: ['genz'],
    customAudience: '', tone: 'youthful', outputLanguage: 'vi', platformHint: 'facebook', images: [],
  })
  assert.equal(result.success, true)
  assert.equal(parseRequestPayload({ mode: 'wat' }).success, false)
})

test('single-item response requires the requested strategy', () => {
  const schema = itemResponseSchema('caption', 'storytelling')
  assert.equal(schema.safeParse({ itemType: 'caption', caption: { strategy: 'storytelling', text: 'Một mẩu chuyện', score: 78, feedback: 'Mở đầu gọn hơn.' } }).success, true)
  assert.equal(schema.safeParse({ itemType: 'caption', caption: { strategy: 'benefit', text: 'Một lợi ích', score: 78, feedback: 'Mở đầu gọn hơn.' } }).success, false)
})


test('hashtag validation matches the published schema and rejects whitespace or a second hash', () => {
  const valid = structuredClone(validFull)
  valid.hashtags[0] = '#đồ-dùng🚀'
  assert.equal(fullResponseSchema.safeParse(valid).success, true)

  const invalid = structuredClone(validFull)
  invalid.hashtags[0] = '#two words'
  assert.equal(fullResponseSchema.safeParse(invalid).success, false)

  const secondHash = structuredClone(validFull)
  secondHash.hashtags[0] = '#one#two'
  assert.equal(fullResponseSchema.safeParse(secondHash).success, false)
})

test('cosmetic score rounding never turns an out-of-range score into a valid score', () => {
  const candidate = {
    ...structuredClone(validFull),
    captions: structuredClone(validFull.captions),
  }
  candidate.captions[0].score = 84.7
  const normalized = normalizeCosmetics(candidate)
  assert.equal(normalized.captions[0].score, 85)

  const invalid = structuredClone(validFull)
  invalid.captions[0].score = -0.4
  const stillInvalid = normalizeCosmetics(invalid)
  assert.equal(stillInvalid.captions[0].score, -0.4)
  assert.equal(fullResponseSchema.safeParse(stillInvalid).success, false)
})
