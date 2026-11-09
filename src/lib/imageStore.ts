import type { ProductImage } from '../types'

/**
 * Image bytes live here, in IndexedDB, one Blob per key. History rows in `localStorage` only carry
 * the keys, which is the whole point of the split: a gallery can be tens of megabytes of pixels
 * while the history snapshot that describes it stays a few kilobytes of text.
 *
 * Every call resolves to a benign value when IndexedDB is unavailable (privacy mode, jsdom), so a
 * missing database costs the app its image persistence and nothing else.
 */
const DB_NAME = 'captivibe'
const DB_VERSION = 1
const STORE = 'images'

interface ImageRecord {
  id: string
  blob: Blob
  createdAt: string
}

let databasePromise: Promise<IDBDatabase | null> | null = null
/**
 * When the last attempt failed. A failure is never cached for the life of the tab: an open can fail
 * for reasons that pass — another tab holding an older version open (`onblocked`), a browser that
 * refuses the first request under memory pressure — and a phone that hits one of those on the first
 * picture should still be able to save the second. The cooldown keeps a hard failure from turning
 * every call into another doomed attempt.
 */
let nextRetryAt = 0
const RETRY_COOLDOWN_MS = 3000

function openDatabase(): Promise<IDBDatabase | null> {
  if (databasePromise) return databasePromise
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  if (Date.now() < nextRetryAt) return Promise.resolve(null)

  const pending = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(STORE)) {
          database.createObjectStore(STORE, { keyPath: 'id' })
        }
      }

      request.onsuccess = () => {
        const database = request.result
        // Another tab wants to upgrade the schema: close this connection so it is not the one that
        // blocks them, and drop the handle so this tab opens a fresh one on its next call.
        database.onversionchange = () => {
          database.close()
          databasePromise = null
        }
        resolve(database)
      }

      // A blocked or failed open resolves to `null`; the request it leaves behind is abandoned, so
      // the browser reclaims it — no connection is ever handed out here.
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })

  databasePromise = pending
  // A failed open is never kept: once it settles without a database the cached promise is dropped
  // so a later call may try again, after a short cooldown so a hard failure is not retried in a
  // tight loop. A successful open stays cached for the life of the tab.
  void pending.then((database) => {
    if (database) {
      nextRetryAt = 0
      return
    }
    databasePromise = null
    nextRetryAt = Date.now() + RETRY_COOLDOWN_MS
  })

  return pending
}

/** Files one compressed picture under `id`. A re-used id simply overwrites, which is what makes the
 *  history migration safe to retry. */
export async function putImage(id: string, blob: Blob): Promise<boolean> {
  const database = await openDatabase()
  if (!database) return false

  return new Promise((resolve) => {
    let settled = false

    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      resolve(ok)
    }

    try {
      const transaction = database.transaction(STORE, 'readwrite')
      const record: ImageRecord = { id, blob, createdAt: new Date().toISOString() }
      transaction.objectStore(STORE).put(record)

      // Success is reported on commit, not on the request: a write is only durable once its
      // transaction completes, and callers take `true` as "the picture is safe". Reporting on the
      // request would tell the history migration a Blob had landed before it actually had.
      transaction.oncomplete = () => finish(true)
      // A full origin is reported here: the picture is dropped, the rest of the app keeps working.
      transaction.onabort = () => finish(false)
      transaction.onerror = () => finish(false)
    } catch {
      finish(false)
    }
  })
}

/** Reads several pictures in one transaction. Keys with nothing behind them are simply absent. */
export async function getImages(ids: string[]): Promise<Map<string, Blob>> {
  const found = new Map<string, Blob>()
  const database = await openDatabase()
  if (!database || ids.length === 0) return found

  await new Promise<void>((resolve) => {
    try {
      const transaction = database.transaction(STORE, 'readonly')
      const store = transaction.objectStore(STORE)

      for (const id of ids) {
        const request = store.get(id)
        request.onsuccess = () => {
          const record = request.result as ImageRecord | undefined
          if (record?.blob) found.set(id, record.blob)
        }
      }

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => resolve()
      transaction.onabort = () => resolve()
    } catch {
      resolve()
    }
  })

  return found
}

export async function deleteImages(ids: string[]): Promise<void> {
  if (ids.length === 0) return

  const database = await openDatabase()
  if (!database) return

  await new Promise<void>((resolve) => {
    try {
      const transaction = database.transaction(STORE, 'readwrite')
      const store = transaction.objectStore(STORE)
      for (const id of ids) store.delete(id)

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => resolve()
      transaction.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}

/** Empties the whole store — the "clear all history" path, where every key is dropped at once. */
export async function clearImages(): Promise<void> {
  const database = await openDatabase()
  if (!database) return

  await new Promise<void>((resolve) => {
    try {
      const transaction = database.transaction(STORE, 'readwrite')
      transaction.objectStore(STORE).clear()

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => resolve()
      transaction.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}

/**
 * Rebuilds the form's preview list from the stored Blobs: a fresh Object URL per picture, with the
 * ones whose Blob has gone missing quietly left out so a half-lost entry still restores.
 *
 * A saved row carries no file sizes, so the stored Blob stands in for the original. It is smaller
 * than what the user once picked, which means a restored gallery is measured generously rather than
 * being refused entry to the form it came from.
 */
export async function loadProductImages(ids: string[], names: string[]): Promise<ProductImage[]> {
  if (ids.length === 0) return []

  const blobs = await getImages(ids)
  const images: ProductImage[] = []

  ids.forEach((id, index) => {
    const blob = blobs.get(id)
    if (!blob) return
    images.push({ id, name: names[index] ?? '', size: blob.size, url: URL.createObjectURL(blob) })
  })

  return images
}
