import { AlertCircle, Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { useLanguage } from '../hooks/useLanguage'

interface CopyButtonProps {
  text: string
  label?: string
  compact?: boolean
}

/** What the button is currently reporting back. */
type CopyState = 'idle' | 'copied' | 'failed'

const RESET_MS: Record<Exclude<CopyState, 'idle'>, number> = { copied: 1600, failed: 2600 }

export function CopyButton({ text, label, compact = false }: CopyButtonProps) {
  const { t } = useLanguage()
  const [state, setState] = useState<CopyState>('idle')
  const resolvedLabel = label ?? t('results.copy')

  /**
   * The clipboard is denied outright on an insecure origin, in a sandboxed frame, or when the user
   * refuses permission — all of which reject rather than throw synchronously. The rejection is
   * caught and reported in place, and the button stays enabled so a second attempt costs nothing
   * and never needs a reload.
   */
  async function handleCopy() {
    // Resolved before the state is written: reading `state` right after `setState` would still see
    // the previous render's value, and the wrong reset delay would be used.
    let next: Exclude<CopyState, 'idle'> = 'copied'

    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(text)
    } catch {
      next = 'failed'
    }

    setState(next)
    window.setTimeout(() => setState('idle'), RESET_MS[next])
  }

  const announcement =
    state === 'copied'
      ? t('results.copiedLabel', { label: resolvedLabel })
      : state === 'failed'
        ? t('results.copyFailed')
        : resolvedLabel

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card font-semibold text-foreground transition duration-200 hover:border-primary/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        compact ? 'min-h-11 min-w-11 justify-center px-2 text-xs' : 'min-h-11 px-3 py-2 text-sm'
      }`}
      aria-label={announcement}
      title={state === 'failed' ? t('results.copyFailed') : undefined}
    >
      {state === 'copied' ? (
        <Check className="size-4 text-emerald-600" aria-hidden="true" />
      ) : state === 'failed' ? (
        <AlertCircle className="size-4 text-destructive" aria-hidden="true" />
      ) : (
        <Copy className="size-4" aria-hidden="true" />
      )}
      {compact ? null : state === 'copied' ? (
        t('results.copied')
      ) : state === 'failed' ? (
        <span className="text-destructive">{t('results.copyFailed')}</span>
      ) : (
        resolvedLabel
      )}
    </button>
  )
}
