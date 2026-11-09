import { z } from 'zod'

export const CAPTION_STRATEGIES = ['benefit', 'storytelling', 'problem_solution']
export const HEADLINE_STRATEGIES = ['direct_benefit', 'curiosity', 'emotional']
export const AUDIENCES = ['genz', 'millennials', 'professionals', 'parents', 'students', 'fitness', 'creators', 'luxury']
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024
export const IMAGE_TOTAL_MAX_BYTES = 20 * 1024 * 1024

const trimmed = (max) => z.string().trim().min(1).max(max)
const audienceList = z.array(z.enum(AUDIENCES)).max(8).transform((values) => [...new Set(values)])
const common = {
  productName: trimmed(80),
  description: trimmed(500),
  audiences: audienceList.default([]),
  customAudience: z.string().trim().max(150).default(''),
  tone: z.enum(['funny', 'formal', 'youthful']),
  outputLanguage: z.enum(['vi', 'en']).default('vi'),
  platformHint: z.enum(['instagram', 'tiktok', 'facebook', 'x']).nullable().default(null),
  objective: z.enum(['introduce', 'engage', 'promote', 'educate']).nullable().optional(),
  extraDetails: z.string().trim().max(200).default(''),
  inspirationIds: z.array(z.string().uuid()).max(2).default([]).transform((ids) => [...new Set(ids)]),
}

const imageDescriptor = z.object({
  filename: z.string().trim().max(255).default('image'),
  mimeType: z.enum(ACCEPTED_IMAGE_TYPES),
  bytes: z.number().int().positive().max(IMAGE_MAX_BYTES),
}).strict()

const fullRequestSchema = z.object({
  mode: z.literal('full'),
  ...common,
  images: z.array(imageDescriptor).max(4).default([]),
  previousImageInsights: z.array(z.string().trim().min(1).max(160)).max(3).default([]),
  previousCaptions: z.array(z.string().max(4000)).max(3).optional(),
  previousHeadlines: z.array(z.string().max(300)).max(3).optional(),
}).strict().superRefine((value, ctx) => {
  const total = value.images.reduce((sum, item) => sum + item.bytes, 0)
  if (total > IMAGE_TOTAL_MAX_BYTES) ctx.addIssue({ code: 'custom', path: ['images'], message: 'images_too_large' })
})

const itemRequestSchema = z.object({
  mode: z.literal('item'),
  ...common,
  target: z.object({
    kind: z.enum(['caption', 'headline']),
    strategy: z.string().min(1),
  }).strict(),
  keep: z.object({
    captions: z.array(z.string().max(4000)).max(3),
    headlines: z.array(z.string().max(300)).max(3),
  }).strict(),
  imageInsights: z.array(z.string().trim().min(1).max(160)).max(3).default([]),
}).strict().superRefine((value, ctx) => {
  const allowed = value.target.kind === 'caption' ? CAPTION_STRATEGIES : HEADLINE_STRATEGIES
  if (!allowed.includes(value.target.strategy)) {
    ctx.addIssue({ code: 'custom', path: ['target', 'strategy'], message: 'invalid_strategy' })
  }
  const expectedCaptions = value.target.kind === 'caption' ? 2 : 3
  const expectedHeadlines = value.target.kind === 'headline' ? 2 : 3
  if (value.keep.captions.length !== expectedCaptions) ctx.addIssue({ code: 'custom', path: ['keep', 'captions'], message: 'invalid_keep' })
  if (value.keep.headlines.length !== expectedHeadlines) ctx.addIssue({ code: 'custom', path: ['keep', 'headlines'], message: 'invalid_keep' })
})

export function parseRequestPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { success: false, error: { code: 'invalid_payload' } }
  const schema = value.mode === 'full' ? fullRequestSchema : value.mode === 'item' ? itemRequestSchema : null
  if (!schema) return { success: false, error: { code: 'invalid_mode' } }
  const result = schema.safeParse(value)
  if (!result.success) {
    const issue = result.error.issues[0]
    const field = issue?.path?.join('.') || 'payload'
    const message = issue?.message || 'invalid_payload'
    let code = message
    if (message === 'Too small: expected string to have >=1 characters') code = field === 'productName' ? 'invalid_product_name' : 'invalid_description'
    else if (field.startsWith('images')) code = message === 'images_too_large' ? message : 'invalid_images'
    else if (field === 'target.strategy') code = 'invalid_strategy'
    else if (field === 'tone') code = 'invalid_tone'
    else if (field === 'outputLanguage') code = 'invalid_language'
    else if (field === 'productName') code = 'invalid_product_name'
    else if (field === 'description') code = 'invalid_description'
    else if (field.startsWith('audiences')) code = 'invalid_audience'
    else if (field === 'customAudience') code = 'invalid_custom_audience'
    else if (field === 'extraDetails') code = 'invalid_extra_details'
    return { success: false, error: { code, field } }
  }
  return { success: true, data: result.data }
}

