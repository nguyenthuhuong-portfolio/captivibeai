import { beforeEach, describe, expect, it } from 'vitest'
import { clearImages, deleteImages, getImages, loadProductImages, putImage } from './imageStore'

function blob(text: string, type = 'image/jpeg') {
  return new Blob([text], { type })
}

beforeEach(async () => {
  await clearImages()
})

describe('putImage / getImages', () => {
  it('round-trips a Blob under its key', async () => {
    await expect(putImage('a', blob('pixels'))).resolves.toBe(true)

    const found = await getImages(['a'])

    expect(found.size).toBe(1)
    expect(found.get('a')?.size).toBe(6)
  })

  it('overwrites when the same key is used again, which is what makes a retried migration safe', async () => {
    await putImage('a', blob('first'))
    await putImage('a', blob('second-and-longer'))

    const found = await getImages(['a'])

    expect(found.size).toBe(1)
    expect(found.get('a')?.size).toBe('second-and-longer'.length)
  })

  it('reports nothing for keys with no Blob behind them', async () => {
    await putImage('a', blob('pixels'))

    const found = await getImages(['a', 'missing'])

    expect(found.has('a')).toBe(true)
    expect(found.has('missing')).toBe(false)
  })

  it('returns an empty map when asked for nothing', async () => {
    expect((await getImages([])).size).toBe(0)
  })
})

describe('deleteImages', () => {
  it('removes only the named keys', async () => {
    await putImage('a', blob('a'))
    await putImage('b', blob('b'))

    await deleteImages(['a'])
    const found = await getImages(['a', 'b'])

    expect(found.has('a')).toBe(false)
    expect(found.has('b')).toBe(true)
  })

  it('is a no-op for an empty list', async () => {
    await expect(deleteImages([])).resolves.toBeUndefined()
  })
})

describe('clearImages', () => {
  it('empties the whole store', async () => {
    await putImage('a', blob('a'))
    await putImage('b', blob('b'))

    await clearImages()

    expect((await getImages(['a', 'b'])).size).toBe(0)
  })
})

describe('loadProductImages', () => {
  it('rebuilds the gallery in the order the keys were saved in', async () => {
    await putImage('a', blob('first'))
    await putImage('b', blob('second'))

    const images = await loadProductImages(['b', 'a'], ['sunset.png', 'dune.png'])

    expect(images.map((image) => image.id)).toEqual(['b', 'a'])
    expect(images.map((image) => image.name)).toEqual(['sunset.png', 'dune.png'])
    expect(images.map((image) => image.size)).toEqual([6, 5])
    expect(images.every((image) => image.url.startsWith('blob:'))).toBe(true)
  })

  it('leaves out a picture whose Blob has gone missing, so a half-lost row still restores', async () => {
    await putImage('a', blob('a'))

    const images = await loadProductImages(['a', 'evicted'], ['a.png', 'gone.png'])

    expect(images.map((image) => image.id)).toEqual(['a'])
  })

  it('returns nothing when the row saved no pictures', async () => {
    expect(await loadProductImages([], [])).toEqual([])
  })

  it('falls back to an empty name when none was saved', async () => {
    await putImage('a', blob('a'))

    const [image] = await loadProductImages(['a'], [])

    expect(image.name).toBe('')
  })
})
