import type { GeneratedContent, PostObjective, PreviewPlatform, ProductForm, Tone } from '../types'
import { AUDIENCE_EN_LABEL } from './options'

/**
 * Platforms the generated copy is measured against. X/Twitter has no preview of its own, but its
 * 280-character ceiling is by far the tightest of the four, so it lives in the same table and is
 * used for cross-posting feedback next to the active preview platform.
 */
export type CaptionPlatform = PreviewPlatform | 'x'

interface PlatformLimit {
  /** Hard maximum the platform accepts. */
  limit: number
  /** Where the counter turns amber — 90% of the maximum, except Facebook (see below). */
  warnAt: number
}

/** Exact character limits required by the contest brief. */
export const PLATFORM_LIMITS: Record<CaptionPlatform, PlatformLimit> = {
  instagram: { limit: 2200, warnAt: 1980 },
  tiktok: { limit: 4000, warnAt: 3600 },
  /** Facebook takes 63,206 characters, but a feed post stops being readable long before that. */
  facebook: { limit: 63206, warnAt: 2000 },
  x: { limit: 280, warnAt: 252 },
}

export type CaptionLimitLevel = 'ok' | 'warning' | 'over'

export function captionLimitLevel(length: number, platform: CaptionPlatform): CaptionLimitLevel {
  const { limit, warnAt } = PLATFORM_LIMITS[platform]
  if (length > limit) return 'over'
  if (length > warnAt) return 'warning'
  return 'ok'
}

/** Length feedback is the only place raw status colors are allowed to leave this module. */
const LIMIT_TEXT_CLASS: Record<CaptionLimitLevel, string> = {
  ok: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  over: 'text-destructive',
}

export function captionLimitClass(length: number, platform: CaptionPlatform) {
  return LIMIT_TEXT_CLASS[captionLimitLevel(length, platform)]
}

const HASHTAG_POOL: Record<Tone, string[]> = {
  funny: ['LOLApproved', 'TooGoodToBeSerious', 'MainCharacterEnergy', 'UnhingedButCute', 'PlotTwistProduct'],
  professional: ['BrandStory', 'MarketReady', 'QualityFirst', 'SmartChoice', 'GrowthMindset'],
  genz: ['ForTheCulture', 'NoCap', 'SoftLife', 'CoreMemory', 'AteAndLeftNoCrumbs'],
}

