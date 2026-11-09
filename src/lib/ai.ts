import type { GeneratedContent, Language, PreviewPlatform, ProductForm, ScoredMeta } from '../types'
import { getImages } from './imageStore'

const ENDPOINT = '/api/ai/generate'
const CLIENT_TIMEOUT_MS = 55_000
const CAPTION_STRATEGIES = ['benefit', 'storytelling', 'problem_solution'] as const
const HEADLINE_STRATEGIES = ['direct_benefit', 'curiosity', 'emotional'] as const

type CaptionStrategy = (typeof CAPTION_STRATEGIES)[number]
type HeadlineStrategy = (typeof HEADLINE_STRATEGIES)[number]
type ApiTone = 'funny' | 'formal' | 'youthful'

interface ScoredItem extends ScoredMeta { text: string }
interface AiFullResponse {
  captions: ScoredItem[]
  headlines: ScoredItem[]
  hashtags: string[]
  image_insights: string[]
}

export class AIRequestError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, status = 0) {
    super(code)
    this.name = 'AIRequestError'
    this.code = code
    this.status = status
  }
}

function apiTone(tone: ProductForm['tone']): ApiTone {
  if (tone === 'professional') return 'formal'
  if (tone === 'genz') return 'youthful'
  return 'funny'
}

async function postApi(body: BodyInit, contentType?: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS)
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: contentType ? { 'content-type': contentType } : undefined,
      body,
      signal: controller.signal,
    })
    const data: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const code =
        typeof data === 'object' && data !== null && 'code' in data && typeof data.code === 'string'
          ? data.code
          : 'ai_failed'
      throw new AIRequestError(code, response.status)
    }
    return data
  } catch (error) {
    if (error instanceof AIRequestError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AIRequestError('ai_timeout', 0)
    }
    throw new AIRequestError('offline', 0)
  } finally {
    window.clearTimeout(timer)
  }
}

function adaptFullResponse(value: unknown): GeneratedContent {
  if (!value || typeof value !== 'object') throw new AIRequestError('ai_invalid_output', 502)
  const response = value as Partial<AiFullResponse>
  if (!Array.isArray(response.captions) || !Array.isArray(response.headlines) || !Array.isArray(response.hashtags)) {
    throw new AIRequestError('ai_invalid_output', 502)
  }
  const captions = [...response.captions].sort((a, b) => CAPTION_STRATEGIES.indexOf(a.strategy as CaptionStrategy) - CAPTION_STRATEGIES.indexOf(b.strategy as CaptionStrategy))
  const headlines = [...response.headlines].sort((a, b) => HEADLINE_STRATEGIES.indexOf(a.strategy as HeadlineStrategy) - HEADLINE_STRATEGIES.indexOf(b.strategy as HeadlineStrategy))
  if (captions.length !== 3 || headlines.length !== 3 || response.hashtags.length !== 5) {
    throw new AIRequestError('ai_invalid_output', 502)
  }
  return {
    captions: captions.map((item) => item.text),
    headlines: headlines.map((item) => item.text),
    hashtags: response.hashtags,
    captionMeta: captions.map(({ strategy, score, feedback }) => ({ strategy, score, feedback })),
    headlineMeta: headlines.map(({ strategy, score, feedback }) => ({ strategy, score, feedback })),
    imageInsights: Array.isArray(response.image_insights) ? response.image_insights : [],
    generationSource: 'ai',
  }
}

function createBasePayload(form: ProductForm, language: Language, platform: PreviewPlatform, inspirationIds: string[] = []) {
  return {
    productName: form.productName.trim(),
    description: form.description.trim(),
    audiences: form.audiences,
    customAudience: form.customAudience?.trim() ?? '',
    tone: apiTone(form.tone),
    outputLanguage: language,
    platformHint: platform,
    objective: form.objective ?? null,
    extraDetails: form.extraDetails?.trim() ?? '',
    inspirationIds: inspirationIds.slice(0, 2),
  }
}

/** Full generation. Images are fetched from IndexedDB and sent as binary parts, never as blob URLs. */
export async function generateWithAI(
  form: ProductForm,
  language: Language,
  platform: PreviewPlatform,
  previous?: GeneratedContent,
  inspirationIds: string[] = [],
): Promise<GeneratedContent> {
  const reusePreviousVisuals = Boolean(previous)
  const blobs = reusePreviousVisuals ? new Map<string, Blob>() : await getImages(form.images.map((image) => image.id))
  const imageEntries = reusePreviousVisuals ? [] : form.images.map((image) => {
    const blob = blobs.get(image.id)
    if (!blob) throw new AIRequestError('image_missing', 0)
    const mimeType = blob.type === 'image/jpg' ? 'image/jpeg' : blob.type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      throw new AIRequestError('unsupported_image_type', 0)
    }
    return { blob, filename: image.name || 'product-image', mimeType, bytes: blob.size }
  })

  const payload = {
    mode: 'full',
    ...createBasePayload(form, language, platform, inspirationIds),
    images: imageEntries.map(({ filename, mimeType, bytes }) => ({ filename, mimeType, bytes })),
    previousImageInsights: reusePreviousVisuals ? previous?.imageInsights ?? [] : [],
    previousCaptions: reusePreviousVisuals ? previous?.captions ?? [] : undefined,
    previousHeadlines: reusePreviousVisuals ? previous?.headlines ?? [] : undefined,
  }

  let body: BodyInit
  let contentType: string | undefined
  if (imageEntries.length > 0) {
    const data = new FormData()
    data.append('payload', JSON.stringify(payload))
    for (const entry of imageEntries) data.append('images', entry.blob, entry.filename)
    body = data
  } else {
    body = JSON.stringify(payload)
    contentType = 'application/json'
  }

  const response = await postApi(body, contentType)
  return adaptFullResponse(response)
}

export type RegenerableKind = 'caption' | 'headline'

export async function regenerateWithAI(
  form: ProductForm,
  content: GeneratedContent,
  kind: RegenerableKind,
  index: number,
  language: Language,
  platform: PreviewPlatform,
  inspirationIds: string[] = [],
): Promise<{ text: string; meta: ScoredMeta }> {
  const strategy = kind === 'caption' ? CAPTION_STRATEGIES[index] : HEADLINE_STRATEGIES[index]
  if (!strategy) throw new AIRequestError('invalid_strategy', 0)
  const payload = {
    mode: 'item',
    ...createBasePayload(form, language, platform, inspirationIds),
    target: { kind, strategy },
    keep: {
      captions: kind === 'caption' ? content.captions.filter((_, item) => item !== index) : content.captions,
      headlines: kind === 'headline' ? content.headlines.filter((_, item) => item !== index) : content.headlines,
    },
    imageInsights: content.imageInsights ?? [],
  }
  const response = await postApi(JSON.stringify(payload), 'application/json')
  if (!response || typeof response !== 'object') throw new AIRequestError('ai_invalid_output', 502)
  const row = response as { itemType?: string; caption?: ScoredItem; headline?: ScoredItem }
  const item = kind === 'caption' ? row.caption : row.headline
  if (row.itemType !== kind || !item || item.strategy !== strategy || typeof item.text !== 'string' || typeof item.score !== 'number' || typeof item.feedback !== 'string') {
    throw new AIRequestError('ai_invalid_output', 502)
  }
  return { text: item.text, meta: { strategy, score: item.score, feedback: item.feedback } }
}
