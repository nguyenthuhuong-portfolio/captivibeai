import { AlertTriangle, Check, ImageIcon, Loader2, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { HistoryItem } from '../types'
import type { HistorySaveState } from '../hooks/useHistory'
import { useLanguage } from '../hooks/useLanguage'
import { ConfirmDialog } from './ConfirmDialog'

interface HistoryDrawerProps {
  open: boolean
  items: HistoryItem[]
  /** What the last write did, so the drawer reports the real state rather than assuming success. */
  saveState: HistorySaveState
  /** Pictures still held in the pre-IndexedDB format, waiting on a migration that has not finished. */
  unmigratedImages: number
  onClose: () => void
  onDelete: (id: string) => void
  onRestore: (item: HistoryItem) => void
  onClear: () => void
}

type PendingAction = { kind: 'item'; item: HistoryItem } | { kind: 'all' }

export function HistoryDrawer({
  open,
  items,
  saveState,
  unmigratedImages,
  onClose,
  onDelete,
  onRestore,
  onClear,
}: HistoryDrawerProps) {
  const { t, formatDate } = useLanguage()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) setPending(null)
  }, [open])

  if (!open) return null

  function confirmPending() {
    if (!pending) return
    if (pending.kind === 'item') onDelete(pending.item.id)
    else onClear()
    setPending(null)
  }

  return (
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-pointer bg-slate-950/60"
        aria-label={t('history.close')}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        className="glass-strong absolute inset-x-0 bottom-0 z-10 max-h-[88vh] overflow-y-auto rounded-t-2xl p-5 sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:max-h-none sm:w-full sm:max-w-md sm:rounded-none sm:rounded-l-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="history-title" className="text-lg font-bold text-foreground">
              {t('history.title')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('history.subtitle')}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl border border-border bg-card text-foreground transition duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t('history.close')}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={() => setPending({ kind: 'all' })}
            className="mb-4 cursor-pointer text-sm font-semibold text-destructive underline-offset-2 hover:underline"
          >
            {t('history.clearAll')} ({items.length})
          </button>
        )}

        <StorageStatus saveState={saveState} unmigratedImages={unmigratedImages} />

        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            {t('history.empty')}
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const audienceText = [
                ...item.audiences.map((id) => t(`audiences.${id}`)),
                item.customAudience,
              ]
                .filter(Boolean)
                .join(', ')

              return (
                <li key={item.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPending({ kind: 'item', item })}
                    className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-destructive transition duration-200 hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={t('history.delete', { name: item.productName })}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {t(`tones.${item.tone}.label`)}
                  </span>
                  {(item.imageIds?.length ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      <ImageIcon className="size-3" aria-hidden="true" />
                      {t('history.visual')}
                    </span>
                  )}
                </div>

                {audienceText && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground/80">{t('history.audiences')}: </span>
                    {audienceText}
                  </p>
                )}

                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.captions[0]}</p>
                <button
                  type="button"
                  onClick={() => onRestore(item)}
                  className="mt-3 min-h-11 cursor-pointer rounded-lg bg-primary px-3 text-sm font-semibold text-on-primary transition duration-200 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t('history.load')}
                </button>
              </li>
              )
            })}
          </ul>
        )}
      </aside>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === 'all' ? t('confirm.clearTitle') : t('confirm.deleteTitle')}
        description={
          pending?.kind === 'all'
            ? t('confirm.clearBody', { count: items.length })
            : pending?.kind === 'item'
              ? t('confirm.deleteBody', { name: pending.item.productName })
              : ''
        }
        confirmLabel={pending?.kind === 'all' ? t('confirm.clear') : t('confirm.delete')}
        cancelLabel={t('confirm.cancel')}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}

/**
 * The honest save report: what the last write did, and whether any pre-IndexedDB picture is still
 * waiting to be moved. It exists so the drawer never implies a snapshot is safely stored while the
 * write is still running, and so a browser that refuses storage says so instead of silently losing
 * the next generation.
 */
function StorageStatus({
  saveState,
  unmigratedImages,
}: {
  saveState: HistorySaveState
  unmigratedImages: number
}) {
  const { t } = useLanguage()
  const showLegacy = unmigratedImages > 0

  if (saveState === 'idle' && !showLegacy) return null

  return (
    <div className="mb-4 space-y-1.5">
      {saveState !== 'idle' && (
        <p
          role="status"
          aria-live="polite"
          className={`flex items-start gap-1.5 text-xs leading-5 ${
            saveState === 'saved'
              ? 'text-muted-foreground'
              : saveState === 'saving'
                ? 'text-muted-foreground'
                : 'font-semibold text-destructive'
          }`}
        >
          {saveState === 'saving' ? (
            <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin" aria-hidden="true" />
          ) : saveState === 'saved' ? (
            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          ) : (
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>
            {saveState === 'saving'
              ? t('history.saveSaving')
              : saveState === 'saved'
                ? t('history.saveSaved')
                : saveState === 'failed'
                  ? t('history.saveFailed')
                  : t('history.saveUnavailable')}
          </span>
        </p>
      )}

      {showLegacy && (
        <p className="flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{t('history.legacyPending', { count: unmigratedImages })}</span>
        </p>
      )}
    </div>
  )
}
