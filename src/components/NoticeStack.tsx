import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import type { Notice } from '../hooks/useNotices'
import { useLanguage } from '../hooks/useLanguage'

interface NoticeStackProps {
  notices: Notice[]
  onDismiss: (id: string) => void
}

/**
 * The app's notification region, pinned above everything else so a message about a failed save is
 * never hidden behind a dialog.
 *
 * An error is announced with `role="alert"` — a screen reader interrupts for it — while a success is
 * `role="status"`, which waits its turn. The container ignores pointer events so it never blocks the
 * UI underneath; each notice re-enables them for itself.
 */
export function NoticeStack({ notices, onDismiss }: NoticeStackProps) {
  const { t } = useLanguage()

  if (notices.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex flex-col items-center gap-2 p-4">
      {notices.map((notice) => {
        const isError = notice.tone === 'error'
        const Icon = isError ? AlertCircle : CheckCircle2

        return (
          <div
            key={notice.id}
            role={isError ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-2xl border px-4 py-3 shadow-lg ${
              isError ? 'border-destructive/40 bg-card text-destructive' : 'border-border bg-card text-foreground'
            }`}
          >
            <Icon
              className={`mt-0.5 size-4 shrink-0 ${isError ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}
              aria-hidden="true"
            />
            <p className="flex-1 text-sm leading-5">{t(notice.key, notice.params)}</p>
            <button
              type="button"
              onClick={() => onDismiss(notice.id)}
              aria-label={t('notice.dismiss')}
              className="-mr-1 -mt-0.5 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
