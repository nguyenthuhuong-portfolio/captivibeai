import {
  BookOpen,
  Check,
  CheckCheck,
  ClipboardCopy,
  Copy,
  Eye,
  Gauge,
  Hash,
  Info,
  Lightbulb,
  Megaphone,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  RotateCw,
  Target,
  Type,
  Undo2,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  GeneratedContent,
  PreviewPlatform,
  RegenerationSnapshot,
} from '../types'
import { useLanguage } from '../hooks/useLanguage'
import {
  captionLimitClass,
  captionLimitLevel,
  feedbackForCaption,
  feedbackForHeadline,
  IDEAL_HOOK_CHARS,
  PLATFORM_LIMITS,
  scoreCaption,
  scoreContent,
  scoreHeadline,
} from '../lib/generate'
import type { CaptionFeedback, ContentScore, HeadlineFeedback } from '../lib/generate'

interface ResultsPanelProps {
  onOpenPreview: () => void
  content: GeneratedContent | null
  generating: boolean
  regeneratingItems: Record<string, boolean>
  /** Re-rolls every caption, headline and hashtag at once. */
  onRegenerate: () => void
  onRegenerateCaption: (index: number) => void
  onRegenerateHeadline: (index: number) => void
  /** Hand-edits one card; the mockups follow the card being typed in. */
  onCaptionChange: (index: number, value: string) => void
  onHeadlineChange: (index: number, value: string) => void
  /** The copy the last regeneration replaced — the buffer behind every rollback affordance. */
  previousContent: RegenerationSnapshot | null
  onUndo: () => void
  onUndoCaption: (index: number) => void
  onUndoHeadline: (index: number) => void
  /** Which caption the mockups render — set from the caption cards' preview toggles. */
  selectedCaptionIndex: number
  onSelectedCaptionChange: (index: number) => void
  /** Which headline supplies the mockup's hook — tracked separately from the caption index. */
  selectedHeadlineIndex: number
  onSelectedHeadlineChange: (index: number) => void
  /** The hashtags switched on — they flow into the mockups, the master copy action and the score. */
  selectedHashtags: string[]
  onToggleHashtag: (tag: string) => void
  onSelectAllHashtags: (allTags: string[]) => void
  onClearHashtags: () => void
  platform: PreviewPlatform
}

