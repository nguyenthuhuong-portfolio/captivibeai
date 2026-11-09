import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getImages } from './imageStore'
import { generateWithAI, regenerateWithAI } from './ai'
import type { GeneratedContent, ProductForm } from '../types'

vi.mock('./imageStore', () => ({ getImages: vi.fn() }))

const form: ProductForm = {
  productName: 'Bình giữ nhiệt',
  description: 'Bình inox màu xanh, dung tích 500 ml.',
  audiences: ['students'],
  customAudience: '',
  tone: 'professional',
  objective: 'introduce',
  extraDetails: '',
  images: [],
}

const fullResponse = {
  captions: [
    { strategy: 'problem_solution', text: 'Caption vấn đề', score: 77, feedback: 'Nêu nhu cầu rõ hơn.' },
    { strategy: 'benefit', text: 'Caption lợi ích', score: 85, feedback: 'Làm nổi bật lợi ích chính.' },
    { strategy: 'storytelling', text: 'Caption kể chuyện', score: 81, feedback: 'Rút gọn phần mở đầu.' },
  ],
  headlines: [
    { strategy: 'emotional', text: 'Headline cảm xúc', score: 75, feedback: 'Gắn với sản phẩm hơn.' },
    { strategy: 'direct_benefit', text: 'Headline lợi ích', score: 86, feedback: 'Đưa lợi ích lên trước.' },
    { strategy: 'curiosity', text: 'Headline tò mò', score: 79, feedback: 'Tránh câu hỏi chung.' },
  ],
  hashtags: ['#BinhGiuNhiet', '#DoDung', '#SinhVien', '#VanPhong', '#MangTheo'],
  image_insights: [],
}

beforeEach(() => {
  vi.mocked(getImages).mockResolvedValue(new Map())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('AI frontend adapter', () => {
  it('maps and sorts full AI output into the app content shape', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(fullResponse), { status: 200 })))
    let sentPayload: Record<string, unknown> | undefined
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      sentPayload = JSON.parse(String(init?.body))
      return new Response(JSON.stringify(fullResponse), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await generateWithAI(form, 'vi', 'instagram')

    expect(sentPayload).not.toHaveProperty('knowledgeContext')
    expect(result.captions).toEqual(['Caption lợi ích', 'Caption kể chuyện', 'Caption vấn đề'])
    expect(result.headlines).toEqual(['Headline lợi ích', 'Headline tò mò', 'Headline cảm xúc'])
    expect(result.captionMeta?.map((item) => item?.score)).toEqual([85, 81, 77])
    expect(result.headlineMeta?.map((item) => item?.strategy)).toEqual(['direct_benefit', 'curiosity', 'emotional'])
    expect(result.generationSource).toBe('ai')
  })

  it('sends real image bytes as multipart data, not the blob URL', async () => {
    const imageBlob = new Blob(['compressed-image'], { type: 'image/jpeg' })
    vi.mocked(getImages).mockResolvedValue(new Map([['img-1', imageBlob]]))
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body
      expect(body).toBeInstanceOf(FormData)
      const formData = body as FormData
      const payload = JSON.parse(String(formData.get('payload')))
      expect(payload.images[0].filename).toBe('cup.jpg')
      expect(formData.getAll('images')).toHaveLength(1)
      expect(String(payload.images[0].url ?? '')).not.toContain('blob:')
      return new Response(JSON.stringify(fullResponse), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await generateWithAI({
      ...form,
      images: [{ id: 'img-1', name: 'cup.jpg', size: imageBlob.size, url: 'blob:private-preview-url' }],
    }, 'vi', 'instagram')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('sends a single-item request with siblings and returns strategy metadata', async () => {
    const current: GeneratedContent = {
      captions: ['Caption lợi ích cũ', 'Caption kể chuyện', 'Caption vấn đề'],
      headlines: ['Headline lợi ích', 'Headline tò mò', 'Headline cảm xúc'],
      hashtags: ['#BinhGiuNhiet', '#DoDung', '#SinhVien', '#VanPhong', '#MangTheo'],
      imageInsights: ['Thân bình màu xanh'],
      generationSource: 'ai',
    }
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body))
      expect(payload.mode).toBe('item')
      expect(payload).not.toHaveProperty('knowledgeContext')
      expect(payload.target).toEqual({ kind: 'caption', strategy: 'benefit' })
      expect(payload.keep.captions).toEqual(['Caption kể chuyện', 'Caption vấn đề'])
      expect(payload.keep.headlines).toHaveLength(3)
      expect(payload.imageInsights).toEqual(['Thân bình màu xanh'])
      return new Response(JSON.stringify({
        itemType: 'caption',
        caption: { strategy: 'benefit', text: 'Caption lợi ích mới', score: 88, feedback: 'Nêu lợi ích rõ hơn.' },
      }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await regenerateWithAI(form, current, 'caption', 0, 'vi', 'instagram')
    expect(result.text).toBe('Caption lợi ích mới')
    expect(result.meta.score).toBe(88)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
