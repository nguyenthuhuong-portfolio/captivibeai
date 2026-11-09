import { useLanguage } from '../hooks/useLanguage'

interface CharCounterProps {
  /** Tied to the field's `aria-describedby` so a screen reader reads the count with the input. */
  id: string
  /** The field's own label, used for the tooltip and the spoken form. */
  label: string
  value: string
  limit: number
}

/**
 * The live `used/limit` readout under a text field.
 *
 * The number is always visible — a limit the user only discovers on submit is a limit that was
 * hidden from them. It turns amber on the last tenth and red the moment the value is over, which is
 * how an over-long value restored from an older history row announces itself.
 */
export function CharCounter({ id, label, value, limit }: CharCounterProps) {
  const { t } = useLanguage()
  const count = value.length
  const tone =
    count > limit
      ? 'text-destructive'
      : count >= limit * 0.9
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-muted-foreground'

  return (
    <p
      id={id}
      title={t('control.charCountTitle', { label, count, limit })}
      className={`mt-1 text-right text-xs tabular-nums ${tone}`}
    >
      {t('control.charCount', { count, limit })}
    </p>
  )
}
