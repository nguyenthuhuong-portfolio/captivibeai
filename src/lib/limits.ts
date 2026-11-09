/**
 * Every ceiling the brief is held to, in one place.
 *
 * The numbers live here rather than in the inputs so the same rule governs the field, the submit
 * handler and the uploader: a `maxLength` attribute is only advice to the browser, and a paste, a
 * restored history row or a dropped folder all walk straight past it. Components clamp *and* the
 * flow validates against these values.
 */

/** Character ceilings for the brief's text fields. */
export const TEXT_LIMITS = {
  productName: 80,
  description: 500,
  audience: 150,
  /** The optional "extra brief details" field — a mandatory message, a real offer or a CTA. */
  extraDetails: 200,
} as const

/** Upload ceilings for the brief's gallery. All sizes are the *original* file sizes. */
export const IMAGE_LIMITS = {
  /** Photos per post, counting the ones already in the gallery. */
  maxCount: 4,
  /** Largest single original file. */
  maxFileBytes: 10 * 1024 * 1024,
  /** Largest combined original size of every photo in one post. */
  maxTotalBytes: 20 * 1024 * 1024,
} as const

/** The only formats the uploader takes. JPEG covers the `.jpg` alias browsers report as `image/jpg`. */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/** The `accept` attribute that goes with `ACCEPTED_IMAGE_TYPES`. */
export const ACCEPT_IMAGE_ATTRIBUTE = ACCEPTED_IMAGE_TYPES.join(',')

const ACCEPTED_TYPE_SET = new Set<string>([...ACCEPTED_IMAGE_TYPES, 'image/jpg'])

/** `10485760` → `'10 MB'`. Byte counts read the way the limits were specified. */
export function formatMegabytes(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))} MB`
}

/** Hard-stops a field at its ceiling — the character that would overflow is simply not taken. */
export function clampToLimit(value: string, limit: number) {
  return value.length > limit ? value.slice(0, limit) : value
}

/** Why a file was left out of the gallery, and by which rule. Translated at render time. */
export type ImageProblem =
  | { kind: 'count'; max: number }
  | { kind: 'total'; max: number }
  | { kind: 'size'; name: string; max: number }
  | { kind: 'format'; name: string }
  /** Passed every pre-flight rule but the browser could not decode it — a corrupt or truncated file. */
  | { kind: 'decode'; name: string }
  /** Decoded and compressed, but IndexedDB refused the Blob, so it could not be saved for later. */
  | { kind: 'storage'; name: string }

/** What the gallery already holds, in the units the upload limits are written in. */
export interface GalleryFootprint {
  count: number
  bytes: number
}

/** Combined original size of the photos already in the gallery. */
export function totalImageBytes(images: { size: number }[]) {
  return images.reduce((sum, image) => sum + image.size, 0)
}

/**
 * Splits a selection into the files that may join the gallery and the reasons the rest may not.
 *
 * The checks run in the order that gives the clearest answer: format and single-file size first
 * (both are about the file on its own), then the two counters that depend on what is already in the
 * gallery. `count` and `total` collapse into one problem each — repeating "the post is full" once
 * per leftover file would bury the point under duplicates — while format and size always name the
 * file they are about, because the user has to be able to find it.
 *
 * Files are judged in the order they were picked, and a file only advances the counters once it is
 * accepted, so a selection is measured against the gallery as it would be after each add.
 */
export function selectAcceptableImages(
  gallery: GalleryFootprint,
  files: File[],
): { accepted: File[]; problems: ImageProblem[] } {
  const accepted: File[] = []
  const problems: ImageProblem[] = []

  let count = gallery.count
  let bytes = gallery.bytes
  let countReported = false
  let totalReported = false

  for (const file of files) {
    if (!ACCEPTED_TYPE_SET.has(file.type)) {
      problems.push({ kind: 'format', name: file.name })
      continue
    }

    if (file.size > IMAGE_LIMITS.maxFileBytes) {
      problems.push({ kind: 'size', name: file.name, max: IMAGE_LIMITS.maxFileBytes })
      continue
    }

    if (count >= IMAGE_LIMITS.maxCount) {
      if (!countReported) {
        problems.push({ kind: 'count', max: IMAGE_LIMITS.maxCount })
        countReported = true
      }
      continue
    }

    if (bytes + file.size > IMAGE_LIMITS.maxTotalBytes) {
      if (!totalReported) {
        problems.push({ kind: 'total', max: IMAGE_LIMITS.maxTotalBytes })
        totalReported = true
      }
      continue
    }

    accepted.push(file)
    count += 1
    bytes += file.size
  }

  return { accepted, problems }
}
