import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Type, X } from 'lucide-react'
import type { PreviewDevice, PreviewPlatform, ProductForm } from '../types'
import { useLanguage } from '../hooks/useLanguage'
import { PhonePreview, PreviewControls } from './PhonePreview'
import { captionLimitClass, captionLimitLevel, PLATFORM_LIMITS } from '../lib/generate'

interface PreviewStudioProps {
  open: boolean
  onClose: () => void
  form: ProductForm
  headline: string
  caption: string
  hashtags: string[]
  platform: PreviewPlatform
  onPlatformChange: (platform: PreviewPlatform) => void
  device: PreviewDevice
  onDeviceChange: (device: PreviewDevice) => void
  totalLength: number
}

/** Full-viewport presentation layer. The existing platform renderers remain the source of truth. */
export function PreviewStudio({
  open,
  onClose,
  form,
  headline,
  caption,
  hashtags,
  platform,
  onPlatformChange,
  device,
  onDeviceChange,
  totalLength,
}: PreviewStudioProps) {
  const { t } = useLanguage()
  const characterLimit = PLATFORM_LIMITS[platform].limit
  const limitLevel = captionLimitLevel(totalLength, platform)
  const limitHint =
    limitLevel === 'over'
      ? t('preview.overLimit')
      : limitLevel === 'warning'
        ? t('results.approachingLimit')
        : t('preview.limitHint', { platform: t(`preview.platformShort.${platform}`) })

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('preview.studioTitle')}
      className="fixed inset-0 z-40 flex h-[100svh] min-h-0 flex-col overflow-hidden bg-background text-foreground"
    >
      <header className="shrink-0 border-b border-border/70 bg-card px-2 pb-2 pt-[calc(0.45rem+env(safe-area-inset-top,0px))] sm:px-6 sm:py-4">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-2">
          {/* The title row is intentionally hidden on phones: the toolbar becomes the only header row. */}
          <div className="hidden min-w-0 items-center gap-2.5 sm:flex">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary shadow-sm">
              <span className="text-base font-extrabold">C</span>
            </div>
            <div className="min-w-0">
              <h2 id="preview-studio-title" className="truncate text-sm font-bold sm:text-base">
                {t('preview.studioTitle')}
              </h2>
              <p className="hidden text-xs text-muted-foreground md:block">{t('preview.studioSubtitle')}</p>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-between gap-1.5 sm:flex-none sm:justify-end sm:gap-3">
            <div className="relative z-[60] flex min-w-0 items-center gap-1.5 sm:gap-2">
              <PreviewControls
                platform={platform}
                onPlatformChange={onPlatformChange}
                device={device}
                onDeviceChange={onDeviceChange}
              />
            </div>

            {/* Keep the character counter directly beside Close; its label makes the numbers self-explanatory. */}
            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
              <div
                className="inline-flex h-8 min-w-0 items-center gap-1 rounded-full border border-border bg-card px-1.5 text-[9px] font-semibold shadow-sm sm:h-9 sm:gap-1.5 sm:px-3 sm:text-xs"
                title={`${t('results.totalPostLabel')} · ${limitHint}`}
                aria-label={`${t('preview.charactersShort')}: ${totalLength.toLocaleString()} / ${characterLimit.toLocaleString()}`}
              >
                <Type className="size-3 shrink-0 text-primary sm:size-3.5" aria-hidden="true" />
                <span className="shrink-0 text-muted-foreground">{t('preview.charactersShort')}</span>
                <span className={`whitespace-nowrap tabular-nums ${captionLimitClass(totalLength, platform)}`}>
                  {totalLength.toLocaleString()} / {characterLimit.toLocaleString()}
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label={t('preview.closeStudio')}
                title={t('preview.closeStudio')}
                className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-10"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden overscroll-contain px-0 pt-0 pb-[env(safe-area-inset-bottom,0px)] sm:px-5 sm:py-5">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[1440px] flex-col">
          <PhonePreview
            form={form}
            headline={headline}
            caption={caption}
            hashtags={hashtags}
            images={form.images.map((image) => image.url)}
            platform={platform}
            device={device}
          />
        </div>
      </main>
    </div>,
    document.body,
  )
}