export function ResultsPanel({
  onOpenPreview,
  content,
  generating,
  regeneratingItems,
  onRegenerate,
  onRegenerateCaption,
  onRegenerateHeadline,
  onCaptionChange,
  onHeadlineChange,
  previousContent,
  onUndo,
  onUndoCaption,
  onUndoHeadline,
  selectedCaptionIndex,
  onSelectedCaptionChange,
  selectedHeadlineIndex,
  onSelectedHeadlineChange,
  selectedHashtags,
  onToggleHashtag,
  onSelectAllHashtags,
  onClearHashtags,
  platform,
}: ResultsPanelProps) {
  const { t } = useLanguage()
  /** `caption-2` / `headline-0` — at most one card is in edit mode at a time. */
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [resultSectionTab, setResultSectionTab] = useState<'captions' | 'headlines' | 'hashtags'>('captions')
  /** Same key shape as `editingKey` — at most one "⋯" menu is open at a time. */
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null)
  const previewCaption =
    content?.captions[selectedCaptionIndex] ?? content?.captions[0] ?? ''
  /* The hook above the body copy is picked on its own card, so choosing a headline never swaps the
     caption underneath it — the two selections are independent. */
  const previewHeadline =
    content?.headlines[selectedHeadlineIndex] ?? content?.headlines[0] ?? ''
  const platformLabel = t(`preview.platformShort.${platform}`)
  /** Acknowledgement for the master copy action — the one toast this panel raises. */
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)

  function showToast(message: string) {
    setToast(message)
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2400)
  }

  // The toast timer outlives the render that set it, so it is cancelled on unmount to avoid a
  // stray `setState` after the panel is gone.
  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    },
    [],
  )

  /* The audit card scores the exact combination the preview is showing — picked headline, picked
     caption and the tags that are switched on — so the ring and bars move with every choice. */
  const heuristicScore = content
    ? scoreContent(content, {
        headlineIndex: selectedHeadlineIndex,
        captionIndex: selectedCaptionIndex,
        selectedHashtags,
      })
    : { overall: 0, hook: 0, cta: 0, readability: 0 }
  const selectedCaptionMeta = content?.captionMeta?.[selectedCaptionIndex] ?? null
  const selectedHeadlineMeta = content?.headlineMeta?.[selectedHeadlineIndex] ?? null
  // The AI ring is the average quality score of the exact caption/headline pair in the preview.
  // Heuristic metric bars remain available as craft diagnostics; they are not blended with AI scores.
  const score = selectedCaptionMeta && selectedHeadlineMeta
    ? { ...heuristicScore, overall: Math.round((selectedCaptionMeta.score + selectedHeadlineMeta.score) / 2) }
    : heuristicScore
  const totalTags = content?.hashtags.length ?? 0
  const allTagsOn = totalTags > 0 && selectedHashtags.length === totalTags
  const insight = t('results.insightTemplate', {
    hook: t(scoreHeadline(previewHeadline) >= 85 ? 'results.insightHookStrong' : 'results.insightHookWeak'),
    cta: t(score.cta >= 74 ? 'results.insightCtaStrong' : 'results.insightCtaWeak'),
    tags: allTagsOn
      ? t('results.insightTagsFull')
      : t('results.insightTagsPartial', { selected: selectedHashtags.length, total: totalTags }),
  })

  /** Copies the visible combination as one clean post: headline, caption, then the chosen tags. */
  async function handleCopyActiveCombo() {
    if (!content) return
    const combo = [previewHeadline.trim(), previewCaption.trim(), selectedHashtags.join(' ')]
      .filter(Boolean)
      .join('\n\n')
    await navigator.clipboard.writeText(combo)
    showToast(t('results.copyComboDone'))
  }

  /**
   * How long the tag block is on its own, written the way it is pasted — single spaces between the
   * tags, so those separators are part of the count. Recomputed on every selection change.
   */
  const hashtagsLength = selectedHashtags.join(' ').length

  function toggleEditing(key: string) {
    setEditingKey((current) => (current === key ? null : key))
  }

  function toggleMenu(key: string) {
    setOpenMenuKey((current) => (current === key ? null : key))
  }

  // A single document-level pair of listeners serves whichever menu is open: a press outside the menu
  // dismisses it, and Escape closes it without reaching for the pointer.
  useEffect(() => {
    if (openMenuKey === null) return
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Element | null
      if (target?.closest('[data-action-menu]')) return
      setOpenMenuKey(null)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenMenuKey(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openMenuKey])

  /**
   * A rollback is only worth offering while the buffer still differs from what is on screen —
   * after an undo, or once the user edits the text back by hand, the item retires itself.
   */
  const canUndoAll =
    previousContent !== null &&
    content !== null &&
    (previousContent.previousCaptions.some((text, index) => text !== content.captions[index]) ||
      previousContent.previousHeadlines.some((text, index) => text !== content.headlines[index]))

  function canUndoCaption(index: number, caption: string) {
    const previous = previousContent?.previousCaptions[index]
    return previous !== undefined && previous !== caption
  }

  function canUndoHeadline(index: number, headline: string) {
    const previous = previousContent?.previousHeadlines[index]
    return previous !== undefined && previous !== headline
  }

  return (
    <section className="glass flex h-auto w-full flex-col rounded-2xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-foreground">{t('results.title')}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('results.subtitle')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onOpenPreview}
            aria-label={t('preview.openStudio')}
            title={t('preview.openStudio')}
            className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 text-xs font-bold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Eye className="size-4 shrink-0" aria-hidden="true" />
            <span>{t('preview.openStudio')}</span>
          </button>
          {content && (
            <>
              <button
                type="button"
                onClick={handleCopyActiveCombo}
                aria-label={t('results.copyCombo')}
                title={t('results.copyCombo')}
                className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 text-xs font-bold leading-normal text-white shadow-md transition-all duration-200 hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:px-3"
              >
                <ClipboardCopy className="size-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">{t('results.copyCombo')}</span>
              </button>
              {canUndoAll && (
                <button
                  type="button"
                  onClick={onUndo}
                  aria-label={t('results.undoAll')}
                  title={t('results.undoHint')}
                  className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-card text-xs font-semibold leading-normal text-primary transition duration-200 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:px-3.5"
                >
                  <Undo2 className="size-4 shrink-0" aria-hidden="true" />
                  <span className="hidden sm:inline">{t('results.undoAll')}</span>
                </button>
              )}
              <button
                type="button"
                onClick={onRegenerate}
                disabled={generating}
                aria-label={t('results.regenerateAll')}
                title={t('results.regenerateAll')}
                className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-xs font-semibold leading-normal text-foreground transition duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-3.5"
              >
                <RotateCw className={`size-4 shrink-0 ${generating ? 'animate-spin' : ''}`} aria-hidden="true" />
                <span className="hidden sm:inline">{t('results.regenerateAll')}</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="custom-scrollbar mt-4 flex-1 space-y-5">
        {!content ? (
          generating ? (
            <p className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">
              <RotateCw className="size-4 shrink-0 animate-spin" aria-hidden="true" />
              {t('results.generating')}
            </p>
          ) : (
            <p className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">
              {t('results.empty')}
            </p>
          )
        ) : (
          <>
            {content.generationSource !== 'ai' && <MockNotice />}

            <ResultSection icon={Gauge} title={t('results.scoreTitle')}>
              <ScoreCard score={score} insight={insight} imageInsights={content.imageInsights ?? []} />
            </ResultSection>

            <div className="flex w-full items-center gap-1 rounded-xl border border-border/60 bg-muted/50 p-1" role="tablist" aria-label={t('results.contentSections')}>
              <TabButton id="captions" selected={resultSectionTab === 'captions'} onSelect={() => setResultSectionTab('captions')}>
                <Megaphone className="size-4 shrink-0" aria-hidden="true" />
                {t('results.captions')}
              </TabButton>
              <TabButton id="headlines" selected={resultSectionTab === 'headlines'} onSelect={() => setResultSectionTab('headlines')}>
                <Type className="size-4 shrink-0" aria-hidden="true" />
                {t('results.headlines')}
              </TabButton>
              <TabButton id="hashtags" selected={resultSectionTab === 'hashtags'} onSelect={() => setResultSectionTab('hashtags')}>
                <Hash className="size-4 shrink-0" aria-hidden="true" />
                {t('results.hashtags')}
              </TabButton>
            </div>

            <div role="tabpanel" id={`panel-${resultSectionTab}`} aria-label={t(`results.${resultSectionTab}`)} className="min-w-0">
              {resultSectionTab === 'headlines' && (
                <>
                  <ResultSection icon={Type} title={t('results.headlines')}>
                <ul className="space-y-3">
                  {content.headlines.map((headline, index) => {
                    const headlineLabel = t('results.headlineShort', { n: index + 1 })
                    const cardKey = `headline-${index}`
                    const editing = editingKey === cardKey
                    const activeHeadline = selectedHeadlineIndex === index
                    const headlineScore = content.headlineMeta?.[index]?.score ?? scoreHeadline(headline)
                    // Each hook reports its own length — the three cards are separate options.
                    const count = headline.length

                    return (
                      <li
                        /* Index-only key, for the same reason as the caption cards: the row must not
                           remount while its text is being edited. */
                        key={cardKey}
                        /* Two-row card: a compact toolbar strip on top, the headline on its own line
                           below it. The hook never shares a row with the controls, so it always gets
                           the card's full width and the full height of its own line. */
                        className="rounded-2xl border border-border bg-card p-3 transition duration-200"
                      >
                        {/* Row 1 — the header: the card's label on the left, its own actions on the
                            right. The action cluster is `shrink-0`, so it keeps its place in the
                            top-right corner no matter how long the label or the metadata gets. */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex min-w-0 items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                            {headlineLabel}
                          </span>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <RegenerateItemButton
                              label={t('results.regenerateHeadline')}
                              onClick={() => onRegenerateHeadline(index)}
                              loading={Boolean(regeneratingItems[`headline-${index}`])}
                            />
                            {/* Copy, edit and undo stay behind this one trigger. */}
                            <ActionsMenu
                              label={t('results.actions', { label: headlineLabel })}
                              open={openMenuKey === cardKey}
                              highlight={editing}
                              onToggle={() => toggleMenu(cardKey)}
                            >
                              <CopyMenuItem text={headline} />
                              <MenuItem
                                icon={editing ? Check : Pencil}
                                onClick={() => {
                                  toggleEditing(cardKey)
                                  setOpenMenuKey(null)
                                }}
                              >
                                {editing ? t('results.doneEditing') : t('results.edit')}
                              </MenuItem>
                              {canUndoHeadline(index, headline) && (
                                <MenuItem
                                  icon={Undo2}
                                  onClick={() => {
                                    onUndoHeadline(index)
                                    setOpenMenuKey(null)
                                  }}
                                >
                                  {t('results.undoThis')}
                                </MenuItem>
                              )}
                            </ActionsMenu>
                          </div>
                        </div>

                        {/* Row 2 — the metadata strip: score, length and preview state. It wraps on
                            its own underneath the header, so the actions above never move. */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                          {/* The card's own audit score, mirroring the caption cards. */}
                          <span
                            title={t('results.scoreBadge', { label: headlineLabel, score: headlineScore })}
                            className="inline-flex items-center gap-1 text-[11px] font-bold tabular-nums text-primary"
                          >
                            <Gauge className="size-3 shrink-0" aria-hidden="true" />
                            {headlineScore}/100
                          </span>
                          <span aria-hidden="true" className="text-muted-foreground/40">
                            ·
                          </span>
                          {/* The hook's own character count, so an over-long one is visible at a glance. */}
                          <span
                            title={t('results.charsTitle', { label: headlineLabel, count })}
                            className="text-[11px] font-semibold tabular-nums text-muted-foreground"
                          >
                            {count.toLocaleString()} {t('results.charsShort')}
                          </span>
                          {/* Mirrors the caption cards: the hook can be swapped on its own, leaving
                              the caption on screen untouched. The active state is a quiet badge. */}
                          {activeHeadline ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                              <Eye className="size-3 shrink-0" aria-hidden="true" />
                              {t('results.previewing')}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSelectedHeadlineChange(index)}
                              aria-label={t('results.previewHint', { label: headlineLabel })}
                              title={t('results.previewHint', { label: headlineLabel })}
                              className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full border border-border bg-card px-2.5 text-xs font-semibold text-muted-foreground transition duration-200 hover:border-primary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <Eye className="size-3.5 shrink-0" aria-hidden="true" />
                              {t('results.previewThis')}
                            </button>
                          )}
                        </div>

                        {/* Row 3 — the headline itself, on its own line and at the card's full width.
                            `break-words` breaks a word with no space to wrap on, so a long hook wraps
                            naturally instead of overflowing the card. */}
                        {editing ? (
                          <input
                            value={headline}
                            onChange={(event) => onHeadlineChange(index, event.target.value)}
                            aria-label={t('results.editItem', { label: headlineLabel })}
                            autoFocus
                            className="mt-2 w-full rounded-xl border border-border bg-muted px-3 py-2 text-[15px] font-semibold leading-6 text-foreground transition duration-200 focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        ) : (
                          <p className="mt-1.5 break-words text-[15px] font-semibold leading-6 text-foreground">
                            {headline}
                          </p>
                        )}

                        {/* One short, specific suggestion for this hook on its own. */}
                        <FeedbackLine code={feedbackForHeadline(headline)} text={content.headlineMeta?.[index]?.feedback ?? undefined} />
                      </li>
                    )
                  })}
                </ul>
              </ResultSection>
                </>
              )}
              {resultSectionTab === 'captions' && (
                <>
                  <ResultSection icon={Megaphone} title={t('results.captions')}>
                <ul className="space-y-3">
                  {content.captions.map((caption, index) => {
                    // Each card reports its own length: the three captions are separate drafts, so a
                    // single shared count would misreport two of them. The threshold shown is the
                    // active platform's (Instagram 2,200 / TikTok 4,000 / Facebook 63,206).
                    const count = caption.length
                    const level = captionLimitLevel(count, platform)
                    const limit = PLATFORM_LIMITS[platform].limit
                    const hint =
                      level === 'over'
                        ? t('results.overLimitFor', { platform: platformLabel })
                        : level === 'warning'
                          ? t('results.approachingLimit')
                          : t('preview.limitHint', { platform: platformLabel })
                    const captionLabel = t('results.captionN', { n: index + 1 })
                    const cardKey = `caption-${index}`
                    const editing = editingKey === cardKey
                    const active = selectedCaptionIndex === index
                    const captionScore = content.captionMeta?.[index]?.score ?? scoreCaption(caption)

                    return (
                      /* Index-only key: unique per card, and stable while the text is edited in place —
                         a text-based key would remount the card (and blur the field) on every keystroke. */
                      <li key={cardKey} className="rounded-2xl border border-border bg-card p-4">
                        {/* Header — the card's name on the left, its own actions pinned to the
                            top-right corner. The action cluster is `shrink-0` and lives on a row of
                            its own, so the "Previewing" badge below can never push the menu down. */}
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                            {captionLabel}
                          </p>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <RegenerateItemButton
                              label={t('results.regenerateCaption')}
                              onClick={() => onRegenerateCaption(index)}
                              loading={Boolean(regeneratingItems[`caption-${index}`])}
                            />
                            {/* Copy, edit and undo stay behind this one trigger. */}
                            <ActionsMenu
                              label={t('results.actions', { label: captionLabel })}
                              open={openMenuKey === cardKey}
                              highlight={editing}
                              onToggle={() => toggleMenu(cardKey)}
                            >
                              <CopyMenuItem text={caption} />
                              <MenuItem
                                icon={editing ? Check : Pencil}
                                onClick={() => {
                                  toggleEditing(cardKey)
                                  setOpenMenuKey(null)
                                }}
                              >
                                {editing ? t('results.doneEditing') : t('results.edit')}
                              </MenuItem>
                              {canUndoCaption(index, caption) && (
                                <MenuItem
                                  icon={Undo2}
                                  onClick={() => {
                                    onUndoCaption(index)
                                    setOpenMenuKey(null)
                                  }}
                                >
                                  {t('results.undoThis')}
                                </MenuItem>
                              )}
                            </ActionsMenu>
                          </div>
                        </div>
                        {/* Metadata — the card's audit score, length status and preview selection.
                            Wraps on its own row, which is why the header above stays put. */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                          {/* The card's own audit score, length status and preview selection. */}
                          <span
                            title={t('results.scoreBadge', { label: captionLabel, score: captionScore })}
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-xs font-bold tabular-nums text-primary"
                          >
                            <Gauge className="size-3 shrink-0" aria-hidden="true" />
                            {captionScore}/100
                          </span>
                          <span
                            title={t('results.captionLengthTitle', {
                              label: captionLabel,
                              count,
                              limit,
                              platform: platformLabel,
                            })}
                            className={`whitespace-nowrap text-xs font-semibold tabular-nums ${captionLimitClass(count, platform)}`}
                          >
                            {count.toLocaleString()} / {limit.toLocaleString()}
                            {/* The verbose "limit for Instagram" tail is dropped on phones so the
                                metadata stays compact; the warning and over-limit messages stay,
                                because those carry information the colour alone does not convey. */}
                            <span className={level === 'ok' ? 'hidden sm:inline' : undefined}>
                              {' · '}
                              {hint}
                            </span>
                          </span>
                          {count > PLATFORM_LIMITS.x.limit && (
                            <span
                              className={`text-xs font-semibold tabular-nums ${captionLimitClass(count, 'x')}`}
                            >
                              {t('results.overX')}
                            </span>
                          )}
                          {active ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                              <Eye className="size-3.5 shrink-0" aria-hidden="true" />
                              {t('results.previewing')}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSelectedCaptionChange(index)}
                              aria-label={t('results.previewHint', { label: captionLabel })}
                              title={t('results.previewHint', { label: captionLabel })}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground transition duration-200 hover:border-primary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <Eye className="size-3.5 shrink-0" aria-hidden="true" />
                              {t('results.previewThis')}
                            </button>
                          )}
                        </div>
                        {editing ? (
                          /* Every keystroke lands in `content.captions[index]`, so the mockup on the
                             Preview tab shows the hand-written copy on the next render. */
                          <textarea
                            value={caption}
                            onChange={(event) => onCaptionChange(index, event.target.value)}
                            aria-label={t('results.editItem', { label: captionLabel })}
                            rows={6}
                            autoFocus
                            className="custom-scrollbar mt-2 w-full resize-y rounded-xl border border-border bg-muted px-3 py-2 text-sm leading-6 text-foreground transition duration-200 focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        ) : (
                          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground">{caption}</p>
                        )}

                        {/* One short, specific suggestion for this caption on its own. */}
                        <FeedbackLine code={feedbackForCaption(caption)} text={content.captionMeta?.[index]?.feedback ?? undefined} />
                      </li>
                    )
                  })}
                </ul>
              </ResultSection>
                </>
              )}
              {resultSectionTab === 'hashtags' && (
                <>
                  <ResultSection
                icon={Hash}
                title={t('results.hashtags')}
                extra={
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                      {t('results.hashtagsSelected', {
                        selected: selectedHashtags.length,
                        total: content.hashtags.length,
                      })}
                    </span>
                    {/* One count for the whole tag block, kept in step with every toggle. */}
                    <span
                      title={t('results.hashtagsLengthTitle')}
                      className="text-xs font-semibold tabular-nums text-muted-foreground"
                    >
                      {t('results.hashtagsLength', { count: hashtagsLength.toLocaleString() })}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectAllHashtags(content.hashtags)}
                      disabled={allTagsOn}
                      className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full border border-border bg-card px-3 text-xs font-semibold leading-normal text-foreground transition duration-200 hover:border-primary/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCheck className="size-3.5 shrink-0" aria-hidden="true" />
                      {t('results.selectAllTags')}
                    </button>
                    <button
                      type="button"
                      onClick={onClearHashtags}
                      disabled={selectedHashtags.length === 0}
                      className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full border border-border bg-card px-3 text-xs font-semibold leading-normal text-foreground transition duration-200 hover:border-primary/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X className="size-3.5 shrink-0" aria-hidden="true" />
                      {t('results.clearTags')}
                    </button>
                  </div>
                }
              >
                <div className="flex flex-wrap gap-2">
                  {content.hashtags.map((tag) => {
                    const active = selectedHashtags.includes(tag)
                    return active ? (
                      /* Active tag: solid indigo pill with a tick — a click switches it back off. */
                      <button
                        key={tag}
                        type="button"
                        aria-pressed
                        onClick={() => onToggleHashtag(tag)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {tag}
                        <Check className="size-3" aria-hidden="true" />
                      </button>
                    ) : (
                      /* Inactive tag: muted outline pill — a click switches it on. */
                      <button
                        key={tag}
                        type="button"
                        aria-pressed={false}
                        onClick={() => onToggleHashtag(tag)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground transition-all duration-200 hover:border-primary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {tag}
                      </button>
                    )
                  })}
                </div>
              </ResultSection>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background shadow-lg"
        >
          {toast}
        </div>
      )}
    </section>
  )
}

function TabButton({
  id,
  selected,
  onSelect,
  children,
}: {
  id: string
  selected: boolean
  onSelect: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={selected}
      aria-controls={`panel-${id}`}
      onClick={onSelect}
      className={`inline-flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 text-xs font-semibold leading-normal transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3.5 ${
        selected ? 'bg-primary text-on-primary shadow-sm' : 'text-muted-foreground hover:bg-card hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * The per-card re-roll. A phone shows the icon alone — the sentence would eat a third of the row —
 * while `sm` and up keep a short word beside it. Either way the accessible name spells out *which*
 * item is being re-rolled, so this can never be mistaken for the whole-set "Regenerate all".
 */
function RegenerateItemButton({ label, onClick, loading = false }: { label: string; onClick: () => void; loading?: boolean }) {
  const { t } = useLanguage()
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label={label}
      aria-busy={loading}
      title={label}
      className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-xs font-semibold leading-normal text-foreground transition duration-200 hover:bg-muted disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:px-2.5"
    >
      <RefreshCw className={`size-4 shrink-0 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
      <span className="hidden sm:inline">{loading ? t('control.generating') : t('results.regenerate')}</span>
    </button>
  )
}

/**
 * One compact "⋯" trigger per card. Copy / edit / regenerate / undo used to sit in the header as
 * four separate buttons; folding them behind a single trigger keeps the row readable while every
 * action stays one click away.
 */
function ActionsMenu({
  label,
  open,
  highlight,
  onToggle,
  children,
}: {
  label: string
  open: boolean
  /** Keeps the trigger visibly active while the card it belongs to is being edited. */
  highlight: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="relative" data-action-menu>
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={`inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          open || highlight
            ? 'border-primary/50 bg-primary/10 text-primary'
            : 'border-border bg-card text-foreground hover:bg-muted'
        }`}
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute top-full right-0 z-20 mt-1 w-44 rounded-xl border border-border bg-card p-1.5 shadow-lg"
        >
          {children}
        </div>
      )}
    </div>
  )
}

const MENU_ITEM_CLASS =
  'flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left text-sm font-semibold leading-normal text-foreground transition duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function MenuItem({
  icon: Icon,
  onClick,
  children,
}: {
  icon: typeof Copy
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={MENU_ITEM_CLASS}>
      <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
      {children}
    </button>
  )
}