const captionSchema = z.object({
  strategy: z.enum(CAPTION_STRATEGIES),
  text: trimmed(4000),
  score: z.number().min(0).max(100),
  feedback: trimmed(120),
}).strict()
const headlineSchema = z.object({
  strategy: z.enum(HEADLINE_STRATEGIES),
  text: trimmed(300),
  score: z.number().min(0).max(100),
  feedback: trimmed(120),
}).strict()
const tagSchema = z.string().trim().min(2).max(40).regex(/^#[^\s#]+$/u)
const insightsSchema = z.array(trimmed(160)).max(3)

const normalise = (value) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
function similarity(a, b) {
  const first = new Set(normalise(a).split(/\s+/).filter(Boolean))
  const second = new Set(normalise(b).split(/\s+/).filter(Boolean))
  const intersection = [...first].filter((token) => second.has(token)).length
  return intersection / (first.size + second.size - intersection || 1)
}
function uniqueStrategies(items, expected, ctx, label) {
  for (const strategy of expected) {
    const found = items.filter((item) => item.strategy === strategy).length
    if (found !== 1) ctx.addIssue({ code: 'custom', message: `${label}: expected one ${strategy}, got ${found}` })
  }
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      if (similarity(items[i].text, items[j].text) >= 0.8) {
        ctx.addIssue({ code: 'custom', message: `${label} ${i + 1} and ${j + 1} are too similar` })
      }
    }
  }
}

export const fullResponseSchema = z.object({
  captions: z.array(captionSchema).length(3).superRefine((items, ctx) => uniqueStrategies(items, CAPTION_STRATEGIES, ctx, 'captions')),
  headlines: z.array(headlineSchema).length(3).superRefine((items, ctx) => uniqueStrategies(items, HEADLINE_STRATEGIES, ctx, 'headlines')),
  hashtags: z.array(tagSchema).length(5).superRefine((items, ctx) => {
    const keys = items.map(normalise)
    if (new Set(keys).size !== keys.length) ctx.addIssue({ code: 'custom', message: 'hashtags contain duplicates' })
  }),
  image_insights: insightsSchema,
}).strict()

export function itemResponseSchema(kind, strategy) {
  if (kind === 'caption') {
    return z.object({ itemType: z.literal('caption'), caption: captionSchema }).strict().superRefine((value, ctx) => {
      if (value.caption.strategy !== strategy) ctx.addIssue({ code: 'custom', path: ['caption', 'strategy'], message: 'wrong_strategy' })
    })
  }
  return z.object({ itemType: z.literal('headline'), headline: headlineSchema }).strict().superRefine((value, ctx) => {
    if (value.headline.strategy !== strategy) ctx.addIssue({ code: 'custom', path: ['headline', 'strategy'], message: 'wrong_strategy' })
  })
}

export const PROVIDER_FULL_SCHEMA = {
  type: 'object',
  properties: {
    captions: { type: 'array', items: { type: 'object', properties: { strategy: { type: 'string', enum: CAPTION_STRATEGIES }, text: { type: 'string' }, score: { type: 'integer' }, feedback: { type: 'string' } }, required: ['strategy', 'text', 'score', 'feedback'] } },
    headlines: { type: 'array', items: { type: 'object', properties: { strategy: { type: 'string', enum: HEADLINE_STRATEGIES }, text: { type: 'string' }, score: { type: 'integer' }, feedback: { type: 'string' } }, required: ['strategy', 'text', 'score', 'feedback'] } },
    hashtags: { type: 'array', items: { type: 'string' } },
    image_insights: { type: 'array', items: { type: 'string' } },
  },
  required: ['captions', 'headlines', 'hashtags', 'image_insights'],
}

export function providerItemSchema(kind, strategy) {
  const isCaption = kind === 'caption'
  const key = isCaption ? 'caption' : 'headline'
  const item = {
    type: 'object',
    properties: {
      strategy: { type: 'string', enum: [strategy] },
      text: { type: 'string' },
      score: { type: 'integer' },
      feedback: { type: 'string' },
    },
    required: ['strategy', 'text', 'score', 'feedback'],
  }
  return {
    type: 'object',
    properties: { itemType: { type: 'string', enum: [kind] }, [key]: item },
    required: ['itemType', key],
  }
}

export function normalizeCosmetics(value) {
  if (!value || typeof value !== 'object') return value
  const copy = structuredClone(value)
  const trimItem = (item) => {
    if (!item || typeof item !== 'object') return
    if (typeof item.text === 'string') item.text = item.text.trim()
    if (typeof item.score === 'number' && item.score >= 0 && item.score <= 100 && !Number.isInteger(item.score)) item.score = Math.round(item.score)
    if (typeof item.feedback === 'string' && item.feedback.length > 120) {
      const prefix = item.feedback.slice(0, 120)
      item.feedback = prefix.replace(/\s+\S*$/, '').trim() || prefix.trim()
    } else if (typeof item.feedback === 'string') item.feedback = item.feedback.trim()
  }
  for (const item of copy.captions ?? []) trimItem(item)
  for (const item of copy.headlines ?? []) trimItem(item)
  if (copy.caption) trimItem(copy.caption)
  if (copy.headline) trimItem(copy.headline)
  if (Array.isArray(copy.hashtags)) copy.hashtags = copy.hashtags.map((tag) => typeof tag === 'string' ? tag.trim() : tag)
  if (Array.isArray(copy.image_insights)) copy.image_insights = copy.image_insights.map((tag) => typeof tag === 'string' ? tag.trim() : tag)
  return copy
}
