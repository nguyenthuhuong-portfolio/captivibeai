import { useCallback, useEffect, useRef, useState } from 'react'
import { CommunityContributionDialog } from './components/CommunityContributionDialog'
import { ControlPanel } from './components/ControlPanel'
import { Header } from './components/Header'
import { HistoryDrawer } from './components/HistoryDrawer'
import { NoticeStack } from './components/NoticeStack'
import { PreviewStudio } from './components/PreviewStudio'
import { WorkspaceTabs } from './components/WorkspaceTabs'
import { ResultsPanel } from './components/ResultsPanel'
import { useHistory } from './hooks/useHistory'
import { useLanguage } from './hooks/useLanguage'
import { useNotices } from './hooks/useNotices'
import { useTheme } from './hooks/useTheme'
import { generateContent, regenerateCaption, regenerateHeadline } from './lib/generate'
import { AIRequestError, generateWithAI, regenerateWithAI } from './lib/ai'
import { loadProductImages, putImage } from './lib/imageStore'
import type { TranslationKey, TranslateParams } from './lib/i18n'
import { TEXT_LIMITS, selectAcceptableImages, totalImageBytes } from './lib/limits'
import type { ImageProblem } from './lib/limits'
import { DEFAULT_TONE } from './lib/options'
import { compressImageToBlob, createImageId } from './lib/utils'
import { isBriefValid, trimBrief, validateBrief } from './lib/validation'
import type { BriefIssues } from './lib/validation'
import type { FieldErrors, GeneratedContent, HistoryItem, PreviewDevice, PreviewPlatform, ProductForm, ProductImage, RegenerationSnapshot } from './types'

type Translate = (key: TranslationKey, params?: TranslateParams) => string

const INITIAL_FORM: ProductForm = {
  productName: '',
  description: '',
  audiences: [],
  customAudience: '',
  tone: DEFAULT_TONE,
  images: [],
}

/**
 * Turns the rules engine's codes into the sentences the fields and the error summary show.
 *
 * `validateBrief` decides *what* is wrong and this decides how to say it, which is what keeps the
 * rules testable on their own and every message in one dictionary.
 */
function describeIssues(issues: BriefIssues, t: Translate): FieldErrors {
  const errors: FieldErrors = {}

  if (issues.productName) {
    errors.productName =
      issues.productName === 'required'
        ? t('errors.productName')
        : t('errors.tooLong', { label: t('control.productName'), limit: TEXT_LIMITS.productName })
  }

  if (issues.description) {
    errors.description =
      issues.description === 'required'
        ? t('errors.description')
        : t('errors.tooLong', { label: t('control.description'), limit: TEXT_LIMITS.description })
  }

  if (issues.audiences === 'required') errors.audiences = t('errors.audiences')

  if (issues.customAudience === 'tooLong') {
    errors.customAudience = t('errors.tooLong', {
      label: t('control.customAudience'),
      limit: TEXT_LIMITS.audience,
    })
  }

  // Optional, so the only thing that can be wrong with it is its length.
  if (issues.extraDetails === 'tooLong') {
    errors.extraDetails = t('errors.tooLong', {
      label: t('control.extraDetails'),
      limit: TEXT_LIMITS.extraDetails,
    })
  }

  return errors
}

