import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The store has to degrade rather than throw when there is no database at all — privacy mode, or a
 * browser that has disabled IndexedDB. The module caches its connection, so this case gets a file of
 * its own: `indexedDB` is removed before the module is ever imported.
 */
describe('imageStore without IndexedDB', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('answers with benign values instead of throwing', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const { putImage, getImages, loadProductImages, deleteImages, clearImages } = await import('./imageStore')

    await expect(putImage('a', new Blob(['x']))).resolves.toBe(false)
    expect((await getImages(['a'])).size).toBe(0)
    expect(await loadProductImages(['a'], ['a.png'])).toEqual([])
    await expect(deleteImages(['a'])).resolves.toBeUndefined()
    await expect(clearImages()).resolves.toBeUndefined()
  })
})
