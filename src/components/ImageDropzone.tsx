import { AlertCircle, ImagePlus, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useLanguage } from '../hooks/useLanguage'
import type { TranslateParams, TranslationKey } from '../lib/i18n'
import {
  ACCEPT_IMAGE_ATTRIBUTE,
  IMAGE_LIMITS,
  formatMegabytes,
} from '../lib/limits'
import type { ImageProblem } from '../lib/limits'
import type { ProductImage } from '../types'

type Translate = (key: TranslationKey, params?: TranslateParams) => string

/** Turns one refused file — or one exhausted budget — into a sentence the user can act on. */
function describeProblem(t: Translate, problem: ImageProblem) {
  switch (problem.kind) {
    case 'count':
      return t('control.imageProblemCount', { max: problem.max })
    case 'total':
      return t('control.imageProblemTotal', { max: formatMegabytes(problem.max) })
    case 'size':
      return t('control.imageProblemSize', {
        name: problem.name,
        max: formatMegabytes(problem.max),
      })
    case 'format':
      return t('control.imageProblemFormat', { name: problem.name })
    case 'decode':
      return t('control.imageProblemDecode', { name: problem.name })
    case 'storage':
      return t('control.imageProblemStorage', { name: problem.name })
  }
}

interface ImageDropzoneProps {
  images: ProductImage[]
  /** Why the last selection was not taken whole. Rendered as a list, never swallowed. */
  problems: ImageProblem[]
  onAdd: (files: File[]) => void
  onRemove: (index: number) => void
  onClear: () => void
  /** Moves the picture at `from` to `to`, shifting the rest along so the order stays dense. */
  onReorder: (from: number, to: number) => void
}

