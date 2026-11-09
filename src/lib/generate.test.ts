import { describe, expect, it } from 'vitest'
import type { ProductForm } from '../types'
import {
  PLATFORM_LIMITS,
  captionLimitLevel,
  feedbackForCaption,
  feedbackForHeadline,
  generateContent,
  regenerateCaption,
  regenerateHeadline,
  scoreContent,
} from './generate'

function brief(overrides: Partial<ProductForm> = {}): ProductForm {
  return {
    productName: 'Sunrise Blend',
    description: 'A bright, fruity coffee for slow mornings.',
    audiences: ['genz'],
    customAudience: '',
    tone: 'professional',
    images: [],
    ...overrides,
  }
}

describe('generateContent', () => {
  it('fills all three cards of both banks with usable copy', () => {
    const generated = generateContent(brief())

    expect(generated.captions).toHaveLength(3)
    expect(generated.headlines).toHaveLength(3)
    expect(generated.captions.every((caption) => caption.trim().length > 0)).toBe(true)
    expect(generated.headlines.every((headline) => headline.trim().length > 0)).toBe(true)
  })

  it('names the product in the copy', () => {
    const { captions } = generateContent(brief())

    expect(captions.some((caption) => caption.includes('Sunrise Blend'))).toBe(true)
  })

  it('keeps the free-text audience in the user’s own wording', () => {
    const { captions } = generateContent(brief({ audiences: [], customAudience: 'cà phê thủ công' }))

    expect(captions.some((caption) => caption.includes('cà phê thủ công'))).toBe(true)
  })

  it('leads the hashtags with a brand tag and never repeats one', () => {
    const { hashtags } = generateContent(brief())

    expect(hashtags[0]).toBe('#SunriseBlend')
    expect(hashtags.length).toBeLessThanOrEqual(5)
    expect(new Set(hashtags).size).toBe(hashtags.length)
    expect(hashtags.every((tag) => tag.startsWith('#'))).toBe(true)
  })

  it('strips punctuation out of the brand tag and falls back to a stand-in name', () => {
    expect(generateContent(brief({ productName: 'Café & Co.' })).hashtags[0]).toBe('#CaféCo')
    expect(generateContent(brief({ productName: '!!!' })).hashtags[0]).toBe('#BrandDrop')
  })

  it('returns a different mix for a different variant', () => {
    const first = generateContent(brief(), 0)
    const second = generateContent(brief(), 1)

    expect(second.captions).not.toEqual(first.captions)
    expect(second.hashtags).not.toEqual(first.hashtags)
  })

  it('writes every card in the one selected tone', () => {
    const funny = generateContent(brief({ tone: 'funny' }))
    const professional = generateContent(brief({ tone: 'professional' }))

    expect(funny.captions).not.toEqual(professional.captions)
    expect(funny.hashtags).not.toEqual(professional.hashtags)
  })

  it('lets the optional objective steer the caption tail', () => {
    const plain = generateContent(brief())
    const promote = generateContent(brief({ objective: 'promote' }))

    expect(promote.captions).not.toEqual(plain.captions)
    expect(promote.captions.every((caption) => caption.length > 0)).toBe(true)
  })

  it('folds the optional free-text detail into the caption', () => {
    const { captions } = generateContent(brief({ extraDetails: 'Hand roasted in small batches' }))

    expect(captions.some((caption) => caption.includes('Hand roasted in small batches'))).toBe(true)
  })
})

describe('item feedback', () => {
  it('flags an empty card rather than scoring it positively', () => {
    expect(feedbackForHeadline('')).toBe('headlineEmpty')
    expect(feedbackForCaption('   ')).toBe('captionEmpty')
  })

  it('asks for a shorter hook once the line runs long', () => {
    expect(
      feedbackForHeadline(
        'An extremely long hook that keeps going well past a quick glance and then rambles on',
      ),
    ).toBe('headlineLong')
  })

  it('returns a code for real generated copy', () => {
    const { headlines, captions } = generateContent(brief())

    expect(feedbackForHeadline(headlines[0])).toMatch(/^headline/)
    expect(feedbackForCaption(captions[0])).toMatch(/^caption/)
  })
})

