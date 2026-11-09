import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HistoryItem } from '../types'
import { getImages } from './imageStore'
import { DEFAULT_TONE } from './options'
import {
  isQuotaError,
  isStorageAvailable,
  loadHistory,
  migrateLegacyImages,
  saveHistory,
} from './storage'

const KEY = 'captivibe.history.v2'
const LEGACY_KEY = 'captivibe.history.v1'
const DATA_URL = 'data:image/png;base64,aGVsbG8='

/** One row exactly as it sits in `localStorage`, before any reviving. */
function storedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'row-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    productName: 'Blend',
    description: 'Fresh',
    audiences: ['genz'],
    customAudience: '',
    tone: 'funny',
    captions: ['c1', 'c2', 'c3'],
    headlines: ['h1', 'h2', 'h3'],
    hashtags: ['#a', '#b'],
    ...overrides,
  }
}

function seed(rows: unknown) {
  localStorage.setItem(KEY, typeof rows === 'string' ? rows : JSON.stringify(rows))
}

/** A revived, ready-to-save entry. */
function item(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id: 'row-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    productName: 'Blend',
    description: 'Fresh',
    audiences: ['genz'],
    customAudience: '',
    tone: 'funny',
    captions: ['c1'],
    headlines: ['h1'],
    hashtags: ['#a'],
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('loadHistory', () => {
  it('starts empty when nothing has been stored', () => {
    expect(loadHistory()).toEqual([])
  })

  it('revives a stored row into a usable entry', () => {
    seed([storedRow()])

    const [restored] = loadHistory()

    expect(restored.id).toBe('row-1')
    expect(restored.productName).toBe('Blend')
    expect(restored.captions).toEqual(['c1', 'c2', 'c3'])
    expect(restored.tone).toBe('funny')
  })

  it('drops only the damaged row and keeps the healthy ones', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    seed([
      storedRow({ id: 'good-1' }),
      { id: '', captions: ['a'], headlines: ['b'], hashtags: [] },
      null,
      storedRow({ id: 'good-2' }),
    ])

    const items = loadHistory()

    expect(items.map((entry) => entry.id)).toEqual(['good-1', 'good-2'])
  })

  it('drops a row that has no copy to show', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    seed([storedRow({ id: 'no-copy', captions: undefined })])

    expect(loadHistory()).toEqual([])
  })

  it('survives a truncated JSON payload', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    seed('[{"id":"a",')

    expect(loadHistory()).toEqual([])
  })

  it('ignores a payload that is not a list at all', () => {
    seed({ id: 'a' })

    expect(loadHistory()).toEqual([])
  })

  it('filters non-string entries out of stored lists', () => {
    seed([storedRow({ captions: ['ok', 42, null] })])

    expect(loadHistory()[0].captions).toEqual(['ok'])
  })

  it('falls back to the default tone when the stored one is no longer offered', () => {
    seed([storedRow({ tone: 'sincere' })])

    expect(loadHistory()[0].tone).toBe(DEFAULT_TONE)
  })

  it('reads a pre-IndexedDB single-image row into a pending payload', () => {
    seed([storedRow({ image: DATA_URL, imageName: 'legacy.png' })])

    const [restored] = loadHistory()

    expect(restored.legacyImages).toEqual([DATA_URL])
    expect(restored.imageNames).toEqual(['legacy.png'])
  })

  it('leaves already-stored image keys alone', () => {
    seed([storedRow({ imageIds: ['img-1'], imageNames: ['a.png'] })])

    const [restored] = loadHistory()

    expect(restored.imageIds).toEqual(['img-1'])
    expect(restored.legacyImages).toBeUndefined()
  })

  it('clears the superseded v1 key on the way in', () => {
    localStorage.setItem(LEGACY_KEY, '[]')

    loadHistory()

    expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
  })

  it('starts empty rather than throwing when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })

    expect(loadHistory()).toEqual([])
  })
})

