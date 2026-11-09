import { useCallback, useEffect, useRef, useState } from 'react'
import type { GeneratedContent, ProductForm } from '../types'
import type { HistoryItem } from '../types'
import { clearImages, deleteImages } from '../lib/imageStore'
import {
  isStorageAvailable,
  loadHistory,
  migrateLegacyImages,
  requestPersistentStorage,
  saveHistory,
} from '../lib/storage'
import { createId } from '../lib/utils'

/** Newest first, and never longer than this — the cap the history drawer has always shown. */
const HISTORY_LIMIT = 40

/**
 * What the last write did, so the UI can report it honestly.
 *
 * `unavailable` is its own state rather than a kind of `failed`: it means the browser refused
 * `localStorage` outright (private mode, blocked storage), which is a standing condition rather than
 * a one-off loss. `idle` is the moment before the first write and is never shown.
 */
export type HistorySaveState = 'idle' | 'saving' | 'saved' | 'failed' | 'unavailable'

interface UseHistoryOptions {
  /**
   * Raised when a snapshot could not be written to `localStorage`, so the UI can say so rather than
   * leaving the loss to a console line the user will never read.
   */
  onSaveError?: () => void
}

export function useHistory({ onSaveError }: UseHistoryOptions = {}) {
  const [items, setItems] = useState<HistoryItem[]>(() => {
    if (typeof window === 'undefined') return []
    return loadHistory()
  })
  const [saveState, setSaveState] = useState<HistorySaveState>('idle')

  /**
   * Whether the origin accepts `localStorage` writes at all, probed lazily on the first save. The
   * answer cannot change within a page's life, so it is asked once and remembered.
   */
  const storageRef = useRef<boolean | null>(null)
  if (storageRef.current === null) storageRef.current = isStorageAvailable()

  /**
   * The list as of the last render, read by the one-shot migration pass. Keeping it in a ref means
   * an entry added while the migration is running is not clobbered when the pass writes its result.
   */
  const itemsRef = useRef(items)
  itemsRef.current = items

  /** Read through a ref so a new callback identity never re-runs the write effect. */
  const saveErrorRef = useRef(onSaveError)
  saveErrorRef.current = onSaveError

  /**
   * Persist first, migrate second: the write that runs on mount puts any un-migrated Base64 back
   * exactly as it was read, so a migration that fails cannot have removed the payloads it needed.
   *
   * The state moves through saving → saved/failed, and `saved` is only reached once the write has
   * actually returned — the panel never claims a snapshot is safe while the write is still in
   * flight. A failure is only worth reporting when there is something to lose: on an empty list the
   * snapshot carries nothing, and warning about it would greet a first-time visitor with an error.
   */
  useEffect(() => {
    let cancelled = false

    // Storage that refuses every write is a standing condition, not a one-off: say so rather than
    // attempting a write that is certain to throw.
    if (storageRef.current === false) {
      setSaveState('unavailable')
      if (items.length > 0) saveErrorRef.current?.()
      return
    }

    setSaveState('saving')

    void saveHistory(items).then((outcome) => {
      if (cancelled) return

      if (outcome === 'saved') {
        setSaveState('saved')
        return
      }

      console.warn('[captivibe] history could not be persisted')
      setSaveState('failed')
      if (items.length > 0) saveErrorRef.current?.()
    })

    return () => {
      cancelled = true
    }
  }, [items])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const result = await migrateLegacyImages(itemsRef.current)
      const total = result.migrated + result.failed

      if (total === 0) {
        console.info('[captivibe] history image migration: nothing to move')
        return
      }

      console.info(
        `[captivibe] history image migration: ${result.migrated} moved to IndexedDB, ${result.failed} left in localStorage`,
      )

      if (cancelled) return

      // Only the migrated rows are swapped in, so anything added while the pass was running stays.
      const migrated = new Map(result.items.map((item) => [item.id, item]))
      setItems((current) =>
        current.map((item) => {
          const updated = migrated.get(item.id)
          if (!updated || updated === item) return item
          return { ...item, imageIds: updated.imageIds, legacyImages: updated.legacyImages }
        }),
      )
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // Best effort: ask the browser not to evict this origin's history under storage pressure.
  useEffect(() => {
    void requestPersistentStorage()
  }, [])

  const addItem = useCallback((form: ProductForm, content: GeneratedContent) => {
    const item: HistoryItem = {
      // Guarded id: `crypto.randomUUID` is missing outside a secure context, which is exactly the
      // situation on a phone opening the app over plain HTTP.
      id: createId('entry'),
      createdAt: new Date().toISOString(),
      productName: form.productName,
      description: form.description,
      audiences: form.audiences,
      // Saved so reopening an entry restores the whole brief, free-text audience and tone included.
      customAudience: form.customAudience ?? '',
      tone: form.tone,
      // Only the keys travel with the row: the pictures themselves are already in IndexedDB.
      imageIds: form.images.length > 0 ? form.images.map((image) => image.id) : undefined,
      imageNames: form.images.length > 0 ? form.images.map((image) => image.name) : undefined,
      ...content,
    }

    const current = itemsRef.current
    const survivors = [item, ...current.slice(0, HISTORY_LIMIT - 1)]
    // Entries pushed past the cap leave the list, so any picture only they held goes with them.
    const evicted = current.slice(HISTORY_LIMIT - 1)
    if (evicted.length > 0) {
      const stillUsed = referencedImageIds(survivors)
      const orphans = evicted.flatMap((entry) => entry.imageIds ?? []).filter((id) => !stillUsed.has(id))
      void deleteImages(orphans)
    }

    setItems(survivors)
    return item
  }, [])

  const removeItem = useCallback(
    (id: string) => {
      const removed = items.find((item) => item.id === id)
      const remaining = items.filter((item) => item.id !== id)

      // A picture is deleted only once no surviving entry still points at it.
      if (removed?.imageIds?.length) {
        const stillUsed = referencedImageIds(remaining)
        const orphans = removed.imageIds.filter((imageId) => !stillUsed.has(imageId))
        void deleteImages(orphans)
      }

      setItems(remaining)
    },
    [items],
  )

  const clearAll = useCallback(() => {
    setItems([])
    void clearImages()
  }, [])

  /**
   * How many stored pictures are still held as Base64 inside the history rows — a migration that
   * could not finish, so the drawer can say the old data is still there rather than looking intact.
   */
  const unmigratedImages = items.reduce(
    (total, item) => total + (item.legacyImages?.length ?? 0),
    0,
  )

  return { items, addItem, removeItem, clearAll, saveState, unmigratedImages }
}

/** Every image key still referenced by at least one history row. */
export function referencedImageIds(items: HistoryItem[]): Set<string> {
  const ids = new Set<string>()
  for (const item of items) {
    for (const id of item.imageIds ?? []) ids.add(id)
  }
  return ids
}