function slug(value: string) {
  return value
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function compact(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

/** Closes a user-supplied detail with a full stop, unless they already punctuated it. */
function asSentence(value: string) {
  const text = compact(value)
  if (text === '') return ''
  return /[.!?…]$/.test(text) ? text : `${text}.`
}

/**
 * The closing line each post objective appends, so the optional objective genuinely steers the
 * framing instead of being recorded and ignored. An empty objective adds nothing.
 */
const OBJECTIVE_CLOSER: Record<PostObjective, string> = {
  introduce: 'Meet the latest drop — here is what it does.',
  engage: 'Which part are you trying first? Tell us in the comments.',
  promote: 'Grab yours while the offer is still on.',
  educate: 'Save this one so you can come back to it later.',
}

/**
 * Resolves the audience phrase used inside every caption and headline. The free-text audience the
 * user typed is mixed in with the preset pills, keeping its original casing and accents.
 */
function audienceLabel(form: ProductForm) {
  const presets = form.audiences.map((id) => AUDIENCE_EN_LABEL[id])
  const custom = compact(form.customAudience ?? '')
  const all = custom ? [...presets, custom] : presets
  if (all.length === 0) return 'your audience'
  if (all.length === 1) return all[0]
  return `${all.slice(0, -1).join(', ')} and ${all[all.length - 1]}`
}

/** Everything the caption/headline banks are built from, derived once per brief. */
function briefOf(form: ProductForm) {
  const name = compact(form.productName)
  const desc = compact(form.description)
  const people = audienceLabel(form)
  const visionHint = form.images[0]?.name
    ? `Inspired by your product visual (${form.images[0].name}).`
    : 'Ready for the feed the moment you drop the photo.'

  // The optional objective and free-text detail only ever add to the caption tail; an empty brief
  // leaves the tone's own closing sentence untouched.
  const tail: string[] = []
  if (form.objective) tail.push(OBJECTIVE_CLOSER[form.objective])
  const extra = asSentence(form.extraDetails ?? '')
  if (extra) tail.push(extra)
  const suffix = tail.length > 0 ? ` ${tail.join(' ')}` : ''

  return { name, desc, people, suffix, tone: form.tone, visionHint, brandTag: slug(name) || 'BrandDrop' }
}

/** The three caption candidates that slot `index` rotates through for the current brief. */
function captionBankFor(form: ProductForm) {
  const { name, desc, people, suffix, tone, visionHint } = briefOf(form)
  return captionBank(tone, name, desc, people, visionHint, suffix)
}

/** The three headline candidates that slot `index` rotates through for the current brief. */
function headlineBankFor(form: ProductForm) {
  const { name, people, tone } = briefOf(form)
  return headlineBank(tone, name, people)
}

/**
 * Walks one step through a bank so a single card can be re-rolled without disturbing the others.
 * Candidates already used by a sibling card are skipped, so a re-roll never duplicates copy that is
 * on screen — one tone only has three captions, so the fallback accepts a repeat when the bank is
 * exhausted rather than refusing to re-roll at all. A current value that is not in the bank (an
 * older saved item) falls back to the first candidate.
 */
function rotateInBank(bank: string[], current: string, taken: string[] = []) {
  const start = Math.max(0, bank.indexOf(current))
  for (let step = 1; step <= bank.length; step++) {
    const candidate = bank[(start + step) % bank.length]
    if (candidate !== current && !taken.includes(candidate)) return candidate
  }
  return bank[(start + 1) % bank.length]
}

/** Re-rolls just the caption, keeping the tone and the card's position. */
export function regenerateCaption(form: ProductForm, current: string, taken: string[] = []) {
  return rotateInBank(captionBankFor(form), current, taken)
}

/** Re-rolls just the headline, keeping the tone and the card's position. */
export function regenerateHeadline(form: ProductForm, current: string, taken: string[] = []) {
  return rotateInBank(headlineBankFor(form), current, taken)
}

/**
 * Builds a full set of copy for one brief. `variant` rotates the caption, headline and hashtag
 * banks, so “Generate” and “Regenerate” hand back a different mix of the same brief instead of
 * repeating byte-identical output. All three cards share the single selected tone, and the card
 * index only sets where in that tone's bank each one starts.
 */
export function generateContent(form: ProductForm, variant = 0): GeneratedContent {
  const { tone, brandTag } = briefOf(form)

  const captions = [0, 1, 2].map((index) => {
    const bank = captionBankFor(form)
    return bank[(index + variant) % bank.length]
  })

  const headlines = [0, 1, 2].map((index) => {
    const bank = headlineBankFor(form)
    return bank[(index + variant) % bank.length]
  })

  // The brand tag always leads; the tone tags rotate so regenerating surfaces a fresh set.
  const tags = Array.from(new Set([brandTag, ...HASHTAG_POOL[tone]])).map(
    (tag) => (tag.startsWith('#') ? tag : `#${tag}`),
  )
  const [brandHashtag, ...toneHashtags] = tags
  const offset = toneHashtags.length > 0 ? variant % toneHashtags.length : 0
  const hashtags = [brandHashtag, ...toneHashtags.slice(offset), ...toneHashtags.slice(0, offset)].slice(
    0,
    5,
  )

  return { captions, headlines, hashtags }
}

/** The three audit metrics behind the "AI Content Score" card, all 0-100. */
export interface ContentScore {
  /** Weighted verdict shown in the ring. */
  overall: number
  /** How hard the opening line works — a craft measure of the hook, not a reach prediction. */
  hook: number
  /** How explicitly the copy names the next step and speaks to the reader. */
  cta: number
  /** How comfortably the copy reads in a feed. */
  readability: number
}

/** Imperative verbs and direct address — the markers of a post that asks for something. */
const CTA_WORDS = [
  'you', 'your', 'buy', 'shop', 'order', 'get', 'try', 'discover', 'grab', 'start', 'choose',
  'meet', 'send', 'link', 'dm', 'bạn', 'mua', 'đặt', 'thử', 'nhấn', 'bấm', 'inbox', 'chọn',
]
const CTA_PHRASES = ['sign up', 'link in bio', 'swipe up', 'learn more', 'built for', 'ready for', 'khám phá', 'liên hệ', 'bắt đầu', 'đặt hàng']

/** Markers that make a feed scroll stop: questions, cliffhangers and curiosity words. */
const HOOK_WORDS = ['how', 'why', 'secret', 'finally', 'wait', 'stop']
const HOOK_PHRASES = ['plot twist', 'vì sao', 'bí mật', 'bất ngờ']

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

/** Counts distinct cue words in `text`, plus any multi-word phrase it contains. */
function countCues(text: string, words: string[], phrases: string[]) {
  const tokens = new Set(text.split(/[^\p{L}\p{N}']+/u).filter(Boolean))
  const hits = words.filter((word) => tokens.has(word)).length
  const phraseHits = phrases.filter((phrase) => text.includes(phrase)).length
  return hits + phraseHits
}

/** Which of the generated items the preview is currently showing. */
export interface ScoreSelection {
  headlineIndex: number
  captionIndex: number
  /** The hashtags switched on — an empty set costs reach, so it costs hook strength. */
  selectedHashtags: string[]
}

/** Roughly the word count a feed caption should land on before attention drifts. */
const IDEAL_CAPTION_WORDS = 24
/** Roughly the length a hook reads best at. */
export const IDEAL_HOOK_CHARS = 45

function wordsOf(text: string) {
  return text.split(/[^\p{L}\p{N}']+/u).filter(Boolean)
}

/** Readability of one block of copy: short, plain sentences score highest. */
function readabilityOf(text: string) {
  const words = wordsOf(text)
  if (words.length === 0) return 0
  const avgWordLength = words.reduce((total, word) => total + word.length, 0) / words.length
  const lengthFit = 100 - Math.abs(words.length - IDEAL_CAPTION_WORDS) * 2.2
  const wordFit = 100 - Math.max(0, avgWordLength - 5.2) * 10
  return clamp(lengthFit * 0.6 + wordFit * 0.4)
}

/** How hard one hook works: a short, plain line with a curiosity marker scores highest. */
function hookScoreOf(headline: string) {
  if (headline.trim() === '') return 0
  const lengthFit = 100 - Math.abs(headline.length - IDEAL_HOOK_CHARS) * 0.6
  return clamp(lengthFit + countCues(headline.toLowerCase(), HOOK_WORDS, HOOK_PHRASES) * 6)
}

/** How strongly one caption names the next step or addresses the reader directly. */
function ctaScoreOf(caption: string) {
  if (caption.trim() === '') return 0
  return clamp(68 + countCues(caption.toLowerCase(), CTA_WORDS, CTA_PHRASES) * 6)
}

/** Verdict for a single headline card — the hook metric, so a badge can sit beside the text. */
export function scoreHeadline(headline: string) {
  return hookScoreOf(headline)
}

/** Verdict for a single caption card — readability and CTA pull combined. */
export function scoreCaption(caption: string) {
  return clamp(readabilityOf(caption) * 0.5 + ctaScoreOf(caption) * 0.5)
}

/**
 * The one line of advice a single headline card shows. The codes map straight onto
 * `results.feedback.<code>` in the dictionary, so the wording lives with every other string.
 */
export type HeadlineFeedback = 'headlineStrong' | 'headlineSoft' | 'headlineLong' | 'headlineEmpty'
export type CaptionFeedback = 'captionStrong' | 'captionCta' | 'captionDense' | 'captionEmpty'

/** Says what would improve *this* hook, judged on its own rather than on the whole set. */
export function feedbackForHeadline(headline: string): HeadlineFeedback {
  if (headline.trim() === '') return 'headlineEmpty'
  if (headline.length > IDEAL_HOOK_CHARS + 20) return 'headlineLong'
  return hookScoreOf(headline) >= 78 ? 'headlineStrong' : 'headlineSoft'
}

/** Says what would improve *this* caption, judged on its own rather than on the whole set. */
export function feedbackForCaption(caption: string): CaptionFeedback {
  if (caption.trim() === '') return 'captionEmpty'
  if (wordsOf(caption).length > IDEAL_CAPTION_WORDS * 2) return 'captionDense'
  return ctaScoreOf(caption) >= 80 ? 'captionStrong' : 'captionCta'
}

/**
 * Scores the combination the preview is showing — the picked headline, the picked caption and the
 * hashtags that are switched on — so the ring and the bars move the moment a card is selected or a
 * tag is toggled. The weights are tuned so a well-formed set of AI copy lands in the high 80s
 * rather than at a flat 100.
 */
export function scoreContent(content: GeneratedContent, selection: ScoreSelection): ContentScore {
  const caption = content.captions[selection.captionIndex] ?? content.captions[0] ?? ''
  const headline = content.headlines[selection.headlineIndex] ?? content.headlines[0] ?? ''
  if (caption.trim() === '' && headline.trim() === '') {
    return { overall: 0, hook: 0, cta: 0, readability: 0 }
  }

  /* Coverage is the share of the generated tag set that is switched on: dropping tags costs reach. */
  const totalTags = content.hashtags.length
  const coverage = totalTags === 0 ? 100 : (selection.selectedHashtags.length / totalTags) * 100
  const curiosity = clamp(62 + countCues(caption.toLowerCase(), HOOK_WORDS, HOOK_PHRASES) * 11)
  const hook = clamp(hookScoreOf(headline) * 0.5 + coverage * 0.3 + curiosity * 0.2)

  const cta = ctaScoreOf(caption)
  const readability = readabilityOf(caption)
  const overall = clamp(hook * 0.34 + cta * 0.33 + readability * 0.33)

  return { overall, hook, cta, readability }
}

function captionBank(
  tone: Tone,
  name: string,
  desc: string,
  people: string,
  visionHint: string,
  suffix = '',
): string[] {
  const base = toneBank(tone, name, desc, people, visionHint)
  return suffix === '' ? base : base.map((caption) => `${caption}${suffix}`)
}

function toneBank(
  tone: Tone,
  name: string,
  desc: string,
  people: string,
  visionHint: string,
): string[] {
  switch (tone) {
    case 'funny':
      return [
        `Meet ${name}: the plot twist ${people} didn’t put on the vision board, but absolutely needed. ${desc} Warning: may cause spontaneous “wait, I need this” texts. ${visionHint}`,
        `${name} just walked in like it pays rent. ${desc} Built for ${people} who want results without the 47-step morning routine. Your feed can thank us later.`,
        `Not to be dramatic, but ${name} might end your “I’ll treat myself later” era. ${desc} For ${people} who like quality with a side of chaos. ${visionHint}`,
      ]
    case 'professional':
      return [
        `${name} is designed for ${people}. ${desc} Clear, consistent, and ready to deliver.`,
        `Elevate the brief. ${name} combines practical performance with a brand-ready story: ${desc}`,
        `From first impression to lasting recall, ${name} communicates value fast. Crafted with ${people} in mind.`,
      ]
    case 'genz':
      return [
        `${name} is giving main-character utility. ${desc} If you’re ${people} and your algorithm keeps testing you… this is the plot armor. ${visionHint}`,
        `Be so for real: ${name} understood the assignment. ${desc} Soft life energy for ${people} who refuse to settle for mid.`,
        `It’s giving “I manifested this in a notes app at 1am.” ${name} — ${desc} Made for ${people}. Screenshot it. Send it. Then actually buy it.`,
      ]
  }
}

function headlineBank(tone: Tone, name: string, people: string): string[] {
  switch (tone) {
    case 'funny':
      return [
        `${name}: Because “fine” is a personality you outgrew`,
        `The ${name} era is unreasonably entertaining`,
        `${people}, your new favorite overreaction is here`,
      ]
    case 'professional':
      return [
        `${name}: Performance you can brief with confidence`,
        `Built for ${people}. Ready for the market.`,
        `Clarity, quality, and a brand story that converts`,
      ]
    case 'genz':
      return [
        `${name} ate. That’s the tweet.`,
        `Soft life, hard results — ${name}`,
        `For ${people} who don’t do mid`,
      ]
  }
}
