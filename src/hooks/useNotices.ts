import { useCallback, useEffect, useRef, useState } from 'react'
import type { TranslateParams, TranslationKey } from '../lib/i18n'

/**
 * A short, translated message shown above the app.
 *
 * Only the key and its parameters are stored, never the finished sentence: a notice raised in
 * English switches to Vietnamese the moment the interface language does.
 */
export interface Notice {
  id: string
  key: TranslationKey
  params?: TranslateParams
  tone: 'error' | 'success'
}

/** How long a transient notice stays before it dismisses itself. */
const TRANSIENT_MS = 7000

function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `notice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * The app's notification channel — the replacement for `alert()`, which blocks the page and cannot
 * be styled, translated or dismissed.
 *
 * Identical notices are collapsed: a failing write runs on every history change, and stacking the
 * same sentence once per change would bury the app in duplicates. The user dismisses one notice at
 * a time, and everything still pending is cleared on unmount.
 */
export function useNotices() {
  const [notices, setNotices] = useState<Notice[]>([])
  const timers = useRef(new Map<string, number>())

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timers.current.delete(id)
    }
    setNotices((current) => current.filter((notice) => notice.id !== id))
  }, [])

  const notify = useCallback(
    (notice: Omit<Notice, 'id'>) => {
      const id = newId()

      setNotices((current) =>
        current.some((entry) => entry.key === notice.key) ? current : [...current, { ...notice, id }],
      )

      const timer = window.setTimeout(() => dismiss(id), TRANSIENT_MS)
      timers.current.set(id, timer)

      return id
    },
    [dismiss],
  )

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer))
      pending.clear()
    }
  }, [])

  return { notices, notify, dismiss }
}
