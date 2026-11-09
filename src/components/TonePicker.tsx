import { useMemo } from 'react'
import type { Tone } from '../types'
import { TONE_IDS } from '../lib/options'
import { useLanguage } from '../hooks/useLanguage'
import { Briefcase, Laugh, Sparkle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PillGroup } from './PillGroup'

const TONE_ICON: Record<Tone, LucideIcon> = {
  funny: Laugh,
  professional: Briefcase,
  genz: Sparkle,
}

interface TonePickerProps {
  value: Tone
  onChange: (tone: Tone) => void
}

/** Single-select: the whole generated set is written in the one voice picked here. */
export function TonePicker({ value, onChange }: TonePickerProps) {
  const { t } = useLanguage()

  const options = useMemo(
    () =>
      TONE_IDS.map((tone) => ({
        id: tone,
        label: t(`tones.${tone}.label`),
        hint: t(`tones.${tone}.hint`),
        icon: TONE_ICON[tone],
      })),
    [t],
  )

  return (
    <PillGroup
      id="tones"
      label={t('control.tone')}
      hint={t('control.toneHint')}
      options={options}
      values={[value]}
      single
      onToggle={(id) => onChange(id as Tone)}
    />
  )
}
