import type { AudienceId, PostObjective, Tone } from '../types'

/**
 * Tone picker options — the three voices the copy can be written in: Funny → Professional →
 * Youthful. The tone is single-select, so this list is also the full set of valid values.
 *
 * Only the ids live here; the display labels are held in `lib/i18n.ts` (`tones.<id>.label`).
 * Ids are persisted inside saved history, so they are never renamed.
 */
export const TONE_IDS: Tone[] = ['funny', 'professional', 'genz']

/** The tone the form starts on, and the one malformed stored rows fall back to. */
export const DEFAULT_TONE: Tone = 'professional'

export const AUDIENCE_IDS: AudienceId[] = [
  'genz',
  'millennials',
  'professionals',
  'parents',
  'students',
  'fitness',
  'creators',
  'luxury',
]

/** English labels are also used to compose the generated marketing copy. */
export const AUDIENCE_EN_LABEL: Record<AudienceId, string> = {
  genz: 'Gen Z',
  millennials: 'Millennials',
  professionals: 'busy professionals',
  parents: 'parents',
  students: 'students',
  fitness: 'fitness lovers',
  creators: 'creators',
  luxury: 'luxury shoppers',
}

/**
 * Post-objective options — what the post is *for*, as opposed to the tone it is written in. The
 * two are orthogonal, so this is its own single-select. It is optional: picking none leaves the
 * generator on its neutral framing. Only the ids live here; the labels are in `lib/i18n.ts`
 * (`objectives.<id>.label`). Session-only — never persisted into a history row.
 */
export const OBJECTIVE_IDS: PostObjective[] = ['introduce', 'engage', 'promote', 'educate']
