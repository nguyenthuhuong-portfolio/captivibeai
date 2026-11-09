import type { AudienceId, HistoryItem, Language, Tone } from '../types'
import { putImage } from './imageStore'
import { DEFAULT_TONE, TONE_IDS } from './options'
import { dataUrlToBlob, hashImageKey } from './utils'

const KEY = 'captivibe.history.v2'
const LEGACY_KEY = 'captivibe.history.v1'
const THEME_KEY = 'captivibe.theme'
const LANGUAGE_KEY = 'captivibe.language'

/**
 * A row exactly as it sits in `localStorage`.
 *
 * `imageIds` are keys into IndexedDB. `images` / `image` only ever appear on rows written before the
 * split, or on a row whose migration has not succeeded yet — the payloads stay put until the Blobs
 * are safely stored, so an interrupted migration loses nothing.
 */
type StoredHistoryItem = Omit<HistoryItem, 'legacyImages'> & {
  images?: string[]
  image?: string
  imageName?: string
  tones?: Tone[]
}

/** Any tone that is missing or no longer offered (the retired "sincere") falls back to the default. */
function toTone(value: unknown): Tone {
  return TONE_IDS.includes(value as Tone) ? (value as Tone) : DEFAULT_TONE
}

/** A stored value read as a string: anything else (including `undefined`) reads as empty. */
function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** A stored list read as a string array, or `null` when it is not a list at all. */
function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  return value.filter((entry): entry is string => typeof entry === 'string')
}

/** Accept only complete, bounded AI metadata; corrupt metadata never breaks an old history row. */
function reviveScoredMeta(value: unknown): Array<{ strategy: string; score: number; feedback: string } | null> | undefined {
  if (!Array.isArray(value)) return undefined
  return value.slice(0, 3).map((entry) => {
    if (entry === null) return null
    if (typeof entry !== 'object' || entry === null) return null
    const row = entry as Record<string, unknown>
    if (
      typeof row.strategy !== 'string' ||
      typeof row.score !== 'number' || !Number.isFinite(row.score) || row.score < 0 || row.score > 100 ||
      typeof row.feedback !== 'string'
    ) return null
    return { strategy: row.strategy.slice(0, 40), score: Math.round(row.score), feedback: row.feedback.slice(0, 120) }
  })
}

/**
 * Rebuilds one stored row, or `null` when it cannot be trusted.
 *
 * Storage is shared with older releases and with whatever else has ever written to this origin, so
 * a row is treated as untrusted input rather than as a `HistoryItem`. Every field is checked and
 * coerced, and a row that cannot produce usable copy is dropped on its own — a single damaged entry
 * must never be able to empty the whole drawer, which is what a bare `.map()` over the parsed array
 * would do the moment one value was `null`.
 */
function reviveItem(entry: unknown): HistoryItem | null {
  if (typeof entry !== 'object' || entry === null) return null

  const row = entry as Record<string, unknown>
  const id = asString(row.id)
  if (!id) return null

  const captions = asStringArray(row.captions)
  const headlines = asStringArray(row.headlines)
  const hashtags = asStringArray(row.hashtags)

  // Without its copy a row has nothing to show, so it is skipped rather than rendered blank.
  if (!captions || !headlines || !hashtags) return null

  // Rows from before the multi-image release kept one visual under `image`.
  const single = asString(row.image)
  const imageName = asString(row.imageName)
  const payloads = asStringArray(row.images) ?? (single ? [single] : [])
  const legacy = payloads.filter((value) => value.startsWith('data:'))
  const imageNames = asStringArray(row.imageNames)

  return {
    id,
    createdAt: asString(row.createdAt),
    productName: asString(row.productName),
    description: asString(row.description),
    audiences: (asStringArray(row.audiences) ?? []) as AudienceId[],
    // The free-text audience is part of the brief, so a restored entry brings it back.
    customAudience: asString(row.customAudience),
    tone: toTone(row.tone ?? asStringArray(row.tones)?.[0]),
    imageIds: asStringArray(row.imageIds) ?? undefined,
    imageNames: imageNames ?? (imageName ? [imageName] : undefined),
    // Whatever is still Base64 is handed to the migration pass, which clears the field once the
    // Blob is stored. Until then the payloads travel with the row, unmodified.
    legacyImages: legacy.length > 0 ? legacy : undefined,
    captions,
    headlines,
    hashtags,
    captionMeta: reviveScoredMeta(row.captionMeta),
    headlineMeta: reviveScoredMeta(row.headlineMeta),
    imageInsights: asStringArray(row.imageInsights) ?? undefined,
    generationSource: row.generationSource === 'ai' || row.generationSource === 'local' ? row.generationSource : undefined,
  }
}

/**
 * Reads the stored history, salvaging as much of it as possible.
 *
 * Unreadable JSON costs the whole snapshot — there is nothing to salvage from a truncated string —
 * but a single malformed row costs only that row. Reads always resolve to a list, so a storage
 * failure can never stop the app from starting.
 */
export function loadHistory(): HistoryItem[] {
  let raw: string | null = null

  try {
    localStorage.removeItem(LEGACY_KEY)
    raw = localStorage.getItem(KEY)
  } catch {
    /* Privacy mode, or storage disabled entirely: start with an empty drawer. */
    return []
  }

  if (!raw) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.warn('[captivibe] stored history is not valid JSON — starting empty')
    return []
  }

  if (!Array.isArray(parsed)) return []

  const items: HistoryItem[] = []
  for (const entry of parsed) {
    const item = reviveItem(entry)
    if (item) items.push(item)
    else console.warn('[captivibe] a stored history row was unreadable and was skipped')
  }

  return items
}

