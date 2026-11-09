import { Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useLanguage } from '../hooks/useLanguage'

export interface PillOption {
  id: string
  label: string
  hint?: string
  icon?: LucideIcon
}

interface PillGroupProps {
  id: string
  label: string
  hint: string
  options: PillOption[]
  values: string[]
  onToggle: (id: string) => void
  /** Radio behaviour: exactly one option stays chosen, and the header names it instead of counting. */
  single?: boolean
  /** Marks a group the brief cannot be generated without. */
  required?: boolean
}

/** Accessible pill badges with a glowing gradient selected state, in multi- or single-select form. */
export function PillGroup({
  id,
  label,
  hint,
  options,
  values,
  onToggle,
  single = false,
  required = false,
}: PillGroupProps) {
  const { t } = useLanguage()
  const labelId = `${id}-label`
  const selectedOption = single ? options.find((option) => values.includes(option.id)) : undefined

  return (
    <div id={id} role={single ? 'radiogroup' : 'group'} aria-labelledby={labelId}>
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p id={labelId} className="flex items-center gap-1 text-sm font-semibold text-foreground">
          {label}
          {required && (
            <>
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
              <span className="sr-only"> ({t('control.required')})</span>
            </>
          )}
        </p>
        <span className="text-xs text-muted-foreground">
          {single
            ? (selectedOption?.label ?? t('control.selectedNothing'))
            : values.length > 0
              ? t('control.selected', { count: values.length })
              : t('control.selectedNothing')}
          <span className="hidden sm:inline"> · {hint}</span>
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = values.includes(option.id)
          const Icon = option.icon
          return (
            <button
              key={option.id}
              type="button"
              role={single ? 'radio' : 'checkbox'}
              aria-checked={selected}
              title={option.hint ?? option.label}
              onClick={() => onToggle(option.id)}
              className={`pill inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                selected
                  ? 'pill-selected pill-pop'
                  : 'border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/5'
              }`}
            >
              {selected ? (
                <Check className="size-4" aria-hidden="true" />
              ) : Icon ? (
                <Icon className="size-4 text-primary" aria-hidden="true" />
              ) : null}
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