export default function App() {
  const { theme, toggle } = useTheme()
  const { t, language } = useLanguage()
  const { notices, notify, dismiss } = useNotices()
  // The writer tells the user when a snapshot could not be stored — a lost history is worth saying
  // out loud rather than leaving to the console.
  const handleSaveError = useCallback(
    () => notify({ key: 'notice.historySaveFailed', tone: 'error' }),
    [notify],
  )
  const { items, addItem, removeItem, clearAll, saveState, unmigratedImages } = useHistory({
    onSaveError: handleSaveError,
  })
  const [form, setForm] = useState<ProductForm>(INITIAL_FORM)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [content, setContent] = useState<GeneratedContent | null>(null)
  const [workspaceTab, setWorkspaceTab] = useState<'inputs' | 'results'>('inputs')
  const [previewStudioOpen, setPreviewStudioOpen] = useState(false)
  const closePreviewStudio = useCallback(() => setPreviewStudioOpen(false), [])
  const [platform, setPlatform] = useState<PreviewPlatform>('instagram')
  const [selectedInspirationIds, setSelectedInspirationIds] = useState<string[]>([])
  const [device, setDevice] = useState<PreviewDevice>('mobile')
  const [generating, setGenerating] = useState(false)
  const [regeneratingItems, setRegeneratingItems] = useState<Record<string, boolean>>({})
  const [historyOpen, setHistoryOpen] = useState(false)
  const [contributionOpen, setContributionOpen] = useState(false)
  /**
   * Why the last upload selection was not taken whole. Shown verbatim by the dropzone so a refused
   * file is explained rather than silently dropped; cleared as soon as the gallery changes.
   */
  const [imageProblems, setImageProblems] = useState<ImageProblem[]>([])
  // Rotates the generator banks so every "Generate"/"Regenerate" click returns a fresh variation.
  const [variant, setVariant] = useState(0)
  /** The copy the last regeneration replaced — the buffer behind every "Undo" affordance. */
  const [previousContent, setPreviousContent] = useState<RegenerationSnapshot | null>(null)
  /**
   * Which caption the mockups show. Picking a card in the results list drives the live preview, and
   * editing a card selects it too, so a hand-written caption is visible the moment it is typed.
   */
  const [selectedCaptionIndex, setSelectedCaptionIndex] = useState(0)
  /**
   * Which headline supplies the hook above the mockup's caption. It is deliberately independent of
   * the caption index, so picking a hook never disturbs the body copy already on screen.
   */
  const [selectedHeadlineIndex, setSelectedHeadlineIndex] = useState(0)
  /**
   * The hashtags the user has switched on. A fresh generation turns every generated tag on, and the
   * set flows straight into the mockups, the master copy action and the audit score.
   */
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([])
  const errorSummaryId = 'form-error-summary'
  const workspaceRef = useRef<HTMLElement>(null)

  // Switching between Inputs and Results always lands at the top of the workspace, not at the
  // scroll offset where the user last pressed Generate near the bottom of a long form.
  useEffect(() => {
    requestAnimationFrame(() => {
      workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [workspaceTab])

  /**
   * Guards that live outside React state on purpose: both must be read and written within a single
   * tick, before any re-render could have disabled a button. A ref is what actually stops a second
   * trigger from starting a duplicate run.
   */
  const submittingRef = useRef(false)
  const regeneratingAllRef = useRef(false)
  const regeneratingItemRef = useRef(new Set<string>())
  const processingRef = useRef(false)
  const notifyGenerateFailed = useCallback(
    () => notify({ key: 'notice.generateFailed', tone: 'error' }),
    [notify],
  )

  const notifyGenerateReady = useCallback(
    () => notify({ key: 'notice.generateReady', tone: 'success' }),
    [notify],
  )

  function updateField<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (key in errors) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key as keyof FieldErrors]
        return next
      })
    }
  }

  async function handleImages(files: File[]) {
    // A second drop landing while the first is still decoding would interleave two galleries and
    // could slip past the four-photo cap, so a selection is taken one at a time.
    if (processingRef.current) return

    // Every picked file is judged here, before a single byte is decoded: format, per-file size, the
    // four-photo cap and the per-post budget. Whatever is refused is reported back to the dropzone
    // by name — a rejected upload is never just swallowed.
    const { accepted, problems } = selectAcceptableImages(
      { count: form.images.length, bytes: totalImageBytes(form.images) },
      files,
    )

    const rejected: ImageProblem[] = [...problems]

    if (accepted.length === 0) {
      setImageProblems(rejected)
      return
    }

    processingRef.current = true

    const loaded: ProductImage[] = []

    try {
      // Xử lý tuần tự để tránh giải mã nhiều ảnh lớn cùng lúc.
      for (const file of accepted) {
        const blob = await compressImageToBlob(file)

        // `null` is the decoder saying these bytes are not a picture at all — a damaged or
        // mislabelled file. It is named and skipped; the ones that worked are still kept.
        if (!blob) {
          rejected.push({ kind: 'decode', name: file.name })
          continue
        }

        const id = createImageId()

        // Ảnh đi thẳng vào IndexedDB; form và history chỉ giữ lại khoá cùng một Object URL tạm.
        const stored = await putImage(id, blob)

        // Without a Blob behind that key, saving this brief would store a reference to nothing and
        // the picture would be missing the next time the entry was opened. Reported, not added.
        if (!stored) {
          rejected.push({ kind: 'storage', name: file.name })
          continue
        }

        loaded.push({
          id,
          name: file.name,
          // The *original* size, not the compressed one: the budget is about what was uploaded.
          size: file.size,
          url: URL.createObjectURL(blob),
        })
      }
    } finally {
      processingRef.current = false
    }

    setImageProblems(rejected)

    // Anything that made it through joins the gallery even when a neighbour in the same selection
    // did not, so one bad file never costs the user the good ones.
    if (loaded.length > 0) setForm((prev) => ({ ...prev, images: [...prev.images, ...loaded] }))
  }

  function removeImage(index: number) {
    // Ảnh rời khỏi form thì Object URL của nó không còn ai dùng nữa.
    const removed = form.images[index]
    if (removed) URL.revokeObjectURL(removed.url)

    setForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }))
    // The gallery changed, so the reasons some files were turned away no longer describe it.
    setImageProblems([])
  }

  /**
   * Moves one visual to a new slot. Every consumer — the dropzone, all three mockups and the history
   * row — reads the same array in order, so the new order is what the previews and a save both see.
   */
  function reorderImages(from: number, to: number) {
    setForm((prev) => {
      const images = [...prev.images]
      if (from === to || from < 0 || to < 0 || from >= images.length || to >= images.length) return prev

      const [moved] = images.splice(from, 1)
      images.splice(to, 0, moved)
      return { ...prev, images }
    })
  }

  /** Drops every visual in the form and releases the Object URLs that backed them. */
  function clearImages() {
    form.images.forEach((image) => URL.revokeObjectURL(image.url))
    setForm((prev) => ({ ...prev, images: [] }))
    setImageProblems([])
  }

  /** Brings a saved brief back, rebuilding its gallery from the Blobs stored under its keys. */
  async function restoreHistory(item: HistoryItem) {
    const ids = item.imageIds ?? []
    let images: ProductImage[] = []

    try {
      images = await loadProductImages(ids, item.imageNames ?? [])
    } catch (error) {
      // IndexedDB being unreachable must not stop the restore: the brief and its copy are plain
      // text and are still perfectly usable without the pictures.
      console.error('[captivibe] saved images could not be read', error)
    }

    // The gallery currently on screen is replaced wholesale, so its Object URLs go first.
    form.images.forEach((image) => URL.revokeObjectURL(image.url))

    setForm({
      productName: item.productName,
      description: item.description,
      audiences: item.audiences,
      // The free-text audience and the tone are part of the saved brief, so both come back.
      customAudience: item.customAudience ?? '',
      tone: item.tone,
      images,
    })
    setContent({
      captions: item.captions,
      headlines: item.headlines,
      hashtags: item.hashtags,
      captionMeta: item.captionMeta,
      headlineMeta: item.headlineMeta,
      imageInsights: item.imageInsights,
      generationSource: item.generationSource,
    })
    // A restored brief starts with its whole tag set switched on, like a fresh generation.
    setSelectedHashtags(item.hashtags)
    setWorkspaceTab('results')
    setHistoryOpen(false)
    // A restore is not an upload, so nothing from a previous selection carries over to it.
    setImageProblems([])

    // A row whose Blobs were evicted restores with fewer pictures than it saved; saying so is the
    // difference between "the app lost my photos" and "the browser dropped them".
    const missing = ids.length - images.length
    notify(
      missing > 0
        ? { key: 'notice.historyImagesMissing', params: { count: missing }, tone: 'error' }
        : { key: 'notice.historyRestored', tone: 'success' },
    )
  }

  /**
   * The single gate every "Generate" passes through. Presence and length are checked together so
   * one pass reports everything wrong with the brief, and the length rules come from `TEXT_LIMITS`
   * rather than from the inputs — a value restored from history, or one that arrived some other way,
   * is held to exactly the same ceiling as a value being typed.
   *
   * The gallery is deliberately *not* re-checked here. Its limits are about what may be uploaded,
   * and they are enforced at upload time; a brief restored from history keeps whatever it saved, so
   * reopening an older entry can never be blocked by a rule that did not exist when it was saved.
   */
  async function handleSubmit() {
    // The button is disabled while generating, but a double click — or a held Enter key — can still
    // reach this twice before that state lands. The ref closes that window.
    if (submittingRef.current) return

    const issues = validateBrief(form)
    setErrors(describeIssues(issues, t))

    if (!isBriefValid(issues)) {
      requestAnimationFrame(() => {
        document.getElementById(errorSummaryId)?.focus()
      })
      return
    }

    // Whitespace around the brief is never part of the brief: the trimmed copy is what is generated
    // and what is written to history, so no saved entry starts or ends with padding.
    const trimmed = trimBrief(form)

    submittingRef.current = true
    setGenerating(true)
    // Show the results tab immediately so the in-flight state is visible where the copy will land.
    setWorkspaceTab('results')

    try {
      const nextVariant = variant + 1
      let generated: GeneratedContent
      let usedFallback = false
      try {
        generated = await generateWithAI(trimmed, language, platform, undefined, selectedInspirationIds)
      } catch (error) {
        // The local generator remains available when the server/key/provider is not configured.
        console.warn('[captivibe] AI unavailable; using local generator', error instanceof AIRequestError ? error.code : 'unknown')
        generated = { ...generateContent(trimmed, nextVariant), generationSource: 'local' }
        usedFallback = true
      }
      setVariant(nextVariant)
      setForm(trimmed)
      setContent(generated)
      // A fresh brief starts a new context: nothing older to roll back to.
      setPreviousContent(null)
      setSelectedCaptionIndex(0)
      setSelectedHeadlineIndex(0)
      // Every freshly generated tag starts switched on — dropping one is a deliberate choice.
      setSelectedHashtags(generated.hashtags)
      addItem(trimmed, generated)
      // A fallback is clearly labelled; a validated AI response gets the normal ready notice.
      if (usedFallback) notify({ key: 'notice.aiFallback', tone: 'error' })
      else notifyGenerateReady()
    } catch (error) {
      // A local fallback failure is rare; the previous brief and result stay untouched.
      console.error('[captivibe] generation failed', error)
      notifyGenerateFailed()
    } finally {
      // Runs whatever happened above: the button is never left stuck on "Generating…".
      submittingRef.current = false
      setGenerating(false)
    }
  }

  /** Copies text and AI metadata into the undo buffer before a regeneration overwrites it. */
  function rememberForUndo(current: GeneratedContent) {
    setPreviousContent({
      previousCaptions: [...current.captions],
      previousHeadlines: [...current.headlines],
      previousHashtags: [...current.hashtags],
      previousCaptionMeta: current.captionMeta ? [...current.captionMeta] : undefined,
      previousHeadlineMeta: current.headlineMeta ? [...current.headlineMeta] : undefined,
      previousImageInsights: current.imageInsights ? [...current.imageInsights] : undefined,
      previousGenerationSource: current.generationSource,
    })
  }

  /** Regenerates the whole set with one AI request; the previous set is untouched on failure. */
  async function handleRegenerate() {
    if (!content || generating || regeneratingAllRef.current) return
    regeneratingAllRef.current = true
    setGenerating(true)
    try {
      const nextVariant = variant + 1
      let generated: GeneratedContent
      let usedFallback = false
      try {
        // Reuse image observations; a full re-roll does not upload the same photos again.
        generated = await generateWithAI(form, language, platform, content, selectedInspirationIds)
      } catch (error) {
        console.warn('[captivibe] AI regeneration unavailable; using local generator', error instanceof AIRequestError ? error.code : 'unknown')
        generated = { ...generateContent(form, nextVariant), generationSource: 'local' }
        usedFallback = true
      }
      rememberForUndo(content)
      setVariant(nextVariant)
      setContent(generated)
      setSelectedCaptionIndex(0)
      setSelectedHeadlineIndex(0)
      setSelectedHashtags(generated.hashtags)
      if (usedFallback) notify({ key: 'notice.aiFallback', tone: 'error' })
      else notifyGenerateReady()
    } catch (error) {
      console.error('[captivibe] regeneration failed', error)
      notifyGenerateFailed()
    } finally {
      regeneratingAllRef.current = false
      setGenerating(false)
    }
  }

  async function handleRegenerateItem(kind: 'caption' | 'headline', index: number) {
    if (!content || generating) return
    const key = `${kind}-${index}`
    if (regeneratingItemRef.current.has(key)) return
    regeneratingItemRef.current.add(key)
    setRegeneratingItems((current) => ({ ...current, [key]: true }))
    try {
      let nextContent: GeneratedContent
      let usedFallback = false
      try {
        const result = await regenerateWithAI(form, content, kind, index, language, platform, selectedInspirationIds)
        if (kind === 'caption') {
          const captions = [...content.captions]
          const captionMeta = [...(content.captionMeta ?? Array(content.captions.length).fill(null))]
          captions[index] = result.text
          captionMeta[index] = result.meta
          nextContent = { ...content, captions, captionMeta }
        } else {
          const headlines = [...content.headlines]
          const headlineMeta = [...(content.headlineMeta ?? Array(content.headlines.length).fill(null))]
          headlines[index] = result.text
          headlineMeta[index] = result.meta
          nextContent = { ...content, headlines, headlineMeta }
        }
      } catch (error) {
        console.warn('[captivibe] single-item AI regeneration unavailable; using local generator', error instanceof AIRequestError ? error.code : 'unknown')
        usedFallback = true
        if (kind === 'caption') {
          const captions = [...content.captions]
          const captionMeta = [...(content.captionMeta ?? Array(content.captions.length).fill(null))]
          captions[index] = regenerateCaption(form, captions[index], captions.filter((_, item) => item !== index))
          captionMeta[index] = null
          nextContent = { ...content, captions, captionMeta, generationSource: 'local' }
        } else {
          const headlines = [...content.headlines]
          const headlineMeta = [...(content.headlineMeta ?? Array(content.headlines.length).fill(null))]
          headlines[index] = regenerateHeadline(form, headlines[index], headlines.filter((_, item) => item !== index))
          headlineMeta[index] = null
          nextContent = { ...content, headlines, headlineMeta, generationSource: 'local' }
        }
      }
      rememberForUndo(content)
      setContent(nextContent)
      if (usedFallback) notify({ key: 'notice.aiFallback', tone: 'error' })
    } catch (error) {
      console.error('[captivibe] item regeneration failed', error)
      notifyGenerateFailed()
    } finally {
      regeneratingItemRef.current.delete(key)
      setRegeneratingItems((current) => ({ ...current, [key]: false }))
    }
  }

  function handleRegenerateCaption(index: number) {
    return handleRegenerateItem('caption', index)
  }

  function handleRegenerateHeadline(index: number) {
    return handleRegenerateItem('headline', index)
  }

  /** Hand-edited caption. Selecting the edited card keeps the mockups in step with the typing. */
  function handleCaptionChange(index: number, value: string) {
    setContent((current) => {
      if (!current) return current
      const captions = [...current.captions]
      const captionMeta = [...(current.captionMeta ?? Array(current.captions.length).fill(null))]
      captions[index] = value
      captionMeta[index] = null
      return { ...current, captions, captionMeta }
    })
    setSelectedCaptionIndex(index)
  }

  /** Hand-edited headline. As with captions, the edited card becomes the one the mockups show. */
  function handleHeadlineChange(index: number, value: string) {
    setContent((current) => {
      if (!current) return current
      const headlines = [...current.headlines]
      const headlineMeta = [...(current.headlineMeta ?? Array(current.headlines.length).fill(null))]
      headlines[index] = value
      headlineMeta[index] = null
      return { ...current, headlines, headlineMeta }
    })
    setSelectedHeadlineIndex(index)
  }

  /** Restores every card exactly as it read before the last regeneration. */
  function handleUndo() {
    if (!previousContent) return
    setContent((current) =>
      current
        ? {
            captions: [...previousContent.previousCaptions],
            headlines: [...previousContent.previousHeadlines],
            hashtags: [...previousContent.previousHashtags],
            captionMeta: previousContent.previousCaptionMeta ? [...previousContent.previousCaptionMeta] : undefined,
            headlineMeta: previousContent.previousHeadlineMeta ? [...previousContent.previousHeadlineMeta] : undefined,
            imageInsights: previousContent.previousImageInsights ? [...previousContent.previousImageInsights] : undefined,
            generationSource: previousContent.previousGenerationSource,
          }
        : current,
    )
    // The restored set becomes the active one again, so the preview and score follow the rollback.
    setSelectedHashtags([...previousContent.previousHashtags])
  }

  /** Restores one card, leaving the rest of the last regeneration in place. */
  function handleUndoCaption(index: number) {
    if (!previousContent) return
    const restored = previousContent.previousCaptions[index]
    setContent((current) => {
      if (!current || restored === undefined) return current
      const captions = [...current.captions]
      const captionMeta = [...(current.captionMeta ?? Array(current.captions.length).fill(null))]
      captions[index] = restored
      captionMeta[index] = previousContent.previousCaptionMeta?.[index] ?? null
      return { ...current, captions, captionMeta }
    })
  }

  function handleUndoHeadline(index: number) {
    if (!previousContent) return
    const restored = previousContent.previousHeadlines[index]
    setContent((current) => {
      if (!current || restored === undefined) return current
      const headlines = [...current.headlines]
      const headlineMeta = [...(current.headlineMeta ?? Array(current.headlines.length).fill(null))]
      headlines[index] = restored
      headlineMeta[index] = previousContent.previousHeadlineMeta?.[index] ?? null
      return { ...current, headlines, headlineMeta }
    })
  }

  /** Switches one hashtag on or off — the selected set drives the mockups and the audit score. */
  function toggleHashtag(tag: string) {
    setSelectedHashtags((current) =>
      current.includes(tag) ? current.filter((entry) => entry !== tag) : [...current, tag],
    )
  }

  /** Switches the whole generated set on in one move. */
  function selectAllHashtags(allTags: string[]) {
    setSelectedHashtags([...allTags])
  }

  /** Switches every hashtag off — the "clean post, no tags" state. */
  function clearAllHashtags() {
    setSelectedHashtags([])
  }

  return (
    /* One document-level workspace flow at every breakpoint. Inputs and Results are tabs, so the
       page owns vertical scrolling instead of nesting independent desktop/mobile panel scrollers. */
    <div className="app-shell flex min-h-[100svh] flex-col">
      <Header
        theme={theme}
        onToggleTheme={toggle}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenPreview={() => setPreviewStudioOpen(true)}
        historyCount={items.length}
        onOpenContribution={() => setContributionOpen(true)}
      />
      <CommunityContributionDialog open={contributionOpen} onClose={() => setContributionOpen(false)} />

      <main ref={workspaceRef} className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-3 pb-8 pt-4 sm:gap-6 sm:px-6 sm:pt-6">
        <WorkspaceTabs
          value={workspaceTab}
          onChange={setWorkspaceTab}
          hasResults={Boolean(content)}
        />

        {workspaceTab === 'inputs' ? (
          <div id="workspace-panel-inputs" role="tabpanel" aria-labelledby="workspace-tab-inputs" className="w-full">
            <ControlPanel
              form={form}
              errors={errors}
              errorSummaryId={errorSummaryId}
              generating={generating}
              selectedInspirationIds={selectedInspirationIds}
              onInspirationChange={setSelectedInspirationIds}
              platform={platform}
              onFieldChange={updateField}
              onImages={handleImages}
              onRemoveImage={removeImage}
              onReorderImages={reorderImages}
              onClearImages={clearImages}
              imageProblems={imageProblems}
              onSubmit={handleSubmit}
            />
          </div>
        ) : (
          <div id="workspace-panel-results" role="tabpanel" aria-labelledby="workspace-tab-results" className="w-full">
            <ResultsPanel
              onOpenPreview={() => setPreviewStudioOpen(true)}
              content={content}
              generating={generating}
              regeneratingItems={regeneratingItems}
              onRegenerate={handleRegenerate}
              onRegenerateCaption={handleRegenerateCaption}
              onRegenerateHeadline={handleRegenerateHeadline}
              onCaptionChange={handleCaptionChange}
              onHeadlineChange={handleHeadlineChange}
              previousContent={previousContent}
              onUndo={handleUndo}
              onUndoCaption={handleUndoCaption}
              onUndoHeadline={handleUndoHeadline}
              selectedCaptionIndex={selectedCaptionIndex}
              onSelectedCaptionChange={setSelectedCaptionIndex}
              selectedHeadlineIndex={selectedHeadlineIndex}
              onSelectedHeadlineChange={setSelectedHeadlineIndex}
              selectedHashtags={selectedHashtags}
              onToggleHashtag={toggleHashtag}
              onSelectAllHashtags={selectAllHashtags}
              onClearHashtags={clearAllHashtags}
              platform={platform}
            />
          </div>
        )}
      </main>

      <PreviewStudio
        open={previewStudioOpen}
        onClose={closePreviewStudio}
        form={form}
        headline={content?.headlines[selectedHeadlineIndex] ?? content?.headlines[0] ?? ''}
        caption={content?.captions[selectedCaptionIndex] ?? content?.captions[0] ?? ''}
        hashtags={selectedHashtags}
        platform={platform}
        onPlatformChange={setPlatform}
        device={device}
        onDeviceChange={setDevice}
        totalLength={[
          content?.headlines[selectedHeadlineIndex] ?? content?.headlines[0] ?? '',
          content?.captions[selectedCaptionIndex] ?? content?.captions[0] ?? '',
          selectedHashtags.join(' '),
        ].filter(Boolean).join('\n\n').length}
      />
      <HistoryDrawer
        open={historyOpen}
        items={items}
        saveState={saveState}
        unmigratedImages={unmigratedImages}
        onClose={() => setHistoryOpen(false)}
        onDelete={removeItem}
        onClear={clearAll}
        onRestore={(item) => {
          // Rebuilding the gallery reads Blobs from IndexedDB, so the restore is asynchronous.
          void restoreHistory(item)
        }}
      />
      <NoticeStack notices={notices} onDismiss={dismiss} />
    </div>
  )
}
