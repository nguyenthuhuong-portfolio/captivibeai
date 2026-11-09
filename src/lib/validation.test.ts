import { describe, expect, it } from 'vitest'
import type { ProductForm } from '../types'
import { TEXT_LIMITS } from './limits'
import { isBriefValid, trimBrief, validateBrief } from './validation'

/** A brief that passes every rule; each test spoils exactly one field. */
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

describe('validateBrief', () => {
  it('reports nothing for a complete brief', () => {
    expect(validateBrief(brief())).toEqual({})
  })

  it('requires the product name and the description', () => {
    expect(validateBrief(brief({ productName: '' })).productName).toBe('required')
    expect(validateBrief(brief({ description: '' })).description).toBe('required')
  })

  it('treats a field holding only whitespace as empty', () => {
    const issues = validateBrief(brief({ productName: '   \n\t ', description: '  ' }))

    expect(issues.productName).toBe('required')
    expect(issues.description).toBe('required')
  })

  it('requires at least one audience segment', () => {
    expect(validateBrief(brief({ audiences: [] })).audiences).toBe('required')
  })

  it('measures length after trimming, so padding is never what overflows', () => {
    const padded = `  ${'a'.repeat(TEXT_LIMITS.productName)}  `

    expect(validateBrief(brief({ productName: padded })).productName).toBeUndefined()
  })

  it('rejects a product name one character past its ceiling', () => {
    const exact = 'a'.repeat(TEXT_LIMITS.productName)
    const over = 'a'.repeat(TEXT_LIMITS.productName + 1)

    expect(validateBrief(brief({ productName: exact })).productName).toBeUndefined()
    expect(validateBrief(brief({ productName: over })).productName).toBe('tooLong')
  })

  it('rejects a description one character past its ceiling', () => {
    const over = 'b'.repeat(TEXT_LIMITS.description + 1)

    expect(validateBrief(brief({ description: over })).description).toBe('tooLong')
  })

  it('only ever reports a length problem for the optional audience', () => {
    const over = 'c'.repeat(TEXT_LIMITS.audience + 1)

    expect(validateBrief(brief({ customAudience: over })).customAudience).toBe('tooLong')
    expect(validateBrief(brief({ customAudience: '' })).customAudience).toBeUndefined()
    expect(validateBrief(brief({ customAudience: undefined })).customAudience).toBeUndefined()
  })

  it('reports every broken field in a single pass', () => {
    const issues = validateBrief(brief({ productName: '', description: '', audiences: [] }))

    expect(issues).toEqual({
      productName: 'required',
      description: 'required',
      audiences: 'required',
    })
  })
})

describe('isBriefValid', () => {
  it('is true only when the rule engine reported nothing', () => {
    expect(isBriefValid({})).toBe(true)
    expect(isBriefValid({ productName: 'required' })).toBe(false)
  })
})

describe('trimBrief', () => {
  it('strips the padding around every text field', () => {
    const trimmed = trimBrief(
      brief({ productName: '  Blend  ', description: '\n Fresh \n', customAudience: '  teens  ' }),
    )

    expect(trimmed.productName).toBe('Blend')
    expect(trimmed.description).toBe('Fresh')
    expect(trimmed.customAudience).toBe('teens')
  })

  it('leaves the rest of the brief untouched', () => {
    const images = [{ id: 'i', name: 'a.png', size: 1, url: 'blob:x' }]
    const trimmed = trimBrief(brief({ audiences: ['luxury'], tone: 'funny', images }))

    expect(trimmed.audiences).toEqual(['luxury'])
    expect(trimmed.tone).toBe('funny')
    expect(trimmed.images).toBe(images)
  })
})
