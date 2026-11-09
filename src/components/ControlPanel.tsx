import { Sparkles } from 'lucide-react'
import type { FieldErrors, ProductForm } from '../types'
import { useLanguage } from '../hooks/useLanguage'
import { TEXT_LIMITS, clampToLimit } from '../lib/limits'
import type { ImageProblem } from '../lib/limits'
import { AudiencePicker } from './AudiencePicker'
import { CharCounter } from './CharCounter'
import { ImageDropzone } from './ImageDropzone'
import { ObjectivePicker } from './ObjectivePicker'
import { TonePicker } from './TonePicker'
import { InspirationPicker } from './InspirationPicker'
import type { PreviewPlatform } from '../types'

interface ControlPanelProps {
  form: ProductForm
  errors: FieldErrors
  errorSummaryId: string
  generating: boolean
  selectedInspirationIds: string[]
  onInspirationChange: (ids: string[]) => void
  platform: PreviewPlatform
  onFieldChange: <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => void
  onImages: (files: File[]) => void
  onRemoveImage: (index: number) => void
  onReorderImages: (from: number, to: number) => void
  onClearImages: () => void
  /** Reasons the last upload selection was refused — passed straight through to the dropzone. */
  imageProblems: ImageProblem[]
  onSubmit: () => void
}

export function ControlPanel({
  form,
  errors,
  errorSummaryId,
  generating,
  selectedInspirationIds,
  onInspirationChange,
  platform,
  onFieldChange,
  onImages,
  onRemoveImage,
  onReorderImages,
  onClearImages,
  imageProblems,
  onSubmit,
}: ControlPanelProps) {
  const { t } = useLanguage()
  const errorEntries = Object.entries(errors) as [keyof FieldErrors, string][]

  return (
    <section className="glass flex h-auto w-full flex-col rounded-2xl">
      <div className="border-b border-border/60 p-6 pb-4">
        <h2 className="truncate text-lg font-bold text-foreground">{t('control.title')}</h2>
      </div>

      <form
        className="flex h-auto w-full flex-col"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
        noValidate
      >
        {/* Below `lg` the panel grows to its natural height (no inner scrollbar, nothing clipped);
            from `lg` up the field list becomes the scrollable region of the fixed-height card. */}
        <div className="h-auto space-y-5 overflow-visible overscroll-contain p-4 sm:p-6">
          {errorEntries.length > 0 && (
            <div
              id={errorSummaryId}
              role="alert"
              tabIndex={-1}
              aria-labelledby="error-title"
              className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm"
            >
              <h3 id="error-title" className="font-semibold text-destructive">
                {t('control.errorTitle')}
              </h3>
              <ul className="mt-2 space-y-1">
                {errorEntries.map(([field, message]) => (
                  <li key={field}>
                    <a href={`#${field}`} className="text-destructive underline underline-offset-2">
                      {message}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ImageDropzone
            images={form.images}
            problems={imageProblems}
            onAdd={onImages}
            onRemove={onRemoveImage}
            onReorder={onReorderImages}
            onClear={onClearImages}
          />

          <Field
            id="productName"
            label={t('control.productName')}
            value={form.productName}
            error={errors.productName}
            placeholder={t('control.productNamePlaceholder')}
            limit={TEXT_LIMITS.productName}
            required
            onChange={(value) => onFieldChange('productName', value)}
          />

          <Field
            id="description"
            label={t('control.description')}
            value={form.description}
            error={errors.description}
            placeholder={t('control.descriptionPlaceholder')}
            limit={TEXT_LIMITS.description}
            required
            multiline
            onChange={(value) => onFieldChange('description', value)}
          />

          <AudiencePicker
            values={form.audiences}
            onChange={(audiences) => onFieldChange('audiences', audiences)}
            customAudience={form.customAudience ?? ''}
            customAudienceError={errors.customAudience}
            onCustomChange={(value) => onFieldChange('customAudience', value)}
          />
          {errors.audiences && <FieldError id="audiences" message={errors.audiences} />}

          <TonePicker value={form.tone} onChange={(tone) => onFieldChange('tone', tone)} />

          <ObjectivePicker
            value={form.objective}
            onChange={(objective) => onFieldChange('objective', objective)}
          />

          <InspirationPicker selectedIds={selectedInspirationIds} onChange={onInspirationChange} form={form} platform={platform} />

          <Field
            id="extraDetails"
            label={t('control.extraDetails')}
            value={form.extraDetails ?? ''}
            error={errors.extraDetails}
            placeholder={t('control.extraDetailsPlaceholder')}
            limit={TEXT_LIMITS.extraDetails}
            multiline
            onChange={(value) => onFieldChange('extraDetails', value)}
          />
        </div>

        {/* The card's own footer, in normal flow at every size. It used to be `sticky bottom-0`
            below `lg`, which only works inside a bounded scroll box: here the card is as tall as its
            content and the *page* scrolls, so the opaque bar was lifted to the bottom edge of the
            viewport for as long as the form extended past the fold — a blank white band sitting on
            top of the last fields. In flow, nothing floats over anything and the button still lands
            directly under the field the user has just filled in. */}
        <div className="rounded-b-2xl border-t border-border/60 bg-card p-4 pt-4 sm:p-6 sm:pt-4">
          <button
            type="submit"
            disabled={generating}
            className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-base font-bold leading-normal text-on-primary shadow-sm transition duration-200 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles className="size-5 shrink-0" aria-hidden="true" />
            {generating ? t('control.generating') : t('control.generate')}
          </button>
        </div>
      </form>
    </section>
  )
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={`${id}-error`} role="alert" className="-mt-3 text-sm text-destructive">
      {message}
    </p>
  )
}

function Field({
  id,
  label,
  value,
  error,
  placeholder,
  limit,
  required = false,
  multiline,
  onChange,
}: {
  id: string
  label: string
  value: string
  error?: string
  placeholder: string
  /** Hard character ceiling: further typing is refused rather than flagged after the fact. */
  limit: number
  required?: boolean
  multiline?: boolean
  onChange: (value: string) => void
}) {
  const { t } = useLanguage()
  const countId = `${id}-count`
  // The counter is always announced with the field, whether or not the field is currently in error.
  const describedBy = error ? `${countId} ${id}-error` : countId
  const shared =
    'w-full rounded-xl border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/80 transition duration-200 focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 flex items-center gap-1 text-sm font-semibold text-foreground"
      >
        {label}
        {required && (
          <>
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
            <span className="sr-only"> ({t('control.required')})</span>
          </>
        )}
      </label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          aria-required={required}
          rows={4}
          onChange={(event) => onChange(clampToLimit(event.target.value, limit))}
          className={`${shared} min-h-24 resize-y ${error ? 'border-destructive' : 'border-border'}`}
        />
      ) : (
        <input
          id={id}
          value={value}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          aria-required={required}
          onChange={(event) => onChange(clampToLimit(event.target.value, limit))}
          className={`${shared} min-h-11 ${error ? 'border-destructive' : 'border-border'}`}
        />
      )}
      <CharCounter id={countId} label={label} value={value} limit={limit} />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