describe('regenerateCaption', () => {
  it('hands back a caption different from the one on the card', () => {
    const form = brief()
    const { captions } = generateContent(form)

    expect(regenerateCaption(form, captions[0])).not.toBe(captions[0])
  })

  it('avoids copy a sibling card is already showing', () => {
    const form = brief()
    const { captions } = generateContent(form)

    const reRolled = regenerateCaption(form, captions[0], [captions[2]])

    expect(reRolled).not.toBe(captions[0])
    expect(reRolled).not.toBe(captions[2])
  })

  it('still re-rolls when the bank is exhausted rather than refusing', () => {
    const form = brief()
    const { captions } = generateContent(form)

    const reRolled = regenerateCaption(form, captions[0], captions)

    expect(typeof reRolled).toBe('string')
    expect(reRolled.length).toBeGreaterThan(0)
  })

  it('recovers from a value that is not in the bank, such as an older saved card', () => {
    const form = brief()

    expect(regenerateCaption(form, 'hand-written copy from an older entry').length).toBeGreaterThan(0)
  })
})

describe('regenerateHeadline', () => {
  it('hands back a headline different from the one on the card', () => {
    const form = brief()
    const { headlines } = generateContent(form)

    expect(regenerateHeadline(form, headlines[0])).not.toBe(headlines[0])
  })
})

describe('captionLimitLevel', () => {
  it('mirrors the contest’s published ceilings', () => {
    expect(PLATFORM_LIMITS.instagram.limit).toBe(2200)
    expect(PLATFORM_LIMITS.tiktok.limit).toBe(4000)
    expect(PLATFORM_LIMITS.facebook.limit).toBe(63206)
    expect(PLATFORM_LIMITS.x.limit).toBe(280)
  })

  it('turns amber past the warning line and red past the ceiling', () => {
    const { limit, warnAt } = PLATFORM_LIMITS.x

    expect(captionLimitLevel(warnAt, 'x')).toBe('ok')
    expect(captionLimitLevel(warnAt + 1, 'x')).toBe('warning')
    expect(captionLimitLevel(limit, 'x')).toBe('warning')
    expect(captionLimitLevel(limit + 1, 'x')).toBe('over')
  })
})

describe('scoreContent', () => {
  const form = brief()
  const content = generateContent(form)

  it('scores an empty set at zero', () => {
    const score = scoreContent({ captions: [''], headlines: [''], hashtags: [] }, {
      headlineIndex: 0,
      captionIndex: 0,
      selectedHashtags: [],
    })

    expect(score).toEqual({ overall: 0, hook: 0, cta: 0, readability: 0 })
  })

  it('costs reach when hashtags are switched off', () => {
    const full = scoreContent(content, {
      headlineIndex: 0,
      captionIndex: 0,
      selectedHashtags: content.hashtags,
    })
    const stripped = scoreContent(content, { headlineIndex: 0, captionIndex: 0, selectedHashtags: [] })

    expect(stripped.hook).toBeLessThan(full.hook)
    expect(stripped.overall).toBeLessThan(full.overall)
  })

  it('re-scores the moment a different card is selected', () => {
    const selection = { headlineIndex: 0, captionIndex: 0, selectedHashtags: content.hashtags }
    const first = scoreContent(content, selection)
    const second = scoreContent(content, { ...selection, captionIndex: 2 })

    expect(first.overall).not.toBe(second.overall)
  })

  it('stays inside the 0-100 band', () => {
    const score = scoreContent(content, {
      headlineIndex: 0,
      captionIndex: 0,
      selectedHashtags: content.hashtags,
    })

    for (const value of Object.values(score)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    }
  })
})
