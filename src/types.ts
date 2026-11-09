export type Tone = 'funny' | 'professional' | 'genz'

export type AudienceId =
  | 'genz'
  | 'millennials'
  | 'professionals'
  | 'parents'
  | 'students'
  | 'fitness'
  | 'creators'
  | 'luxury'

export type PreviewPlatform = 'instagram' | 'tiktok' | 'facebook'

/**
 * What the post is for. Optional and session-only: it steers how the copy is framed (a launch vs.
 * an offer vs. a question) without turning the brief into a questionnaire. It is deliberately not
 * part of a saved history row, so the stored shape is unchanged.
 */
export type PostObjective = 'introduce' | 'engage' | 'promote' | 'educate'

export type PreviewDevice = 'mobile' | 'desktop'


export type Language = 'en' | 'vi'

/**
 * One product visual held in the form.
 *
 * The bytes live in IndexedDB as a Blob; the form only carries the key they are filed under plus a
 * throwaway Object URL for the preview. Nothing here is ever persisted as text.
 */
export interface ProductImage {
  /** IndexedDB key of the stored Blob. */
  id: string
  /** Original file name, used as alt text. */
  name: string
  /**
   * Size of the file the user picked, in bytes — the compressed Blob is a fraction of it, so this
   * is the figure the per-post upload budget is measured against. Never persisted: a restored row
   * carries no sizes, so `loadProductImages` derives them from the stored Blob instead.
   */
  size: number
  /** Object URL for the preview — revoked as soon as the image leaves the form. */
  url: string
}

export interface ProductForm {
  productName: string
  description: string
  audiences: AudienceId[]
  /** Free-text audience typed by the user, used alongside the preset pills. */
  customAudience?: string
  /** Single-select — the one voice the whole generated set is written in. */
  tone: Tone
  /**
   * What the post is for. Optional: a brief that omits it still generates usable copy. Session-only
   * — it is never written to a history row.
   */
  objective?: PostObjective
  /**
   * Optional hard facts the copy must carry: a real offer, a required message, a call to action.
   * Kept separate from the description so a short product summary can stay short. Session-only.
   */
  extraDetails?: string
  /** The visuals in the order the user added them. */
  images: ProductImage[]
}

export interface ScoredMeta {
  strategy: string
  score: number
  feedback: string
}

export interface GeneratedContent {
  captions: string[]
  headlines: string[]
  hashtags: string[]
  /** Present for validated AI responses; absent for legacy/local mock output. */
  captionMeta?: Array<ScoredMeta | null>
  headlineMeta?: Array<ScoredMeta | null>
  /** Visual observations returned by GPT; never treated as product claims. */
  imageInsights?: string[]
  /** Source marker lets the UI distinguish a real AI response from local fallback content. */
  generationSource?: 'ai' | 'local'
}

/**
 * Buffer of the copy that the last regeneration replaced, so "Undo" can hand back the exact text
 * the user had a moment before. Kept parallel to `GeneratedContent`, so a single card or the whole
 * set can be restored without re-running the generator.
 */
export interface RegenerationSnapshot {
  previousCaptions: string[]
  previousHeadlines: string[]
  previousHashtags: string[]
  previousCaptionMeta?: Array<ScoredMeta | null>
  previousHeadlineMeta?: Array<ScoredMeta | null>
  previousImageInsights?: string[]
  previousGenerationSource?: 'ai' | 'local'
}

export interface HistoryItem extends GeneratedContent {
  id: string
  createdAt: string
  productName: string
  description: string
  audiences: AudienceId[]
  /** The free-text audience is part of the brief, so a restored entry brings it back. */
  customAudience: string
  tone: Tone
  /**
   * Keys of the product visuals in IndexedDB, in the order the user added them. The row holds no
   * image bytes at all — only the references, so history stays a few kilobytes per entry.
   */
  imageIds?: string[]
  /** Original file names, parallel to `imageIds`. */
  imageNames?: string[]
  /**
   * Base64 payloads read back from a pre-IndexedDB row that has not been migrated yet. Memory-only:
   * the migration pass converts each one to a Blob and clears the field, and storage keeps writing
   * them back until it succeeds, so a failed migration never loses the picture.
   */
  legacyImages?: string[]
}

export interface FieldErrors {
  productName?: string
  description?: string
  audiences?: string
  /** The free-text audience is a length-limited field of its own, so it reports separately. */
  customAudience?: string
  /** The optional extra-details field only ever reports a length problem. */
  extraDetails?: string
}
