import { useMemo } from 'react'
import type { PostObjective } from '../types'
import { OBJECTIVE_IDS } from '../lib/options'
import { useLanguage } from '../hooks/useLanguage'
import { GraduationCap, MessagesSquare, Megaphone, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PillGroup } from './PillGroup'

const OBJECTIVE_ICON: Record<PostObjective, LucideIcon> = {
  introduce: Sparkles,
  engage: MessagesSquare,
  promote: Megaphone,
  educate: GraduationCap,
}

interface ObjectivePickerProps {
  /** Optional: an empty value means "let the copywriter decide". */
  value?: PostObjective
  onChange: (objective: PostObjective) => void
}

/** Optional single-select that steers how the generated set is framed. */
export function ObjectivePicker({ value, onChange }: ObjectivePickerProps) {
  const { t } = useLanguage()

  const options = useMemo(
    () =>
      OBJECTIVE_IDS.map((objective) => ({
        id: objective,
        label: t(`objectives.${objective}.label`),
        hint: t(`objectives.${objective}.hint`),
        icon: OBJECTIVE_ICON[objective],
      })),
    [t],
  )

  return (
    <PillGroup
      id="objective"
      label={t('control.objective')}
      hint={t('control.objectiveHint')}
      options={options}
      values={value ? [value] : []}
      single
      onToggle={(id) => onChange(id as PostObjective)}
    />
  )
}