/** A row on its way back to `localStorage`, keeping any un-migrated payloads intact. */
function toStoredRow(item: HistoryItem): StoredHistoryItem {
  const { legacyImages, ...row } = item
  if (!legacyImages || legacyImages.length === 0) return row
  return { ...row, images: legacyImages }
}

export type SaveOutcome = 'saved' | 'failed'

/**
 * The tail of the write queue. Every save is chained onto it, so two saves that overlap — a fast
 * keystroke right after a generation, or the mount effect landing beside a first add — are written
 * in the order they were asked for. Without this, the `await` inside a save lets a slower older
 * snapshot finish last and overwrite the newer one that was queued behind it.
 */
let writeQueue: Promise<SaveOutcome> = Promise.resolve('saved')

/**
 * Writes the text history back to `localStorage`.
 *
 * A row still carrying un-migrated Base64 is written exactly as it was read, so a save that happens
 * before (or instead of) a successful migration never destroys the payloads it could not move yet.
 */
export function saveHistory(items: HistoryItem[]): Promise<SaveOutcome> {
  const payload = JSON.stringify(items.map(toStoredRow))

  const run = async (): Promise<SaveOutcome> => {
    const room = await hasQuotaFor(payload.length * 2)
    if (!room) {
      console.warn('[captivibe] origin storage is close to its quota — history was not re-written')
    }
    return write(KEY, payload) ? 'saved' : 'failed'
  }

  const result = writeQueue.then(run, run)
  // The queue always holds a settled, non-rejecting link so one failed save cannot stall the next.
  writeQueue = result.catch(() => 'failed' as SaveOutcome)
  return result
}

function write(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (error) {
    if (isQuotaError(error)) {
      console.warn('[captivibe] localStorage quota exceeded — the previous snapshot was kept')
    }
    /* Quota or privacy mode — history is a convenience, never block the UI. */
    return false
  }
}

export interface MigrationResult {
  /** Payloads successfully turned into Blobs. */
  migrated: number
  /** Payloads that could not be decoded or stored; their rows keep them for another attempt. */
  failed: number
  items: HistoryItem[]
}

/**
 * Moves the Base64 payloads still sitting in stored rows into IndexedDB, one Blob per picture.
 *
 * Ids are derived from the payload itself, so a migration that is interrupted and re-run writes the
 * same keys again instead of duplicating the pictures, and a payload that cannot be stored keeps its
 * row untouched for the next attempt. History text and generated results are never rewritten here.
 */
export async function migrateLegacyImages(items: HistoryItem[]): Promise<MigrationResult> {
  if (!items.some((item) => (item.legacyImages?.length ?? 0) > 0)) {
    return { migrated: 0, failed: 0, items }
  }

  let migrated = 0
  let failed = 0
  const next: HistoryItem[] = []

  for (const item of items) {
    if (!item.legacyImages || item.legacyImages.length === 0) {
      next.push(item)
      continue
    }

    const ids: string[] = []
    const leftovers: string[] = []

    for (const dataUrl of item.legacyImages) {
      const id = hashImageKey(dataUrl)
      const blob = dataUrlToBlob(dataUrl)

      if (!blob || !(await putImage(id, blob))) {
        leftovers.push(dataUrl)
        failed += 1
        continue
      }

      ids.push(id)
      migrated += 1
    }

    const merged = Array.from(new Set([...(item.imageIds ?? []), ...ids]))
    next.push({
      ...item,
      imageIds: merged.length > 0 ? merged : undefined,
      legacyImages: leftovers.length > 0 ? leftovers : undefined,
    })
  }

  return { migrated, failed, items: next }
}

/* ------------------------------------------------------------------------------------------------
 * Origin storage: how much room is left, and whether the browser will keep it.
 * ---------------------------------------------------------------------------------------------- */

export function isQuotaError(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name
  const code = (error as { code?: number } | null)?.code
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22
}

/**
 * Whether this origin can write to `localStorage` at all.
 *
 * A probe rather than a feature test: several browsers expose `localStorage` and then throw on
 * every call — Safari in private mode being the classic case — so the only reliable check is to try
 * a real write and undo it. Used to tell "the browser will not keep anything" apart from "the write
 * failed this once", which are two different things to say to the user.
 */
export function isStorageAvailable(): boolean {
  try {
    const probe = '__captivibe_probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

export async function storageEstimate(): Promise<StorageEstimate | null> {
  try {
    if (!navigator.storage?.estimate) return null
    return await navigator.storage.estimate()
  } catch {
    return null
  }
}

/** True when `bytes` more would still fit inside the origin's quota. Unknown quota means "try it". */
export async function hasQuotaFor(bytes: number): Promise<boolean> {
  const estimate = await storageEstimate()
  if (!estimate?.quota) return true
  return (estimate.usage ?? 0) + bytes < estimate.quota
}

/** Asks the browser to keep this origin's data from being evicted under pressure, where supported. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted?.()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export function loadTheme(): 'light' | 'dark' {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* ignore */
  }
  return 'light'
}

export function saveTheme(theme: 'light' | 'dark') {
  write(THEME_KEY, theme)
}

export function loadLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_KEY)
    if (stored === 'en' || stored === 'vi') return stored
  } catch {
    /* ignore */
  }
  return 'vi'
}

export function saveLanguage(language: Language) {
  write(LANGUAGE_KEY, language)
}
