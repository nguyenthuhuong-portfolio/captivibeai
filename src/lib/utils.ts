/** Fits the longest edge of an upload to this many pixels, portrait or landscape alike. */
export const MAX_IMAGE_EDGE = 800

/** Quality the compressed picture is encoded at. */
export const IMAGE_QUALITY = 1

/**
 * Formats that can carry an alpha channel. Anything else is opaque by definition, so the pixel scan
 * that looks for transparency can be skipped for it.
 */
const ALPHA_CAPABLE = new Set(['image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml', 'image/bmp'])

/**
 * Reads a picked image, fits its longest edge to `maxEdge` and re-encodes it as a Blob.
 *
 * A Blob — not a data URL — is what IndexedDB stores, so the compressed bytes never have to pass
 * through a Base64 string on their way to disk. This runs once per upload: the Blob it returns is
 * what the previews and the history point at, so a picture is never put through the encoder twice.
 *
 * Aspect ratio is preserved because both edges are scaled by the same factor. A picture is only ever
 * shrunk, never enlarged: `Math.min(1, …)` keeps any upload already inside `maxEdge` at its own
 * size, so a small photo is never blown up (and blurred) to fill the cap. Such a JPEG is handed
 * back untouched as well — re-encoding it would cost quality and save nothing. A picture with
 * transparency keeps its alpha and is encoded as WebP, since JPEG has no alpha channel and would
 * otherwise turn the transparent areas black.
 *
 * Three outcomes, deliberately distinct:
 * - a `Blob` — the picture to use, compressed or handed back unchanged;
 * - `null` — the browser could not decode the bytes, so the file is corrupt and must be reported
 *   rather than stored;
 * - the original `File` — canvas is unavailable (SSR, jsdom) or encoding failed, which is not the
 *   user's fault and must not cost them the upload, so the picture simply travels uncompressed.
 */
export async function compressImageToBlob(
  file: File,
  maxEdge = MAX_IMAGE_EDGE,
  quality = IMAGE_QUALITY,
): Promise<Blob | null> {
  let canvas: HTMLCanvasElement

  try {
    canvas = document.createElement('canvas')
  } catch {
    return file
  }

  // An alpha-aware context, so a transparent source survives being drawn onto it.
  const context = canvas.getContext('2d', { alpha: true })

  if (!context) return file

  let objectUrl: string | null = null

  try {
    objectUrl = URL.createObjectURL(file)
    const source = await loadImage(objectUrl)

    // The bytes could not be decoded — a truncated download or a file with an image extension over
    // something else entirely. Reported to the caller so it is never quietly stored.
    if (!source) return null

    // Giới hạn cạnh dài nhất, áp dụng cho cả ảnh ngang và ảnh dọc.
    const longestEdge = Math.max(source.width, source.height) || 1

    // Ảnh JPEG đã nằm trong giới hạn thì giữ nguyên bản gốc, tránh nén mất chất lượng thêm một lần.
    if (file.type === 'image/jpeg' && longestEdge <= maxEdge) return file

    // Cùng một hệ số cho cả hai cạnh nên tỉ lệ khung hình không đổi.
    const scale = Math.min(1, maxEdge / longestEdge)

    canvas.width = Math.max(1, Math.round(source.width * scale))
    canvas.height = Math.max(1, Math.round(source.height * scale))

    // Nội suy chất lượng cao — ảnh thu nhỏ vẫn mượt thay vì bị răng cưa.
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(source, 0, 0, canvas.width, canvas.height)

    // Ảnh trong suốt giữ nguyên alpha bằng WebP; ảnh đục dùng JPEG cho dung lượng nhỏ hơn.
    const transparent =
      ALPHA_CAPABLE.has(file.type) && hasTransparency(context, canvas.width, canvas.height)

    // Encode bằng Blob thay vì toDataURL để tránh tạo chuỗi Base64 lớn.
    const blob = await encode(canvas, transparent ? 'image/webp' : 'image/jpeg', quality)

    return blob ?? file
  } catch {
    // Anything else — a tainted canvas, a refused encoder — keeps the user's picture, uncompressed.
    return file
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    canvas.width = 0
    canvas.height = 0
  }
}

/** `canvas.toBlob` wrapped as a promise — `null` means the encoder refused the type. */
function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality)
  })
}

/** True as soon as one pixel is not fully opaque. Every fourth byte is a pixel's alpha. */
function hasTransparency(context: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    const { data } = context.getImageData(0, 0, width, height)

    for (let index = 3; index < data.length; index += 4) {
      if (data[index] < 255) return true
    }
  } catch {
    /* A tainted canvas cannot be read — assume the picture is opaque. */
  }

  return false
}

/**
 * Turns a stored Base64 data URL back into a Blob — the one-way door the history migration uses.
 *
 * Returns `null` for anything that is not a readable base64 payload, which is how a corrupt row is
 * skipped instead of taking the whole migration down with it.
 */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return null

  const header = dataUrl.slice(0, comma)
  if (!header.includes('base64')) return null

  try {
    const binary = atob(dataUrl.slice(comma + 1))
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)

    const type = header.slice(header.indexOf(':') + 1, header.indexOf(';')) || 'image/jpeg'
    return new Blob([bytes], { type })
  } catch {
    return null
  }
}

/**
 * A stable key for an image payload: the same bytes always hash to the same id, so a migration that
 * is interrupted and run again overwrites its own record instead of storing the picture twice.
 */
export function hashImageKey(seed: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `img-${hash.toString(16)}-${seed.length.toString(16)}`
}

/**
 * A fresh id for something the app has to name.
 *
 * `crypto.randomUUID` only exists in a secure context, so it is absent the moment the app is opened
 * over plain HTTP — an Android phone on the same LAN as the dev machine, for instance. Calling it
 * unguarded there throws and takes the whole action down with it, so the presence of the method is
 * checked first and a timestamp-plus-random fallback stands in when it is missing. Uniqueness, not
 * cryptographic strength, is what these ids need.
 */
export function createId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** A fresh key for a newly uploaded picture. */
export function createImageId(): string {
  return createId('img')
}

/** Resolves once the image behind `src` has decoded, or `null` when it cannot be read. */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })
}