describe('saveHistory', () => {
  it('writes the rows and reports success', async () => {
    await expect(saveHistory([item()])).resolves.toBe('saved')

    const written = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    expect(written).toHaveLength(1)
    expect(written[0].id).toBe('row-1')
  })

  it('reports failure and leaves the previous snapshot untouched', async () => {
    seed([storedRow({ id: 'previous' })])
    const before = localStorage.getItem(KEY)

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const error = new Error('quota')
      error.name = 'QuotaExceededError'
      throw error
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(saveHistory([item({ id: 'new' })])).resolves.toBe('failed')

    vi.restoreAllMocks()
    expect(localStorage.getItem(KEY)).toBe(before)
  })

  it('writes an un-migrated payload back exactly as it was read', async () => {
    await saveHistory([item({ legacyImages: [DATA_URL] })])

    const [written] = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    expect(written.images).toEqual([DATA_URL])
  })

  it('round-trips: what is written is exactly what a fresh read returns', async () => {
    await saveHistory([item({ id: 'kept', customAudience: 'teens', tone: 'professional' })])

    const [restored] = loadHistory()

    expect(restored.id).toBe('kept')
    expect(restored.productName).toBe('Blend')
    expect(restored.customAudience).toBe('teens')
    expect(restored.tone).toBe('professional')
  })

  it('updates one row without disturbing its neighbours', async () => {
    seed([storedRow({ id: 'a', captions: ['old'] }), storedRow({ id: 'b', productName: 'Other' })])

    const edited = loadHistory().map((entry) =>
      entry.id === 'a' ? { ...entry, captions: ['new'] } : entry,
    )
    await saveHistory(edited)

    const back = loadHistory()
    expect(back.find((entry) => entry.id === 'a')?.captions).toEqual(['new'])
    expect(back.find((entry) => entry.id === 'b')?.productName).toBe('Other')
  })

  it('writes overlapping saves in the order they were asked for', async () => {
    // A first save held open inside the quota probe is exactly the window a second save can slip
    // through. Serialising the writes is what stops the slow older snapshot landing last.
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let call = 0
    vi.stubGlobal('navigator', {
      storage: {
        estimate: vi.fn(async () => {
          call += 1
          if (call === 1) await gate
          return { quota: 1_000_000_000, usage: 0 }
        }),
      },
    })

    const first = saveHistory([item({ id: 'older' })])
    const second = saveHistory([item({ id: 'newer' })])
    release()
    await Promise.all([first, second])

    const written = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    expect(written[0].id).toBe('newer')
  })

  it('reports failure rather than throwing when the browser refuses storage outright', async () => {
    seed([storedRow({ id: 'previous' })])
    const before = localStorage.getItem(KEY)

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const error = new Error('denied')
      error.name = 'SecurityError'
      throw error
    })

    await expect(saveHistory([item({ id: 'new' })])).resolves.toBe('failed')

    vi.restoreAllMocks()
    expect(localStorage.getItem(KEY)).toBe(before)
  })
})

describe('isStorageAvailable', () => {
  it('is true where a probe write goes through', () => {
    expect(isStorageAvailable()).toBe(true)
  })

  it('is false where every write throws, such as a locked-down private session', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })

    expect(isStorageAvailable()).toBe(false)
  })
})

describe('isQuotaError', () => {
  it('recognises the browser quota errors', () => {
    expect(isQuotaError({ name: 'QuotaExceededError' })).toBe(true)
    expect(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true)
    expect(isQuotaError({ code: 22 })).toBe(true)
    expect(isQuotaError(new Error('nope'))).toBe(false)
    expect(isQuotaError(null)).toBe(false)
  })
})

describe('migrateLegacyImages', () => {
  it('does nothing when no row carries an un-migrated payload', async () => {
    const items = [item()]

    const result = await migrateLegacyImages(items)

    expect(result).toEqual({ migrated: 0, failed: 0, items })
  })

  it('moves a payload into IndexedDB and clears it from the row', async () => {
    const result = await migrateLegacyImages([item({ legacyImages: [DATA_URL] })])

    expect(result.migrated).toBe(1)
    expect(result.failed).toBe(0)

    const [migrated] = result.items
    expect(migrated.legacyImages).toBeUndefined()
    expect(migrated.imageIds).toHaveLength(1)

    const stored = await getImages(migrated.imageIds ?? [])
    expect(stored.size).toBe(1)
    expect(stored.get(migrated.imageIds![0])?.size).toBe(5)
  })

  it('is safe to run twice: the same bytes land on the same key', async () => {
    const first = await migrateLegacyImages([item({ legacyImages: [DATA_URL] })])
    const second = await migrateLegacyImages(first.items)

    expect(second.migrated).toBe(0)
    expect(second.items[0].imageIds).toEqual(first.items[0].imageIds)
  })

  it('keeps a payload it could not decode for a later attempt', async () => {
    const result = await migrateLegacyImages([item({ legacyImages: ['data:image/png;base64,@@bad@@'] })])

    expect(result.migrated).toBe(0)
    expect(result.failed).toBe(1)
    expect(result.items[0].legacyImages).toEqual(['data:image/png;base64,@@bad@@'])
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
