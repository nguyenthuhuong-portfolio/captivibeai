import { afterEach, describe, expect, it, vi } from 'vitest'
import { compressImageToBlob, createImageId, dataUrlToBlob, hashImageKey } from './utils'

type BlobCallback = (blob: Blob | null) => void

interface FakeCanvas {
  width: number
  height: number
  getContext: () => unknown
  toBlob: (callback: BlobCallback, type?: string) => void
}

interface FakeContext {
  imageSmoothingEnabled: boolean
  imageSmoothingQuality: string
  clearRect: () => void
  drawImage: () => void
  getImageData: () => { data: Uint8ClampedArray }
}

function contextWith(alpha: number): FakeContext {
  return {
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    clearRect: () => {},
    drawImage: () => {},
    getImageData: () => ({ data: new Uint8ClampedArray([10, 20, 30, alpha]) }),
  }
}

/**
 * Swaps jsdom's canvas for one that behaves like a real browser's. jsdom ships no 2D context at all,
 * so without this the compressor would take its "canvas unavailable" path in every test and the
 * interesting branches could never be reached.
 *
 * The canvas is handed to `toBlob` because the compressor resets its dimensions in a `finally`
 * block: the size it settled on can only be read while the encoder is being asked for a result.
 */
function stubCanvas(
  options: {
    context?: FakeContext | null
    toBlob?: (canvas: FakeCanvas, callback: BlobCallback, type?: string) => void
  } = {},
) {
  const context = options.context === undefined ? contextWith(255) : options.context
  const canvas: FakeCanvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    toBlob: (callback, type) => {
      if (options.toBlob) options.toBlob(canvas, callback, type)
      else callback(new Blob(['encoded'], { type: 'image/jpeg' }))
    },
  }

  const createElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) =>
    tagName === 'canvas' ? canvas : createElement(tagName)) as unknown as typeof document.createElement)

  return canvas
}

/** Swaps `Image` for one that either decodes to a size or fails, without a real network fetch. */
function stubImage(outcome: { width: number; height: number } | 'error') {
  class FakeImage {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    width = 0
    height = 0

    set src(_value: string) {
      queueMicrotask(() => {
        if (outcome === 'error') {
          this.onerror?.()
          return
        }
        this.width = outcome.width
        this.height = outcome.height
        this.onload?.()
      })
    }
  }

  vi.stubGlobal('Image', FakeImage)
}

function file(name: string, type: string): File {
  return new File(['pixels'], name, { type })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('compressImageToBlob', () => {
  it('hands the original file back when no 2D context is available', async () => {
    stubCanvas({ context: null })
    const source = file('a.png', 'image/png')

    await expect(compressImageToBlob(source)).resolves.toBe(source)
  })

  it('returns null when the bytes cannot be decoded', async () => {
    stubCanvas()
    stubImage('error')

    await expect(compressImageToBlob(file('broken.png', 'image/png'))).resolves.toBeNull()
  })

  it('keeps the user’s file when the encoder refuses', async () => {
    stubCanvas({ toBlob: (_canvas, callback) => callback(null) })
    stubImage({ width: 1600, height: 1200 })
    const source = file('big.png', 'image/png')

    await expect(compressImageToBlob(source)).resolves.toBe(source)
  })

  it('shrinks a large picture to the edge cap and preserves its aspect ratio', async () => {
    let encodedSize = { width: 0, height: 0 }
    stubCanvas({
      toBlob: (canvas, callback, type) => {
        encodedSize = { width: canvas.width, height: canvas.height }
        callback(new Blob(['x'], { type: type ?? 'image/jpeg' }))
      },
    })
    stubImage({ width: 1600, height: 1200 })

    const result = await compressImageToBlob(file('big.jpg', 'image/jpeg'))

    expect(encodedSize).toEqual({ width: 800, height: 600 })
    expect(result).toBeInstanceOf(Blob)
    expect(result).not.toBeInstanceOf(File)
  })

  it('encodes an opaque picture as JPEG', async () => {
    stubCanvas({
      toBlob: (_canvas, callback, type) => callback(new Blob(['x'], { type: type ?? 'image/jpeg' })),
    })
    stubImage({ width: 1600, height: 1200 })

    const result = await compressImageToBlob(file('shot.png', 'image/png'))

    expect((result as Blob).type).toBe('image/jpeg')
  })

  it('keeps transparency by encoding as WebP', async () => {
    stubCanvas({
      context: contextWith(0),
      toBlob: (_canvas, callback, type) => callback(new Blob(['x'], { type: type ?? 'image/webp' })),
    })
    stubImage({ width: 1600, height: 1200 })

    const result = await compressImageToBlob(file('logo.png', 'image/png'))

    expect((result as Blob).type).toBe('image/webp')
  })

  it('never enlarges, and hands a small JPEG back untouched', async () => {
    const toBlob = vi.fn((_canvas: FakeCanvas, callback: BlobCallback) =>
      callback(new Blob(['x'], { type: 'image/jpeg' })),
    )
    stubCanvas({ toBlob })
    stubImage({ width: 600, height: 400 })
    const source = file('small.jpg', 'image/jpeg')

    const result = await compressImageToBlob(source)

    expect(result).toBe(source)
    expect(toBlob).not.toHaveBeenCalled()
  })

  it('releases the Object URL it created, even on the untouched path', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    stubCanvas()
    stubImage({ width: 600, height: 400 })

    await compressImageToBlob(file('small.jpg', 'image/jpeg'))

    expect(revoke).toHaveBeenCalled()
  })
})

describe('dataUrlToBlob', () => {
  it('rebuilds a Blob with the type the data URL declared', async () => {
    const blob = dataUrlToBlob('data:image/png;base64,aGVsbG8=')

    expect(blob).toBeInstanceOf(Blob)
    expect(blob?.type).toBe('image/png')
    expect(blob?.size).toBe(5)
  })

  it('returns null for a string that is not a data URL', () => {
    expect(dataUrlToBlob('not-a-data-url')).toBeNull()
    expect(dataUrlToBlob('data:image/png,notbase64')).toBeNull()
  })

  it('returns null rather than throwing on a corrupt payload', () => {
    expect(dataUrlToBlob('data:image/png;base64,@@@not-base64@@@')).toBeNull()
  })
})

describe('hashImageKey', () => {
  it('derives the same key for the same payload', () => {
    expect(hashImageKey('data:image/png;base64,aGVsbG8=')).toBe(hashImageKey('data:image/png;base64,aGVsbG8='))
  })

  it('derives a different key for a different payload', () => {
    expect(hashImageKey('one')).not.toBe(hashImageKey('two'))
  })
})

describe('createImageId', () => {
  it('hands out a fresh, non-empty key every time', () => {
    const first = createImageId()
    const second = createImageId()

    expect(first).toBeTruthy()
    expect(first).not.toBe(second)
  })
})