/**
 * Copy acts in place rather than dismissing the menu, so its "Copied" acknowledgement stays on
 * screen instead of flashing past as the menu closes.
 */
function CopyMenuItem({ text }: { text: string }) {
  const { t } = useLanguage()
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <button type="button" role="menuitem" onClick={handleCopy} className={MENU_ITEM_CLASS}>
      {copied ? (
        <Check className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
      ) : (
        <Copy className="size-4 shrink-0 text-primary" aria-hidden="true" />
      )}
      {copied ? t('results.copied') : t('results.copy')}
    </button>
  )
}

function ResultSection({
  icon: Icon,
  title,
  extra,
  children,
}: {
  icon: typeof Type
  title: string
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
          <Icon className="size-4 text-primary" aria-hidden="true" />
          {title}
        </h3>
        {extra}
      </div>
      {children}
    </section>
  )
}

/**
 * Says the copy on screen was written on this device, so it is never mistaken for a live model
 * result. Placed once at the top of the results list rather than repeated on every card.
 */
function MockNotice() {
  const { t } = useLanguage()

  return (
    <div className="flex items-start gap-2 rounded-2xl border border-border bg-muted/40 p-3">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p className="text-xs leading-5 text-muted-foreground">
        <span className="mr-1.5 inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-foreground">
          {t('results.mockBadge')}
        </span>
        {t('results.mockNote')}
      </p>
    </div>
  )
}

