import { describe, expect, it } from 'vitest'
import {
  ACCEPTED_IMAGE_TYPES,
  IMAGE_LIMITS,
  clampToLimit,
  formatMegabytes,
  selectAcceptableImages,
  totalImageBytes,
} from './limits'
import type { GalleryFootprint } from './limits'

/**
 * A stand-in for a picked file. `selectAcceptableImages` only ever reads the name, the MIME type and
 * the byte count, so a plain descriptor is enough — and it lets a test speak about a 12 MB upload
 * without allocating one.
 */
function photo(name: string, type: string, size: number): File {
  return { name, type, size } as unknown as File
}

const emptyGallery: GalleryFootprint = { count: 0, bytes: 0 }

const MB = 1024 * 1024

describe('selectAcceptableImages', () => {
  it('accepts every supported format, including the .jpg alias', () => {
    const files = [
      photo('a.jpg', 'image/jpeg', 2 * MB),
      photo('b.png', 'image/png', 3 * MB),
      photo('c.webp', 'image/webp', 4 * MB),
      photo('d.jpg', 'image/jpg', 1 * MB),
    ]

    const { accepted, problems } = selectAcceptableImages(emptyGallery, files)

    expect(accepted.map((file) => file.name)).toEqual(['a.jpg', 'b.png', 'c.webp', 'd.jpg'])
    expect(problems).toEqual([])
  })

  it('refuses a file that is not a picture and names it', () => {
    const { accepted, problems } = selectAcceptableImages(emptyGallery, [
      photo('notes.txt', 'text/plain', 10),
      photo('a.png', 'image/png', 10),
    ])

    expect(accepted.map((file) => file.name)).toEqual(['a.png'])
    expect(problems).toEqual([{ kind: 'format', name: 'notes.txt' }])
  })

  it('refuses a file past the single-file ceiling but keeps one exactly at it', () => {
    const { accepted, problems } = selectAcceptableImages(emptyGallery, [
      photo('huge.png', 'image/png', IMAGE_LIMITS.maxFileBytes + 1),
      photo('edge.png', 'image/png', IMAGE_LIMITS.maxFileBytes),
    ])

    expect(accepted.map((file) => file.name)).toEqual(['edge.png'])
    expect(problems).toEqual([
      { kind: 'size', name: 'huge.png', max: IMAGE_LIMITS.maxFileBytes },
    ])
  })

  it('stops at the photo cap and says so only once', () => {
    const full: GalleryFootprint = { count: IMAGE_LIMITS.maxCount, bytes: 0 }
    const { accepted, problems } = selectAcceptableImages(full, [
      photo('a.png', 'image/png', 1),
      photo('b.png', 'image/png', 1),
      photo('c.png', 'image/png', 1),
    ])

    expect(accepted).toEqual([])
    expect(problems).toEqual([{ kind: 'count', max: IMAGE_LIMITS.maxCount }])
  })

  it('fills the last empty slots and reports the overflow once', () => {
    const { accepted, problems } = selectAcceptableImages({ count: 3, bytes: 0 }, [
      photo('a.png', 'image/png', 1),
      photo('b.png', 'image/png', 1),
      photo('c.png', 'image/png', 1),
    ])

    expect(accepted.map((file) => file.name)).toEqual(['a.png'])
    expect(problems).toEqual([{ kind: 'count', max: IMAGE_LIMITS.maxCount }])
  })

  it('refuses a file that would push the post past its total budget', () => {
    const gallery: GalleryFootprint = { count: 1, bytes: IMAGE_LIMITS.maxTotalBytes - MB }
    const { accepted, problems } = selectAcceptableImages(gallery, [
      photo('big.png', 'image/png', 2 * MB),
    ])

    expect(accepted).toEqual([])
    expect(problems).toEqual([{ kind: 'total', max: IMAGE_LIMITS.maxTotalBytes }])
  })

  it('accepts a file that lands exactly on the total budget', () => {
    const gallery: GalleryFootprint = { count: 1, bytes: IMAGE_LIMITS.maxTotalBytes - MB }
    const { accepted } = selectAcceptableImages(gallery, [photo('fit.png', 'image/png', MB)])

    expect(accepted.map((file) => file.name)).toEqual(['fit.png'])
  })

  it('counts files it has already accepted, so a batch cannot slip past the budget', () => {
    const { accepted, problems } = selectAcceptableImages(emptyGallery, [
      photo('a.png', 'image/png', 9 * MB),
      photo('b.png', 'image/png', 9 * MB),
      photo('c.png', 'image/png', 9 * MB),
    ])

    // 9 + 9 = 18 MB fits; the third would reach 27 MB and is turned away.
    expect(accepted.map((file) => file.name)).toEqual(['a.png', 'b.png'])
    expect(problems).toEqual([{ kind: 'total', max: IMAGE_LIMITS.maxTotalBytes }])
  })

  it('keeps the order the files were picked in', () => {
    const { accepted } = selectAcceptableImages(emptyGallery, [
      photo('c.png', 'image/png', 1),
      photo('a.png', 'image/png', 1),
      photo('b.png', 'image/png', 1),
    ])

    expect(accepted.map((file) => file.name)).toEqual(['c.png', 'a.png', 'b.png'])
  })

  it('holds no reference to the caller’s array', () => {
    const files = [photo('a.png', 'image/png', 1)]
    const { accepted } = selectAcceptableImages(emptyGallery, files)

    expect(accepted).not.toBe(files)
  })
})

describe('totalImageBytes', () => {
  it('adds up the original sizes of the gallery', () => {
    expect(totalImageBytes([{ size: 3 }, { size: 4 }, { size: 5 }])).toBe(12)
    expect(totalImageBytes([])).toBe(0)
  })
})

describe('clampToLimit', () => {
  it('hard-stops a value at its ceiling', () => {
    expect(clampToLimit('abcdef', 3)).toBe('abc')
    expect(clampToLimit('ab', 3)).toBe('ab')
  })
})

describe('formatMegabytes', () => {
  it('reads byte counts the way the limits were specified', () => {
    expect(formatMegabytes(IMAGE_LIMITS.maxFileBytes)).toBe('10 MB')
    expect(formatMegabytes(IMAGE_LIMITS.maxTotalBytes)).toBe('20 MB')
  })
})

describe('ACCEPTED_IMAGE_TYPES', () => {
  it('lists exactly the three formats the uploader takes', () => {
    expect([...ACCEPTED_IMAGE_TYPES]).toEqual(['image/jpeg', 'image/png', 'image/webp'])
  })
})
