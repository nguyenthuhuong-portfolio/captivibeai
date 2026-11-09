import { useMemo } from 'react'
import type { AudienceId } from '../types'
import { AUDIENCE_IDS } from '../lib/options'
import { TEXT_LIMITS, clampToLimit } from '../lib/limits'
import { useLanguage } from '../hooks/useLanguage'
import { CharCounter } from './CharCounter'
import { PillGroup } from './PillGroup'

interface AudiencePickerProps {
  values: AudienceId[]
  onChange: (audiences: AudienceId[]) => void
  customAudience: string
  /** Set when a restored free-text audience sits over its ceiling and has to be trimmed. */
  customAudienceError?: string
  onCustomChange: (value: string) => void
}

export function AudiencePicker({
  values,
  onChange,
  customAudience,
  customAudienceError,
  onCustomChange,
}: AudiencePickerProps) {
  const { t } = useLanguage()

  const options = useMemo(
    () => AUDIENCE_IDS.map((id) => ({ id, label: t(`audiences.${id}`) })),
    [t],
  )

  const countId = 'customAudience-count'
  const describedBy = customAudienceError ? `${countId} customAudience-error` : countId

  return (
    <div>
      <PillGroup
        id="audiences"
        label={t('control.audience')}
        hint={t('control.audienceHint')}
        options={options}
        values={values}
        required
        onToggle={(id) => {
          const audience = id as AudienceId
          onChange(
            values.includes(audience)
              ? values.filter((item) => item !== audience)
              : [...values, audience],
          )
        }}
      />

      {/* Free-text audience for segments the preset pills do not cover. The `id` is what the error
          summary links to, exactly like the two text fields above it. */}
      <input
        id="customAudience"
        type="text"
        value={customAudience}
        onChange={(event) => onCustomChange(clampToLimit(event.target.value, TEXT_LIMITS.audience))}
        placeholder={t('control.customAudiencePlaceholder')}
        aria-label={t('control.customAudience')}
        aria-invalid={Boolean(customAudienceError)}
        aria-describedby={describedBy}
        className={`mt-2.5 w-full rounded-xl border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none focus:ring-2 focus:ring-ring ${
          customAudienceError ? 'border-destructive' : 'border-border'
        }`}
      />
      <CharCounter
        id={countId}
        label={t('control.customAudience')}
        value={customAudience}
        limit={TEXT_LIMITS.audience}
      />
      {customAudienceError && (
        <p id="customAudience-error" className="mt-1 text-sm text-destructive">
          {customAudienceError}
        </p>
      )}
    </div>
  )
}