/** One short suggestion under a single card, keyed off the code the scorer returned. */
function FeedbackLine({ code, text }: { code: HeadlineFeedback | CaptionFeedback; text?: string }) {
  const { t } = useLanguage()

  return (
    <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
      <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
      <span>
        <span className="font-semibold text-foreground">{t('results.feedbackLabel')}: </span>
        {text ?? t(`results.feedback.${code}`, { ideal: IDEAL_HOOK_CHARS })}
      </span>
    </p>
  )
}

const SCORE_RING_RADIUS = 26
const SCORE_RING_CIRCUMFERENCE = 2 * Math.PI * SCORE_RING_RADIUS

/**
 * The audit card: one ring for the overall verdict, a bar per metric and an AI note underneath.
 * Every figure comes from `scoreContent`, so the card tracks the copy on screen — hand-editing a
 * caption moves the bars on the next keystroke rather than leaving stale numbers behind.
 */
function ScoreCard({ score, insight, imageInsights }: { score: ContentScore; insight: string; imageInsights: string[] }) {
  const { t } = useLanguage()

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
        <ScoreRing score={score.overall} />
        <div className="w-full min-w-0 flex-1 space-y-3">
          <MetricBar icon={Zap} label={t('results.metricHook')} value={score.hook} />
          <MetricBar icon={Target} label={t('results.metricCta')} value={score.cta} />
          <MetricBar icon={BookOpen} label={t('results.metricReadability')} value={score.readability} />
        </div>
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-xs leading-5 text-foreground">
          <span className="font-bold text-primary">{t('results.insightLabel')}: </span>
          {insight}
        </p>
      </div>
      {imageInsights.length > 0 && (
        <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
          <p className="mb-1.5 text-xs font-bold text-foreground">{t('results.imageInsights')}</p>
          <ul className="space-y-1">
            {imageInsights.map((observation, index) => (
              <li key={`${index}-${observation}`} className="text-xs leading-5 text-muted-foreground">• {observation}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ScoreRing({ score }: { score: number }) {
  const { t } = useLanguage()
  const filled = (score / 100) * SCORE_RING_CIRCUMFERENCE

  return (
    <div
      role="img"
      aria-label={t('results.scoreAria', { score })}
      className="relative flex size-[76px] shrink-0 items-center justify-center"
    >
      <svg viewBox="0 0 64 64" className="size-[76px] -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={SCORE_RING_RADIUS} fill="none" strokeWidth="6" className="stroke-muted" />
        <circle
          cx="32"
          cy="32"
          r={SCORE_RING_RADIUS}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${SCORE_RING_CIRCUMFERENCE - filled}`}
          className="stroke-emerald-500 transition-all duration-500"
        />
      </svg>
      <span className="absolute flex items-baseline gap-0.5">
        <span className="text-xl font-bold leading-none tabular-nums text-foreground">{score}</span>
        <span className="text-[10px] font-semibold text-muted-foreground">/100</span>
      </span>
    </div>
  )
}

function MetricBar({ icon: Icon, label, value }: { icon: typeof Zap; label: string; value: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-foreground">
          <Icon className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </span>
        <span className="shrink-0 text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
          {value}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}