export function ImageDropzone({ images, problems, onAdd, onRemove, onClear, onReorder }: ImageDropzoneProps) {
  const { t } = useLanguage()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  /** Index of the tile being dragged, and the tile it currently sits over. */
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const dragFromRef = useRef<number | null>(null)
  const dragOverRef = useRef<number | null>(null)
  /** Kept in a ref so the window listeners below never capture a stale callback. */
  const reorderRef = useRef(onReorder)
  reorderRef.current = onReorder

  /**
   * The reorder gesture, driven by pointer events so a mouse and a finger take exactly the same
   * path. The listeners live on the window rather than the handle because the pointer leaves the
   * thumbnail the moment the drag begins; the tile under the pointer is found by hit-testing, which
   * works even while the dragged tile is still painting its own hover state.
   */
  useEffect(() => {
    if (dragFrom === null) return

    function trackPointer(event: PointerEvent) {
      const under = document.elementFromPoint(event.clientX, event.clientY)
      const tile = under instanceof Element ? under.closest('[data-image-index]') : null
      const parsed = tile ? Number(tile.getAttribute('data-image-index')) : Number.NaN
      const next = Number.isInteger(parsed) ? parsed : null

      dragOverRef.current = next
      setDragOver(next)
    }

    function endDrag() {
      const from = dragFromRef.current
      const to = dragOverRef.current

      dragFromRef.current = null
      dragOverRef.current = null
      setDragFrom(null)
      setDragOver(null)

      if (from !== null && to !== null && from !== to) reorderRef.current(from, to)
    }

    window.addEventListener('pointermove', trackPointer)
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)

    return () => {
      window.removeEventListener('pointermove', trackPointer)
      window.removeEventListener('pointerup', endDrag)
      window.removeEventListener('pointercancel', endDrag)
    }
  }, [dragFrom])

  function startDrag(index: number) {
    dragFromRef.current = index
    dragOverRef.current = index
    setDragFrom(index)
    setDragOver(index)
  }

  /** The keyboard equivalent of the drag: one step left or right through the gallery. */
  function moveByKey(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
    if (step === 0) return

    const target = index + step
    if (target < 0 || target >= images.length) return

    event.preventDefault()
    onReorder(index, target)
  }

  function acceptFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    // Every picked file goes straight to the validator — format, size, count and total are judged
    // there, not here. Filtering in the dropzone is what would make a refused file silent.
    onAdd(Array.from(list))
  }

  const atCapacity = images.length >= IMAGE_LIMITS.maxCount

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label
          htmlFor="product-image"
          className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
        >
          {t('control.imageLabel')}
          <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">
            {t('control.imageCount', { count: images.length, max: IMAGE_LIMITS.maxCount })}
          </span>
        </label>
        {images.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            className="min-h-9 cursor-pointer rounded-md px-1 text-xs font-semibold text-muted-foreground transition duration-200 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('control.clearImages')}
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">{t('control.imageHint')}</span>
        )}
      </div>

      {images.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setIsDragging(false)
            acceptFiles(event.dataTransfer.files)
          }}
          className={`flex min-h-44 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            isDragging
              ? 'border-primary bg-primary/10'
              : 'border-border bg-muted/40 hover:border-primary/50 hover:bg-muted'
          }`}
        >
          <ImagePlus className="mb-3 size-8 text-primary" aria-hidden="true" />
          <p className="truncate text-sm font-semibold text-foreground">{t('control.dropTitle')}</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">{t('control.dropHint')}</p>
        </button>
      ) : (
        <>
          {images.length > 1 && (
            <p className="mb-2 text-xs text-muted-foreground">{t('control.reorderHint')}</p>
          )}

          <div className="grid grid-cols-2 gap-2.5 xs:grid-cols-3 sm:grid-cols-3">
            {images.map((image, index) => {
              const isDragged = dragFrom === index
              const isTarget = dragFrom !== null && dragOver === index && !isDragged

              return (
                <div
                  key={image.id}
                  data-image-index={index}
                  className={`relative overflow-hidden rounded-xl border transition duration-200 ${
                    isTarget ? 'border-primary ring-2 ring-primary' : 'border-border'
                  }`}
                >
                  <img
                    src={image.url}
                    alt={image.name}
                    draggable={false}
                    className={`aspect-square w-full object-cover transition duration-200 ${
                      isDragged ? 'opacity-50' : ''
                    }`}
                  />

                  {/* The order number doubles as the drag handle. The button keeps a 44px touch
                      target while the visible badge stays small, so the thumbnail is not crowded. */}
                  <button
                    type="button"
                    onPointerDown={() => startDrag(index)}
                    onKeyDown={(event) => moveByKey(event, index)}
                    aria-label={t('control.reorderImage', { index: index + 1 })}
                    title={t('control.reorderImage', { index: index + 1 })}
                    className="group/drag absolute left-1 top-1 flex size-11 cursor-grab touch-none items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:cursor-grabbing"
                  >
                    <span className="flex size-7 items-center justify-center rounded-full bg-black/70 text-[11px] font-bold tabular-nums text-white transition duration-200 group-hover/drag:bg-black">
                      {index + 1}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="absolute right-1 top-1 inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white transition duration-200 hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    aria-label={t('control.removeImage')}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              )
            })}

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={atCapacity}
              onDragOver={(event) => {
                if (atCapacity) return
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setIsDragging(false)
                if (atCapacity) return
                acceptFiles(event.dataTransfer.files)
              }}
              aria-label={atCapacity ? t('control.imageLimitReached') : t('control.addImage')}
              className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-muted-foreground transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                atCapacity
                  ? 'cursor-not-allowed border-border bg-muted/60 opacity-60'
                  : isDragging
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-muted/40 hover:border-primary/50 hover:bg-muted'
              }`}
            >
              <Plus className="size-5 text-primary" aria-hidden="true" />
              <span className="px-1 text-center text-[11px] font-semibold leading-tight text-foreground">
                {atCapacity ? t('control.imageLimitReached') : t('control.addImage')}
              </span>
            </button>
          </div>
        </>
      )}

      {images.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t('control.imageLimits', {
            max: IMAGE_LIMITS.maxCount,
            perFile: formatMegabytes(IMAGE_LIMITS.maxFileBytes),
            total: formatMegabytes(IMAGE_LIMITS.maxTotalBytes),
          })}
        </p>
      )}

      {problems.length > 0 && (
        <div
          role="alert"
          className="mt-2 flex gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <ul className="flex list-disc flex-col gap-0.5 pl-3">
            {problems.map((problem, index) => (
              <li key={`${problem.kind}-${index}`}>{describeProblem(t, problem)}</li>
            ))}
          </ul>
        </div>
      )}

      <input
        id="product-image"
        ref={inputRef}
        type="file"
        accept={ACCEPT_IMAGE_ATTRIBUTE}
        multiple
        className="sr-only"
        onChange={(event) => {
          acceptFiles(event.target.files)
          event.target.value = ''
        }}
      />
    </div>
  )
}
