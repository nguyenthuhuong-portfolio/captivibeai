import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearImages, getImages, putImage } from '../lib/imageStore'
import type { GeneratedContent, HistoryItem, ProductForm } from '../types'
import { useHistory } from './useHistory'

const KEY = 'captivibe.history.v2'

function storedRow(overrides: Record<string, unknown> = {}) {
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

function seed(rows: unknown[]) {
  localStorage.setItem(KEY, JSON.stringify(rows))
}

function form(images: ProductForm['images'] = []): ProductForm {
  return {
    productName: 'Blend',
    description: 'Fresh',
    audiences: ['genz'],
    customAudience: '',
    tone: 'funny',
    images,
  }
}

function content(label: string): GeneratedContent {
  return { captions: [`caption ${label}`], headlines: [`headline ${label}`], hashtags: ['#x'] }
}

function image(id: string) {
  return { id, name: `${id}.png`, size: 10, url: `blob:${id}` }
}

beforeEach(async () => {
  localStorage.clear()
  await clearImages()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('useHistory', () => {
  it('opens with the rows already in storage', () => {
    seed([storedRow({ id: 'saved' })])

    const { result } = renderHook(() => useHistory())

    expect(result.current.items.map((item) => item.id)).toEqual(['saved'])
  })

  it('puts a newly generated entry at the top and persists it', async () => {
    seed([storedRow({ id: 'older' })])
    const { result } = renderHook(() => useHistory())

    act(() => {
      result.current.addItem(form(), content('new'))
    })

    expect(result.current.items).toHaveLength(2)
    expect(result.current.items[0].captions).toEqual(['caption new'])

    await waitFor(() => {
      const written = JSON.parse(localStorage.getItem(KEY) ?? '[]')
      expect(written[0].captions).toEqual(['caption new'])
    })
  })

  it('records the gallery keys, not the pictures', () => {
    const { result } = renderHook(() => useHistory())

    act(() => {
      result.current.addItem(form([image('a'), image('b')]), content('x'))
    })

    expect(result.current.items[0].imageIds).toEqual(['a', 'b'])
    expect(result.current.items[0].imageNames).toEqual(['a.png', 'b.png'])
  })

  it('never grows past the 40-row cap, and drops the pictures only the evicted row held', async () => {
    const { result } = renderHook(() => useHistory())
    await putImage('img-0', new Blob(['old']))

    for (let index = 0; index < 41; index += 1) {
      act(() => {
        result.current.addItem(form(index === 0 ? [image('img-0')] : []), content(`#${index}`))
      })
    }

    expect(result.current.items).toHaveLength(40)
    // The very first entry is the one pushed past the cap.
    expect(result.current.items.some((item) => item.imageIds?.includes('img-0'))).toBe(false)

    await waitFor(async () => {
      expect((await getImages(['img-0'])).size).toBe(0)
    })
  })

  it('removes a single row and leaves the others alone', () => {
    seed([storedRow({ id: 'a' }), storedRow({ id: 'b' })])
    const { result } = renderHook(() => useHistory())

    act(() => {
      result.current.removeItem('a')
    })

    expect(result.current.items.map((item) => item.id)).toEqual(['b'])
  })

  it('keeps a picture another row still points at', async () => {
    await putImage('shared', new Blob(['x']))
    await putImage('lonely', new Blob(['y']))
    seed([
      storedRow({ id: 'a', imageIds: ['shared', 'lonely'] }),
      storedRow({ id: 'b', imageIds: ['shared'] }),
    ])
    const { result } = renderHook(() => useHistory())

    act(() => {
      result.current.removeItem('a')
    })

    await waitFor(async () => {
      const found = await getImages(['shared', 'lonely'])
      expect(found.has('shared')).toBe(true)
      expect(found.has('lonely')).toBe(false)
    })
  })

  it('empties the drawer and the image store on a clear-all', async () => {
    await putImage('a', new Blob(['x']))
    seed([storedRow({ id: 'a', imageIds: ['a'] })])
    const { result } = renderHook(() => useHistory())

    act(() => {
      result.current.clearAll()
    })

    expect(result.current.items).toEqual([])

    await waitFor(async () => {
      expect((await getImages(['a'])).size).toBe(0)
    })
  })

  it('reports a failed write when there is something to lose', async () => {
    seed([storedRow({ id: 'saved' })])
    const onSaveError = vi.fn()

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const error = new Error('quota')
      error.name = 'QuotaExceededError'
      throw error
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    renderHook(() => useHistory({ onSaveError }))

    await waitFor(() => {
      expect(onSaveError).toHaveBeenCalledTimes(1)
    })
  })

  it('stays quiet about a failed write on an empty drawer', async () => {
    const onSaveError = vi.fn()

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const error = new Error('quota')
      error.name = 'QuotaExceededError'
      throw error
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    renderHook(() => useHistory({ onSaveError }))

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(onSaveError).not.toHaveBeenCalled()
  })

  it('does not fall over when storage is unreadable at start-up', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })

    const { result } = renderHook(() => useHistory())

    expect(result.current.items).toEqual([])
    await waitFor(() => expect(result.current.saveState).not.toBe('idle'))
  })

  it('reports the save as done once the write has actually landed', async () => {
    const { result } = renderHook(() => useHistory())

    await waitFor(() => expect(result.current.saveState).toBe('saved'))
  })

  it('says storage is unavailable — not merely failed — when the browser refuses every write', async () => {
    seed([storedRow({ id: 'saved' })])
    const onSaveError = vi.fn()

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { result } = renderHook(() => useHistory({ onSaveError }))

    await waitFor(() => expect(result.current.saveState).toBe('unavailable'))
    expect(onSaveError).toHaveBeenCalled()
  })

  it('surfaces pictures a migration could not move yet', async () => {
    seed([storedRow({ id: 'pending', images: ['data:image/png;base64,@@bad@@'] })])

    const { result } = renderHook(() => useHistory())

    await waitFor(() => expect(result.current.unmigratedImages).toBe(1))
  })
})

describe('useHistory entry shape', () => {
  it('keeps the brief fields a restored entry needs', () => {
    const { result } = renderHook(() => useHistory())

    act(() => {
      result.current.addItem(
        { ...form(), customAudience: 'teens', tone: 'professional' },
        content('x'),
      )
    })

    const entry: HistoryItem = result.current.items[0]
    expect(entry.customAudience).toBe('teens')
    expect(entry.tone).toBe('professional')
    expect(entry.id).toBeTruthy()
    expect(entry.createdAt).toBeTruthy()
  })

  it('names an entry even without crypto.randomUUID, which is absent outside a secure context', () => {
    // Over plain HTTP — a phone on the same LAN as the dev machine — `randomUUID` does not exist.
    // Calling it unguarded threw here and the generation was lost with no history row to show.
    vi.stubGlobal('crypto', {})

    const { result } = renderHook(() => useHistory())

    act(() => {
      result.current.addItem(form(), content('x'))
    })

    expect(result.current.items[0].id).toBeTruthy()
  })
})
