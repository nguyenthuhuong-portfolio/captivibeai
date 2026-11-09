import type { ProductForm } from '../types'
import { TEXT_LIMITS } from './limits'

/**
 * The brief's rules, expressed as data rather than as sentences.
 *
 * Keeping this layer free of React and of `t()` is what makes it directly testable: the rules that
 * decide whether "Generate" may run are the same rules the UI shows, and they are checked without
 * rendering anything. `App.tsx` maps each code below onto a translated message.
 *
 * A value is measured *after* trimming, so a field holding nothing but spaces counts as empty
 * rather than as content.
 */

/** What is wrong with one text field. */
export type TextIssue = 'required' | 'tooLong'

export interface BriefIssues {
  productName?: TextIssue
  description?: TextIssue
  /** The preset audience pills — at least one segment is needed to write for. */
  audiences?: 'required'
  /** The optional free-text audience only ever reports a length problem. */
  customAudience?: TextIssue
  /** The optional extra-details field only ever reports a length problem. */
  extraDetails?: TextIssue
}

/** Every rule the brief is held to before it may be generated. */
export function validateBrief(form: ProductForm): BriefIssues {
  const issues: BriefIssues = {}

  const productName = form.productName.trim()
  if (productName.length === 0) issues.productName = 'required'
  else if (productName.length > TEXT_LIMITS.productName) issues.productName = 'tooLong'

  const description = form.description.trim()
  if (description.length === 0) issues.description = 'required'
  else if (description.length > TEXT_LIMITS.description) issues.description = 'tooLong'

  if (form.audiences.length === 0) issues.audiences = 'required'

  const customAudience = (form.customAudience ?? '').trim()
  if (customAudience.length > TEXT_LIMITS.audience) issues.customAudience = 'tooLong'

  // Optional and never required: an empty extra-details field is a perfectly valid brief.
  const extraDetails = (form.extraDetails ?? '').trim()
  if (extraDetails.length > TEXT_LIMITS.extraDetails) issues.extraDetails = 'tooLong'

  return issues
}

/** True when nothing stands between the brief and a generation. */
export function isBriefValid(issues: BriefIssues) {
  return Object.keys(issues).length === 0
}

/**
 * The brief as it should be generated and saved: the padding around the visible text is not part
 * of the brief, so it never reaches the generator or a history row.
 */
export function trimBrief(form: ProductForm): ProductForm {
  return {
    ...form,
    productName: form.productName.trim(),
    description: form.description.trim(),
    customAudience: (form.customAudience ?? '').trim(),
    extraDetails: (form.extraDetails ?? '').trim(),
  }
}
