import {
  BatteryFull,
  Bell,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Facebook,
  Forward,
  Globe,
  Heart,
  Home,
  Inbox,
  Instagram,
  Maximize,
  Menu,
  MessageCircle,
  Monitor,
  MoreHorizontal,
  Music2,
  Plus,
  Search,
  Send,
  Share2,
  Signal,
  Smile,
  Smartphone,
  ThumbsUp,
  Tv,
  User,
  Users,
  Wifi,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { PreviewDevice, PreviewPlatform, ProductForm } from '../types'
import type { TranslationKey } from '../lib/i18n'
import { useLanguage } from '../hooks/useLanguage'

const PLATFORMS: { id: PreviewPlatform; icon: LucideIcon }[] = [
  { id: 'instagram', icon: Instagram },
  { id: 'tiktok', icon: Music2 },
  { id: 'facebook', icon: Facebook },
]

/** Address-bar hosts used by the desktop (browser) preview. */
const PLATFORM_HOST: Record<PreviewPlatform, string> = {
  instagram: 'www.instagram.com',
  tiktok: 'www.tiktok.com',
  facebook: 'www.facebook.com',
}

/**
 * Preview-only engagement figures. The generator has no backend, so every
 * mockup reads its numbers from this one constant instead of scattering
 * literals through the JSX.
 */
const MOCK_STATS = {
  instagramLikes: '1,284',
  instagramComments: '36',
  tiktokLikes: '128.4K',
  tiktokComments: '2,130',
  tiktokSaves: '8,902',
  tiktokShares: '1,204',
  facebookReactions: '1.2K',
  facebookComments: '86',
  facebookShares: '24',
}

/** Sample comments rendered in the desktop sidebars — the body copy is localised. */
const TIKTOK_IMAGE_OBJECT_POSITION = '50% 30%'

const PREVIEW_COMMENTS: { handle: string; text: TranslationKey }[] = [
  { handle: 'linh.makes', text: 'preview.commentSample1' },
  { handle: 'dan.studio', text: 'preview.commentSample2' },
  { handle: 'mira.beauty', text: 'preview.commentSample3' },
]

interface PhonePreviewProps {
  form: ProductForm
  /**
   * The active headline. The preview renders it as a distinct, emphasized opening line above the body.
   */
  headline: string
  caption: string
  hashtags: string[]
  /** Product visuals — data URLs or remote URLs. Falls back to a placeholder when empty. */
  images: string[]
  platform: PreviewPlatform
  device: PreviewDevice
}

/** Below this width it is the *browser* that is a phone, whatever device the user picked. */
const PHONE_VIEWPORT_QUERY = '(max-width: 639px)'

/**
 * Whether the browser itself is running in a phone-sized viewport.
 *
 * This is deliberately separate from the `device` the user chose for the preview: a desktop visitor
 * asking for the phone mockup and a phone visitor asking for the desktop mockup are both legitimate.
 * Real phones use edge-to-edge shells for Facebook and Instagram, while TikTok keeps its handset
 * chrome. The selected preview device and the actual viewport remain separate signals.
 */
function useIsPhoneViewport() {
  const [isPhone, setIsPhone] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(PHONE_VIEWPORT_QUERY).matches,
  )

  useEffect(() => {
    const query = window.matchMedia(PHONE_VIEWPORT_QUERY)
    const sync = () => setIsPhone(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return isPhone
}

/**
 * The preview column's controls: the platform switcher and the device toggle. They render as plain
 * siblings so the panel's single toolbar row can lay the mode pills, this switcher and the device
 * toggle out with one `justify-between`, without a wrapper box in between.
 */
export function PreviewControls({
  platform,
  onPlatformChange,
  device,
  onDeviceChange,
}: {
  platform: PreviewPlatform
  onPlatformChange: (platform: PreviewPlatform) => void
  device: PreviewDevice
  onDeviceChange: (device: PreviewDevice) => void
}) {
  const { t } = useLanguage()

  return (
    <>
      <PlatformMenu platform={platform} onPlatformChange={onPlatformChange} />

      {/* The Phone / PC choice is a property of the mockup, not of the device in the user's hand: a
          phone visitor asking for the desktop layout is a legitimate request, so the toggle stays
          on every viewport instead of being gated on the browser's own width. */}
      <div
        role="group"
        aria-label={t('preview.deviceLabel')}
        className="flex h-9 shrink-0 items-center gap-0.5 rounded-xl border border-border/60 bg-muted/50 p-0.5 shadow-sm"
      >
        <DeviceButton
          device="mobile"
          current={device}
          label={t('preview.deviceMobile')}
          icon={Smartphone}
          onSelect={onDeviceChange}
        />
        <DeviceButton
          device="desktop"
          current={device}
          label={t('preview.deviceDesktop')}
          icon={Monitor}
          onSelect={onDeviceChange}
        />
      </div>
    </>
  )
}

/**
 * Compact platform switcher — one trigger showing the active network instead of three buttons.
 * The menu mirrors the per-card action menus: `aria-haspopup`, outside-click and Escape to close.
 */
function PlatformMenu({
  platform,
  onPlatformChange,
}: {
  platform: PreviewPlatform
  onPlatformChange: (platform: PreviewPlatform) => void
}) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const label = t('preview.platformLabel')
  const active = PLATFORMS.find((item) => item.id === platform) ?? PLATFORMS[0]
  const ActiveIcon = active.icon

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  /* The dropdown hangs off the *toolbar*, not off this 54px trigger, at every width below `sm`.
     At 320px the trigger is icon-only, so the strip wraps and the trigger ends up flush against the
     panel's left edge — a `right-0` menu anchored to it would then extend ~78px past the left edge
     of the viewport, and LTR pages cannot scroll leftwards, so that half of the menu was simply
     unreachable. Anchored to the toolbar the menu is always inside the panel. From `sm` up the strip
     never wraps and the trigger is the better anchor, so the wrapper becomes `relative` again. */
  return (
    <div ref={containerRef} className="shrink-0 sm:relative" data-platform-menu>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={`inline-flex h-9 cursor-pointer select-none items-center gap-1.5 rounded-xl border px-2.5 text-xs font-semibold leading-normal shadow-sm transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3.5 ${
          open
            ? 'border-primary/50 bg-primary/10 text-primary'
            : 'border-border/60 bg-muted/50 text-foreground hover:bg-muted'
        }`}
      >
        <ActiveIcon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">{t(`preview.platformShort.${platform}`)}</span>
        <ChevronDown
          className={`size-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute top-full left-0 right-auto z-[70] mt-2 max-h-[min(18rem,calc(100svh-7rem))] w-44 max-w-[calc(100vw-1.5rem)] translate-x-0 overflow-y-auto overscroll-contain rounded-xl border border-border bg-card p-1.5 shadow-xl sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
        >
          {PLATFORMS.map((item) => {
            const Icon = item.icon
            const selected = item.id === platform
            return (
              <button
                key={item.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  onPlatformChange(item.id)
                  setOpen(false)
                }}
                className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left text-xs font-semibold leading-normal text-foreground transition duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{t(`preview.platformShort.${item.id}`)}</span>
                {selected && <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function PhonePreview({
  form,
  headline,
  caption,
  hashtags,
  images,
  platform,
  device,
}: PhonePreviewProps) {
  const { t } = useLanguage()
  const clock = useLiveClock()
  const isPhoneViewport = useIsPhoneViewport()
  /** The phone's own scroller — Instagram mobile uses it to reveal expanded captions. */
  const screenScrollerRef = useRef<HTMLDivElement>(null)

  /* A visual can arrive as a Base64 data URL (uploads, restored history) or a remote URL, and a row
     saved by an older version can carry an empty slot. Blank entries are dropped up front: each
     mockup then only has to render a real source, and the blank has no chance to reach a slice() or
     an <img> and break the frame. */
  const safeImages = images.filter((src) => Boolean(src))

  const brand = form.productName.trim() || 'CaptiVibe'
  /* Keep the typed product name verbatim — casing, spaces and Vietnamese accents included. */
  const handle = brand
  /* Keep the hook as its own visual element, while body and tags share one truncation budget.
     This emphasizes the headline in previews without adding markup to copied post text. */
  const trimmedHeadline = headline.trim()
  const trimmedCaption = caption.trim()
  const trimmedTags = hashtags.slice(0, 5).join(' ').trim()
  const postText = [trimmedCaption, trimmedTags].filter(Boolean).join('\n\n') ||
    (trimmedHeadline ? '' : t('preview.placeholder'))
  const dark = platform === 'tiktok'

  /* The three platform screens, composed once so the framed and the frameless shell render the exact
     same post. Keeping them in one place is what preserves the theme isolation: each screen keeps its
     own hard-coded palette no matter which shell happens to host it. */
  const screen = (
    <>
      {platform === 'instagram' && (
        <InstagramScreen
          brand={brand}
          handle={handle}
          headline={trimmedHeadline}
          caption={postText}
          images={safeImages}
          sponsored={t('preview.sponsored')}
          likes={t('preview.likes', { count: '1,284' })}
          comments={t('preview.viewAllComments', { count: '36' })}
          like={t('preview.like')}
          comment={t('preview.comment')}
          share={t('preview.share')}
          dropImage={t('preview.dropImage')}
          scrollRootRef={screenScrollerRef}
          phoneViewport={isPhoneViewport}
        />
      )}

      {platform === 'tiktok' && (
        <TikTokScreen
          handle={handle}
          headline={trimmedHeadline}
          caption={postText}
          images={safeImages}
          music={t('preview.music')}
          dropImage={t('preview.dropImage')}
        />
      )}

      {platform === 'facebook' && (
        <FacebookScreen
          brand={brand}
          headline={trimmedHeadline}
          caption={postText}
          images={safeImages}
          sponsored={t('preview.sponsored')}
          likes={t('preview.likes', { count: '1.2K' })}
          like={t('preview.like')}
          comment={t('preview.comment')}
          share={t('preview.share')}
          dropImage={t('preview.dropImage')}
        />
      )}
    </>
  )

  /* The surface the screen sits on — shared by both shells so the post never changes background. */
  const screenBackground =
    platform === 'tiktok' ? 'bg-slate-950' : platform === 'facebook' ? 'bg-[#f0f2f5]' : 'bg-white'

  /* Facebook and Instagram use edge-to-edge previews on real phones. TikTok uses the same
     standard handset frame as the other mobile-device mockups, so its full-screen player keeps
     the same device context as the PC preview. On a real phone, TikTok gets a taller frame that
     uses nearly all the vertical space available below the Preview Studio toolbar. */
  const frameless = isPhoneViewport && device === 'mobile' && platform !== 'tiktok'
  const isTikTokOnRealPhone = isPhoneViewport && device === 'mobile' && platform === 'tiktok'
  const phoneMobileMaxHeight = isTikTokOnRealPhone
    ? PHONE_FRAME_MAX_HEIGHT_TIKTOK
    : PHONE_FRAME_MAX_HEIGHT

  return (
    <div className="relative z-0 isolate flex h-full min-h-0 w-full min-w-0 flex-col items-center pt-0 pb-0">
      {/* The preview body owns the full canvas; character-limit feedback lives in Preview Studio's toolbar. */}
      <div className="custom-scrollbar flex min-h-0 w-full min-w-0 flex-1 flex-col items-center overflow-y-auto overscroll-contain">
        {frameless ? (
          /* Facebook and Instagram use an edge-to-edge social canvas on real phones. TikTok uses
             the standard handset branch below to retain its familiar device frame. */
          <div
            data-preview-shell="frameless"
            className={`preview-fluid-container relative mx-auto flex min-h-0 w-full max-w-[560px] flex-1 flex-col overflow-hidden rounded-2xl ring-1 ring-slate-900/10 dark:ring-white/10 ${screenBackground}`}
          >
            <div
              ref={screenScrollerRef}
              className="scrollbar-width-none relative min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y"
            >
              {screen}
            </div>
          </div>
        ) : device === 'mobile' ? (
          <div className={`flex min-h-0 w-full min-w-0 flex-1 items-center justify-center overflow-visible pt-0 ${
            isTikTokOnRealPhone ? 'px-2 pb-1' : 'px-4 pb-2'
          }`}>
            {/* The standard handset frame is shared by every platform. TikTok on a real phone
                receives a smaller vertical reserve so the device fills more of the Preview Studio,
                while the 9:18.5 ratio and viewport-width constraint keep it from spilling sideways. */}
            <div
              data-preview-shell="handset"
              style={{
                '--phone-height-mobile': isTikTokOnRealPhone
                  ? `min(${phoneMobileMaxHeight}px, calc(100svh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 57px))`
                  : `min(${phoneMobileMaxHeight}px, calc(100svh - ${PHONE_FRAME_RESERVE_SM}px))`,
                '--phone-height-pc': `min(${PHONE_FRAME_MAX_HEIGHT_PC}px, calc(100svh - ${PHONE_FRAME_RESERVE_PC}px))`,
              } as React.CSSProperties}
              data-preview-frame="standard"
              className="relative mx-auto flex h-[var(--phone-height-mobile)] lg:h-[var(--phone-height-pc)] aspect-[9/18.5] max-w-[calc(100vw-1rem)] shrink-0 flex-col overflow-hidden rounded-[40px] border-[9px] border-slate-900 bg-slate-950 shadow-2xl shadow-black/20 transition-all duration-150"
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[31px] bg-slate-950">
                <div className={`preview-fluid-container relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[31px] ${screenBackground}`}>
                  {/* Status bar stays put — the app screen below it owns the scrolling. */}
                  <StatusBar clock={clock} platform={platform} />

                  <div
                    ref={screenScrollerRef}
                    className="scrollbar-width-none relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
                  >
                    {screen}
                  </div>

                  {/* Dynamic Island */}
                  <div
                    data-testid="preview-dynamic-island"
                    className="pointer-events-none absolute left-1/2 top-[1.3%] z-30 flex aspect-[3.5/1] w-[25%] max-w-[96px] -translate-x-1/2 items-center justify-end rounded-full bg-black pr-[3.6%] ring-1 ring-white/5"
                    aria-hidden="true"
                  >
                   <span className="aspect-square w-[9%] rounded-full bg-slate-800/90" />
                  </div>

                  {/* System safe area — reserves the home indicator strip so no content hides behind
                      it. TikTok's dark nav (with its own bottom padding) only needs a shallow strip,
                      which lets the navigation sit right above the Home Indicator instead of
                      floating. */}
                  <div
                    className={`pointer-events-none relative z-30 flex shrink-0 items-center justify-center ${
                      dark ? 'h-3' : 'h-6'
                    }`}
                    aria-hidden="true"
                  >
                    <span className={`h-1.5 w-28 rounded-full ${dark ? 'bg-white/60' : 'bg-slate-900/45'}`} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* The PC preview keeps its natural desktop structure; below `lg` the whole shell is scaled
             down to the measured width so the landscape layout survives intact on a phone. Only the
             column's own padding separates the window from the toolbar above it. */
          <div className="flex w-full min-w-0 flex-1 flex-col items-center justify-center">
            <BrowserPreview
              platform={platform}
              host={PLATFORM_HOST[platform]}
              brand={brand}
              handle={handle}
              headline={trimmedHeadline}
              caption={postText}
              images={safeImages}
              likes={t('preview.likes', { count: platform === 'facebook' ? '1.2K' : '1,284' })}
              dropImage={t('preview.dropImage')}
            />
          </div>
        )}
      </div>

    </div>
  )
}

function useLiveClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 20_000)
    return () => window.clearInterval(id)
  }, [])

  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

/**
 * Tracks the active slide for a gallery and keeps it in range when the image
 * count shrinks (e.g. the user removes a photo).
 */
function useSlideIndex(count: number) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex((current) => (current >= count ? 0 : current))
  }, [count])

  const active = count > 0 ? Math.min(index, count - 1) : 0
  const go = (delta: number) => {
    if (count < 1) return
    setIndex((current) => (current + delta + count) % count)
  }

  return { active, go }
}

/**
 * The intrinsic aspect ratio (width ÷ height) of every picture in a gallery, keyed by source.
 *
 * Instagram's mobile media area is sized by the photo itself rather than by a fixed frame, so the
 * ratio has to come from the decoded image instead of from the markup. A picture the browser has
 * already cached resolves through the callback ref, which fires the moment the element is attached;
 * everything else reports through `onLoad`. Sources that have left the gallery are simply never
 * asked for again, so the record stays as small as the gallery is.
 */
function useImageRatios() {
  const [ratios, setRatios] = useState<Record<string, number>>({})

  const measure = useCallback((src: string, element: HTMLImageElement | null) => {
    if (!element?.complete || !element.naturalWidth || !element.naturalHeight) return

    const ratio = element.naturalWidth / element.naturalHeight
    setRatios((prev) => (prev[src] === ratio ? prev : { ...prev, [src]: ratio }))
  }, [])

  return { ratios, measure }
}

/** Characters a collapsed caption shows before the expand trigger appears. Phones read less. */
const MOBILE_CAPTION_LIMIT = 110
const DESKTOP_CAPTION_LIMIT = 160

/**
 * Cut on a word boundary so the collapsed copy never ends mid-word. A long unbroken run — a URL,
 * one very long hashtag — has no space to rewind to, so it is cut where it stands.
 */
function truncateAtWord(text: string, limit: number) {
  if (text.length <= limit) return text
  const sliced = text.slice(0, limit)
  const lastSpace = sliced.lastIndexOf(' ')
  const cut = lastSpace > limit * 0.6 ? sliced.slice(0, lastSpace) : sliced
  return cut.replace(/[\s,.;:!?…-]+$/, '')
}

/**
 * Hashtags are coloured links on both Facebook and Instagram, so the post text is split on `#tag`
 * tokens and each one is wrapped in its own span. Splitting the string — rather than assembling a
 * styled node next to it — keeps the whole post as one plain string, which is what lets a single
 * character budget govern the truncation instead of one budget per segment.
 */
function withTagColor(text: string, tagClassName?: string) {
  if (!tagClassName) return text
  return text.split(/(#[\p{L}\p{N}_]+)/gu).map((part, position) => {
    if (part.startsWith('#') && part.length > 1) {
      return (
        <span key={position} className={tagClassName}>
          {part}
        </span>
      )
    }
    return part
  })
}

/**
 * Caption body with a character budget and an inline "… Xem thêm" trigger. The budget replaces the
 * earlier `line-clamp` overlay: `line-clamp` clips through `overflow: hidden`, which forced the
 * trigger to be absolutely positioned over the last line — the source of the collisions and the
 * missing space before it. Measuring plain characters keeps the trigger in the text flow, so the
 * separator and the spacing are structural rather than painted over.
 *
 * `scrollOnExpand` is opt-in: only Instagram mobile asks for it, where the newly revealed text must
 * be brought into view *inside the phone's own scroller* — never by scrolling the surrounding page.
 */
function TruncatedCaption({
  caption,
  threshold,
  className = '',
  buttonClassName = '',
  moreLabel,
  prefix,
  prefixClassName = '',
  headline = '',
  tagClassName,
  scrollOnExpand = false,
  scrollRootRef,
}: {
  caption: string
  /** Characters shown before the collapsed trigger appears. */
  threshold: number
  className?: string
  buttonClassName?: string
  /** Short native label (e.g. TikTok's "Thêm"); falls back to the generic "Read more". */
  moreLabel?: string
  prefix?: string
  prefixClassName?: string
  /** Opening hook, visually separated from the caption body. */
  headline?: string
  /** Link colour for `#hashtags` inside the post. Omitted where the platform does not tint them. */
  tagClassName?: string
  /** Scroll the expanded text into view within `scrollRootRef`. Opt-in per platform. */
  scrollOnExpand?: boolean
  scrollRootRef?: RefObject<HTMLElement | null>
}) {
  const { t } = useLanguage()
  const [expanded, setExpanded] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const prefixText = prefix ? `${prefix} ` : ''
  const headlineText = headline.trim()
  const headlineSeparatorLength = headlineText && caption ? 1 : 0
  /* Measure the entire visible post even though the hook and body are rendered as separate nodes. */
  const leadingTextLength = prefixText.length + headlineText.length + headlineSeparatorLength
  const overflowing = leadingTextLength + caption.length > threshold
  /* Reserve room for the emphasized hook and the inline read-more trigger before trimming the body. */
  const collapsedCaption = overflowing
    ? truncateAtWord(caption, Math.max(24, threshold - leadingTextLength - 8))
    : caption

  useEffect(() => {
    if (!expanded || !scrollOnExpand) return
    const scroller = scrollRootRef?.current
    const block = buttonRef.current ?? textRef.current
    if (!block || !scroller) return

    // Nudge the phone's inner scroller just enough to reveal the expanded block.
    const hidden = block.getBoundingClientRect().bottom - scroller.getBoundingClientRect().bottom + 12
    if (hidden <= 0) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    scroller.scrollTo({ top: scroller.scrollTop + hidden, behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [expanded, scrollOnExpand, scrollRootRef])

  return (
    <p
      ref={textRef}
      /* Preserve the caption's paragraph and benefit-line breaks. The headline is a separate node. */
      className={`whitespace-pre-line ${className}`}
    >
      {prefix && <span className={prefixClassName}>{prefix} </span>}
      {headlineText && (
        <strong className={prefix ? 'font-extrabold text-[1.05em] tracking-tight' : 'mb-1 block text-[1.08em] font-extrabold leading-snug tracking-tight'}>
          {headlineText}
        </strong>
      )}
      {headlineText && caption && <br />}
      {withTagColor(expanded ? caption : collapsedCaption, tagClassName)}
      {overflowing && (
        <>
          {/* Outside the button so the marks are never clickable, and always followed by a space. */}
          {!expanded && '... '}
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className={`inline-block cursor-pointer text-[11px] leading-normal transition duration-200 focus:outline-none focus-visible:underline ${
              expanded ? 'ml-2' : 'ml-1'
            } ${buttonClassName}`}
          >
            {expanded ? t('preview.readLess') : moreLabel ?? t('preview.readMore')}
          </button>
        </>
      )}
    </p>
  )
}

function DeviceButton({
  device,
  current,
  label,
  icon: Icon,
  onSelect,
}: {
  device: PreviewDevice
  current: PreviewDevice
  label: string
  icon: LucideIcon
  onSelect: (device: PreviewDevice) => void
}) {
  const selected = current === device
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      title={label}
      onClick={() => onSelect(device)}
      className={`inline-flex h-full cursor-pointer select-none items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold leading-normal transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3.5 ${
        selected
          ? 'bg-primary text-on-primary shadow-sm'
          : 'text-muted-foreground hover:bg-card hover:text-foreground'
      }`}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function StatusBar({ clock, platform }: { clock: string; platform: PreviewPlatform }) {
  const tiktok = platform === 'tiktok'

  return (
    <div
      className={`relative z-20 flex shrink-0 items-center justify-between px-6 pb-2 pt-3 text-[11px] font-bold ${
        tiktok ? 'bg-black text-white' : 'bg-white text-slate-900'
      }`}
    >
      <span className="tabular-nums">{clock}</span>
      <span className="flex items-center gap-1.5" aria-hidden="true">
        <Signal className="size-3.5" />
        <Wifi className="size-3.5" />
        <BatteryFull className="size-4" />
      </span>
    </div>
  )
}

/**
 * Platform-agnostic avatar. Uses a fixed palette on purpose: the mockups must
 * not shift when the CaptiVibe theme switches to dark mode.
 */
function Avatar({ brand, className = 'size-8' }: { brand: string; className?: string }) {
  return (
    <span
      className={`flex ${className} shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-500 to-slate-700 text-[11px] font-bold text-white`}
    >
      {brand.slice(0, 1).toUpperCase()}
    </span>
  )
}

interface ScreenProps {
  /** The separately emphasized opening line. */
  headline: string
  /** Caption body and hashtags, sharing one character budget for truncation. */
  caption: string
  images: string[]
  dropImage: string
}

function ImageCountBadge({ index, total, className = '' }: { index: number; total: number; className?: string }) {
  const { t } = useLanguage()
  return (
    <span
      className={`absolute right-2.5 top-2.5 z-20 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white ${className}`}
      aria-label={t('preview.imageOf', { index: index + 1, total })}
    >
      {index + 1}/{total}
    </span>
  )
}

function GalleryArrow({
  direction,
  label,
  onClick,
  alwaysVisible = false,
  className = '',
}: {
  direction: 'left' | 'right'
  label: string
  onClick: () => void
  /** Keep controls visible on touch-first previews where hover does not exist. */
  alwaysVisible?: boolean
  /** Optional position override for galleries with a side action rail. */
  className?: string
}) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 z-30 flex -translate-y-1/2 cursor-pointer select-none items-center justify-center rounded-full shadow-sm transition duration-200 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none ${
        alwaysVisible
          ? 'size-9 bg-black/55 text-white opacity-90 ring-1 ring-white/30 hover:bg-black/75 hover:opacity-100 sm:size-8'
          : 'size-7 bg-white/90 text-slate-900 opacity-0 ring-1 ring-slate-900/10 group-hover:opacity-100 hover:bg-white'
      } ${className || (direction === 'left' ? 'left-2' : 'right-2')}`}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  )
}

function InstagramScreen({
  brand,
  handle,
  headline,
  caption,
  images,
  sponsored,
  likes,
  comments,
  like,
  comment,
  share,
  dropImage,
  scrollRootRef,
  phoneViewport,
}: ScreenProps & {
  brand: string
  handle: string
  sponsored: string
  likes: string
  comments: string
  like: string
  comment: string
  share: string
  /** The phone's inner scroller, so "read more" can reveal the text without touching the page. */
  scrollRootRef: RefObject<HTMLDivElement | null>
  /** Real phone viewport: use swipe-only gallery controls instead of visible arrows. */
  phoneViewport: boolean
}) {
  const { t } = useLanguage()
  const count = images.length
  const { active, go } = useSlideIndex(count)
  const { ratios, measure } = useImageRatios()
  const pointerStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null)

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (count < 2 || (event.pointerType === 'mouse' && event.button !== 0)) return
    if (event.target instanceof Element && event.target.closest('button')) return

    pointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture is unavailable in some test/browser environments.
    }
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current
    pointerStartRef.current = null
    if (!start || start.pointerId !== event.pointerId) return

    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    if (Math.abs(deltaX) < 36 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return

    go(deltaX < 0 ? 1 : -1)
  }

  const handlePointerCancel = () => {
    pointerStartRef.current = null
  }

  /**
   * The media area takes the photo's own shape rather than a fixed feed frame, so the picture runs
   * edge to edge with no leftover band above, below or beside it. Until the browser reports the real
   * ratio the frame falls back to Instagram's 4:5 default, which is what a post looks like before
   * its image has decoded.
   */
  const activeRatio = (images[active] ? ratios[images[active]] : undefined) ?? 4 / 5

  return (
    /* `min-h-full` lets the post grow past the viewport so the scroller can take over. */
    <div className="flex min-h-full w-full flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between px-3.5 pb-2 pt-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-full bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 p-[2px]">
            <span className="block rounded-full bg-white p-[2px]">
              <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-500 to-slate-700 text-[11px] font-bold text-white">
                {brand.slice(0, 1).toUpperCase()}
              </span>
            </span>
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold leading-tight text-slate-900">{handle}</p>
            <p className="truncate text-[10px] text-slate-500">
              {sponsored} · Instagram
            </p>
          </div>
        </div>
        <MoreHorizontal className="size-4 text-slate-500" aria-hidden="true" />
      </div>

      {/* Media area — the frame is driven by the photo's ratio, and the photo fills it exactly, so
          nothing is cropped and no empty band is ever left over. */}
      <div
        data-testid="instagram-media"
        className="group relative w-full shrink-0 select-none overflow-hidden bg-black/5 touch-pan-y sm:cursor-grab sm:active:cursor-grabbing"
        style={{ aspectRatio: `${activeRatio}` }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onDragStart={(event) => event.preventDefault()}
      >
        {count > 0 ? (
          <>
            <div
              className="absolute inset-0 flex transition-transform duration-300 ease-out motion-reduce:transition-none"
              style={{ transform: `translateX(-${active * 100}%)` }}
            >
              {images.map((src, index) => (
                <img
                  key={`${src.slice(0, 24)}-${index}`}
                  ref={(element) => measure(src, element)}
                  src={src}
                  alt=""
                  draggable={false}
                  onLoad={(event) => measure(src, event.currentTarget)}
                  className="h-full w-full shrink-0 object-contain object-center"
                />
              ))}
            </div>

            <ImageCountBadge index={active} total={count} />

            {count > 1 && (
              <>
                {!phoneViewport && (
                  <>
                    <GalleryArrow direction="left" label={t('preview.prevImage')} onClick={() => go(-1)} />
                    <GalleryArrow direction="right" label={t('preview.nextImage')} onClick={() => go(1)} />
                  </>
                )}
                <div className="absolute inset-x-0 bottom-2.5 z-20 flex items-center justify-center gap-1.5">
                  {images.map((_, index) => (
                    <span
                      key={`dot-${index}`}
                      className={`h-1.5 rounded-full transition-all duration-200 motion-reduce:transition-none ${
                        index === active
                          ? 'w-4 bg-gradient-to-r from-blue-500 to-fuchsia-500'
                          : 'w-1.5 bg-white/75'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-100 via-slate-50 to-orange-100 px-8 text-center">
            <p className="text-xs font-medium text-slate-500">{dropImage}</p>
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-slate-100 bg-white px-3.5 pb-3.5 pt-3">
        <div className="flex items-center justify-between text-slate-900">
          <div className="flex gap-3.5">
            <Heart className="size-5" aria-hidden="true" />
            <MessageCircle className="size-5" aria-hidden="true" />
            <Send className="size-5" aria-hidden="true" />
          </div>
          <Bookmark className="size-5" aria-hidden="true" />
        </div>
        <p className="text-[11px] font-bold text-slate-900">{likes}</p>
        <div>
          <TruncatedCaption
            headline={headline}
            caption={caption}
            threshold={MOBILE_CAPTION_LIMIT}
            prefix={handle}
            prefixClassName="font-bold"
            className="text-[12px] leading-5 text-slate-800"
            tagClassName="font-medium text-[#0095F6]"
            buttonClassName="font-semibold text-slate-500 hover:text-slate-800"
            scrollOnExpand
            scrollRootRef={scrollRootRef}
          />
        </div>
        <p className="text-[10px] uppercase tracking-wide text-slate-400">{comments}</p>
      </div>

      {/* Text action labels — pinned to the bottom, clear of the Home Indicator. */}
      <div className="mt-auto flex shrink-0 items-center border-t border-slate-100 px-3 py-3 text-[11px] font-semibold text-slate-600">
        <span className="flex-1">{like}</span>
        <span className="flex-1 text-center">{comment}</span>
        <span className="flex-1 text-right">{share}</span>
      </div>
    </div>
  )
}

function TikTokScreen({
  handle,
  headline,
  caption,
  images,
  music,
  dropImage,
}: ScreenProps & {
  handle: string
  music: string
}) {
  const { t } = useLanguage()
  const count = images.length
  const { active, go } = useSlideIndex(count)
  const pointerStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null)

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (count < 2 || (event.pointerType === 'mouse' && event.button !== 0)) return
    if (event.target instanceof Element && event.target.closest('button')) return

    pointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture is not implemented in every test/browser environment.
    }
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current
    pointerStartRef.current = null
    if (!start || start.pointerId !== event.pointerId) return

    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    if (Math.abs(deltaX) < 36 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return

    go(deltaX < 0 ? 1 : -1)
  }

  const handlePointerCancel = () => {
    pointerStartRef.current = null
  }

  return (
    /* Fullscreen stage — horizontal swipe/drag changes slides; vertical gestures remain native. */
    <div
      data-testid="tiktok-screen"
      className="group relative h-full w-full select-none overflow-hidden bg-black text-white touch-pan-y sm:cursor-grab sm:active:cursor-grabbing"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onDragStart={(event) => event.preventDefault()}
    >
      {/* Native stage: the media is letterboxed on black so the whole photo stays visible and
          centred, whatever its aspect ratio. It spans the whole canvas (`inset-0`) the way TikTok's
          full-bleed player does, so a 9:16 photo fills the frame exactly and the navigation bar
          simply floats over its lower edge — no reserved band, no dead space left behind by the
          removed Following / For You tabs. The track carries `w-full` so each slide resolves to the
          phone's width — without it the track shrink-wraps to the image's intrinsic width and small
          photos leave side gaps. */}
      <div className="absolute inset-0 z-0 flex items-center justify-center bg-black">
        {count > 0 ? (
          <div
            className="flex h-full w-full transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(-${active * 100}%)` }}
          >
            {images.map((src, index) => (
              <img
                key={`${src.slice(0, 24)}-${index}`}
                src={src}
                alt=""
                draggable={false}
                className="h-full w-full shrink-0 object-contain object-center"
                style={{ objectPosition: TIKTOK_IMAGE_OBJECT_POSITION }}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 via-black to-slate-900 px-10 text-center">
            <p className="text-xs font-medium text-white/60">{dropImage}</p>
          </div>
        )}
      </div>

      {/* Top feed navigation — a light overlay, not reserved layout space, so the photo stays full-bleed. */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center gap-5 bg-gradient-to-b from-black/60 via-black/20 to-transparent px-4 pb-5 pt-3">
        <span className="text-[12px] font-semibold text-white/75 [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]">
          {t('preview.feedFollowing')}
        </span>
        <span className="relative text-[13px] font-extrabold text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.95)]">
          {t('preview.forYou')}
          <span className="absolute -bottom-1.5 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-white" />
        </span>
        <Search className="absolute right-3 size-4 text-white drop-shadow-md" aria-hidden="true" />
      </div>

      {/* Stronger lower scrim keeps the creator copy readable on bright product photos. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[48%] bg-gradient-to-t from-black/95 via-black/45 to-transparent"
        aria-hidden="true"
      />

      {count > 0 && <ImageCountBadge index={active} total={count} className="top-11" />}

      {/* Right action rail — one tight, evenly spaced column of bold white glyphs. Legibility over
          the footage comes from a soft shadow, keeping the rail compact rather than circling each icon. */}
      <div className="absolute bottom-[60px] right-2.5 z-20 flex flex-col items-center gap-3 text-white">
        <span className="relative">
          <Avatar brand={handle} className="size-9 ring-2 ring-white" />
          <span className="absolute -bottom-1 left-1/2 flex size-4 -translate-x-1/2 items-center justify-center rounded-full bg-[#FE2C55] text-white ring-2 ring-white">
            <Plus className="size-2.5" aria-hidden="true" />
          </span>
        </span>
        <RailItem icon={Heart} value={MOCK_STATS.tiktokLikes} filled />
        <RailItem icon={MessageCircle} value={MOCK_STATS.tiktokComments} />
        <RailItem icon={Bookmark} value={MOCK_STATS.tiktokSaves} />
        <RailItem icon={Forward} value={MOCK_STATS.tiktokShares} />
        <span className="mt-0.5 flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 via-slate-600 to-black ring-1 ring-white/25 animate-[spin_3.5s_linear_infinite] motion-reduce:animate-none">
          <Music2 className="size-3.5 text-white" aria-hidden="true" />
        </span>
      </div>

      {/* Bottom-left creator block — stops short of the rail. */}
      <div className="absolute bottom-[60px] left-3 right-[60px] z-20 flex flex-col gap-1.5 text-xs text-white">
        <p className="text-sm font-bold [text-shadow:0_1px_3px_rgba(0,0,0,0.95),0_2px_8px_rgba(0,0,0,0.8)]">@{handle}</p>
        <div>
          <TruncatedCaption
            headline={headline}
            caption={caption}
            threshold={MOBILE_CAPTION_LIMIT}
            className="text-[12px] leading-5 text-white/95 [text-shadow:0_1px_3px_rgba(0,0,0,0.98),0_2px_9px_rgba(0,0,0,0.85)]"
            /* Inline over the media scrim — the trigger gets its own shadow for contrast. */
            buttonClassName="font-semibold text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.95)] hover:text-white"
            moreLabel={t('preview.moreShort')}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Music2 className="size-3.5 shrink-0 text-white" aria-hidden="true" />
          <p className="truncate text-[11px] text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.95)]">{music}</p>
        </div>
      </div>

      {/* Bottom navigation — trimmed so it hugs the Home Indicator without touching it. */}
      <nav className="absolute inset-x-0 bottom-0 z-30 flex items-stretch border-t border-white/10 bg-black/90 px-1 pb-1 pt-1">
        <NavItem icon={Home} label={t('preview.navHome')} />
        <NavItem icon={Users} label={t('preview.navFriends')} />
        <NavItem icon={Plus} label={t('preview.navCreate')} create />
        <NavItem icon={Inbox} label={t('preview.navInbox')} badge="3" />
        <NavItem icon={User} label={t('preview.navProfile')} />
      </nav>
    </div>
  )
}

/** One destination in the TikTok bottom navigation. */
function NavItem({
  icon: Icon,
  label,
  create = false,
  badge,
}: {
  icon: LucideIcon
  label: string
  create?: boolean
  badge?: string
}) {
  return (
    <span className="flex flex-1 flex-col items-center gap-0.5 text-[10px] font-medium text-white/70">
      <span className="relative flex items-center justify-center">
        {create ? (
          <span className="flex h-6 w-9 items-center justify-center rounded-lg bg-white text-black">
            <Icon className="size-4" aria-hidden="true" />
          </span>
        ) : (
          <Icon className="size-[22px]" aria-hidden="true" />
        )}
        {badge && (
          <span className="absolute -right-2.5 -top-1 flex min-w-3.5 items-center justify-center rounded-full bg-[#FE2C55] px-1 text-[9px] font-bold leading-[14px] text-white">
            {badge}
          </span>
        )}
      </span>
      <span className="leading-none">{label}</span>
    </span>
  )
}

/** One action in the TikTok mobile rail — a bold glyph with its count directly beneath. */
function RailItem({
  icon: Icon,
  value,
  filled = false,
}: {
  icon: LucideIcon
  value: string
  /** Solid treatment, used where TikTok fills the shape (the like heart). */
  filled?: boolean
}) {
  return (
    <span className="flex flex-col items-center gap-1">
      <Icon
        className={`size-[22px] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)] ${
          filled ? 'fill-white' : ''
        }`}
        strokeWidth={2.5}
        aria-hidden="true"
      />
      <span className="text-[10px] font-semibold leading-none text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.55)]">
        {value}
      </span>
    </span>
  )
}

/**
 * Facebook's native desktop feed layouts: a single hero card, a split pair, a
 * "one big + two stacked" triptych, a clean 2×2 grid for four photos, and a
 * 2×2 grid that masks the overflow behind a `+N` counter on the fourth tile.
 * Each layout keeps its native aspect ratio — the desktop feed owns the height.
 */
function FacebookImages({ images, dropImage }: { images: string[]; dropImage: string }) {
  const { t } = useLanguage()
  const count = images.length
  const root = 'grid min-h-0 min-w-0 w-full gap-1 overflow-hidden bg-slate-100'
  const tile = 'h-full w-full min-h-0 object-cover'

  if (count === 0) {
    return (
      <div className="flex aspect-square min-h-0 w-full items-center justify-center bg-slate-100">
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-100 via-slate-50 to-blue-100 px-8 text-center">
          <p className="text-xs font-medium text-slate-500">{dropImage}</p>
        </div>
      </div>
    )
  }

  if (count === 1) {
    return (
      <div className="relative aspect-square min-h-0 w-full overflow-hidden bg-slate-100">
        <img src={images[0]} alt="" className={tile} />
        <ImageCountBadge index={0} total={count} />
      </div>
    )
  }

  if (count === 2) {
    return (
      <div className={`${root} grid-cols-2 grid-rows-1`}>
        {images.slice(0, 2).map((src, index) => (
          <img
            key={`${src.slice(0, 24)}-${index}`}
            src={src}
            alt=""
            className="aspect-[4/5] w-full object-cover"
          />
        ))}
      </div>
    )
  }

  if (count === 3) {
    return (
      <div className={`${root} aspect-[4/5] grid-cols-2 grid-rows-2`}>
        <img src={images[0]} alt="" className={`row-span-2 ${tile}`} />
        <img src={images[1]} alt="" className={tile} />
        <img src={images[2]} alt="" className={tile} />
      </div>
    )
  }

  /* Four photos: a clean 2×2 grid — every image visible, no counter overlay. */
  if (count === 4) {
    return (
      <div className={`${root} aspect-square grid-cols-2 grid-rows-2`}>
        {images.map((src, index) => (
          <img key={`${src.slice(0, 24)}-${index}`} src={src} alt="" className={tile} />
        ))}
      </div>
    )
  }

  /* Five or more: three tiles plus a masked fourth showing how many are hidden. */
  const extra = count - 4
  return (
    <div className={`${root} aspect-square grid-cols-2 grid-rows-2`}>
      {images.slice(0, 3).map((src, index) => (
        <img key={`${src.slice(0, 24)}-${index}`} src={src} alt="" className={tile} />
      ))}
      <div className="relative min-h-0 overflow-hidden">
        <img src={images[3]} alt="" className={tile} />
        <span
          className="absolute inset-0 flex items-center justify-center bg-black/60 text-lg font-bold text-white"
          aria-label={t('preview.imageOf', { index: 4, total: count })}
        >
          +{extra}
        </span>
      </div>
    </div>
  )
}

/**
 * Facebook's *mobile* photo layouts — the native collage, capped at four square
 * cells. The feed never pages through photos with arrows on a phone: it lays the
 * first four out as a collage and lets the post own its height.
 *
 * The gallery shows four photos at most. Two sit side by side in a 2:1 band so
 * each cell is square, three keep Facebook's hero-plus-stack triptych, and four
 * fill a clean 2×2. Anything past the fourth is counted behind a `+N` mask on the
 * last tile rather than squeezing extra cells in. A post with a single photo is
 * the one exception to the square grid: its frame takes the photo's own ratio, so
 * a tall product shot is never padded out into a square.
 *
 * Every tile letterboxes its photo (`object-contain`) so the whole picture stays
 * visible inside its cell, with the collage's own `bg-slate-100` filling whatever
 * space is left over — a cropped tile hides exactly the part of a product shot
 * people came to see.
 */
function FacebookMobileGrid({ images, dropImage }: { images: string[]; dropImage: string }) {
  const { t } = useLanguage()
  const { ratios, measure } = useImageRatios()
  /** Everything past the fourth photo is counted, not drawn — the collage is a 4-cell grid. */
  const total = images.length
  const count = Math.min(total, 4)
  const root = 'grid w-full min-h-0 gap-1 overflow-hidden'
  const tile = 'h-full w-full min-h-0 object-contain'

  if (count === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-sky-100 via-slate-50 to-blue-100 px-8 text-center">
        <p className="text-xs font-medium text-slate-500">{dropImage}</p>
      </div>
    )
  }

  if (count === 1) {
    /* The frame follows the decoded photo instead of a square cell, so the picture is whole and the
       post never carries a letterboxed band. Square until the browser reports the real ratio. */
    const ratio = ratios[images[0]] ?? 1
    return (
      <div
        className="relative flex w-full items-center justify-center overflow-hidden bg-slate-100"
        style={{ aspectRatio: `${ratio}` }}
      >
        <img
          ref={(element) => measure(images[0], element)}
          src={images[0]}
          alt=""
          onLoad={(event) => measure(images[0], event.currentTarget)}
          className="h-full w-full object-contain"
        />
        <ImageCountBadge index={0} total={total} />
      </div>
    )
  }

  if (count === 2) {
    return (
      <div className={`${root} aspect-[2/1] grid-cols-2 grid-rows-1`}>
        {images.slice(0, 2).map((src, index) => (
          <img key={`${src.slice(0, 24)}-${index}`} src={src} alt="" className={tile} />
        ))}
      </div>
    )
  }

  if (count === 3) {
    return (
      <div className={`${root} aspect-square grid-cols-2 grid-rows-2`}>
        <img src={images[0]} alt="" className={`row-span-2 ${tile}`} />
        <img src={images[1]} alt="" className={tile} />
        <img src={images[2]} alt="" className={tile} />
      </div>
    )
  }

  /* Four — or more, with the overflow counted behind the last tile. */
  const extra = total - 4
  return (
    <div className={`${root} aspect-square grid-cols-2 grid-rows-2`}>
      {images.slice(0, 3).map((src, index) => (
        <img key={`${src.slice(0, 24)}-${index}`} src={src} alt="" className={tile} />
      ))}
      <div className="relative min-h-0 overflow-hidden">
        <img src={images[3]} alt="" className={tile} />
        {extra > 0 && (
          <span
            className="absolute inset-0 flex items-center justify-center bg-black/60 text-lg font-bold text-white"
            aria-label={t('preview.imageOf', { index: 4, total })}
          >
            +{extra}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Facebook's mobile app shell: a pinned top app bar, a single scrolling feed
 * band, and the pinned six-tab bottom navigation. Only the feed scrolls, and a
 * second "feed continuation" post is stretched to absorb any leftover height, so
 * the grey canvas can never show through as an empty gap.
 */
function FacebookScreen({
  brand,
  headline,
  caption,
  images,
  sponsored,
  likes,
  like,
  comment,
  share,
  dropImage,
}: ScreenProps & {
  brand: string
  sponsored: string
  likes: string
  like: string
  comment: string
  share: string
}) {
  const { t } = useLanguage()
  const feedRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white">
      {/* Pinned top app bar */}
      <header className="z-20 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <span className="text-2xl font-bold tracking-tighter text-[#0866FF]">facebook</span>
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-gray-100 text-slate-800">
            <Plus className="size-4" strokeWidth={2.5} aria-hidden="true" />
          </span>
          <span className="flex size-8 items-center justify-center rounded-full bg-gray-100 text-slate-800">
            <Search className="size-4" strokeWidth={2.5} aria-hidden="true" />
          </span>
          <span className="flex size-8 items-center justify-center rounded-full bg-gray-100 text-slate-800">
            <MessageCircle className="size-4" strokeWidth={2.5} aria-hidden="true" />
          </span>
        </div>
      </header>

      {/* Feed — the only scrolling region, between the two pinned bars */}
      <div
        ref={feedRef}
        className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y bg-[#f0f2f5]"
      >
        <div className="flex min-h-full flex-col">
          <article className="shrink-0 bg-white">
            <div className="flex items-center justify-between px-3 pb-2 pt-3">
              <div className="flex min-w-0 items-center gap-2">
                <Avatar brand={brand} />
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold leading-tight text-slate-900">{brand}</p>
                  <p className="flex items-center gap-1 truncate text-[10px] text-slate-500">
                    {sponsored} · 1d · <Globe className="size-2.5" aria-hidden="true" />
                  </p>
                </div>
              </div>
              <MoreHorizontal className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
            </div>

            <div className="px-3 pb-2">
              {/* The body and tags share one truncation budget; the hook is rendered separately above them. */}
              <TruncatedCaption
                headline={headline}
                caption={caption}
                threshold={MOBILE_CAPTION_LIMIT}
                className="text-[12px] leading-[18px] text-slate-800"
                tagClassName="font-medium text-[#0866FF]"
                buttonClassName="font-semibold text-slate-500 hover:text-slate-800"
                scrollOnExpand
                scrollRootRef={feedRef}
              />
            </div>

            {/* The collage owns its own frame — square for a grid, the photo's own ratio when there
                is only one — so the wrapper stays a plain clip rather than forcing a square. */}
            <div className="relative w-full overflow-hidden bg-slate-100">
              <FacebookMobileGrid images={images} dropImage={dropImage} />
            </div>

            <div className="flex items-center justify-between px-3 py-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="flex size-4 items-center justify-center rounded-full bg-sky-500 text-[8px] text-white">
                  <ThumbsUp className="size-2.5" aria-hidden="true" />
                </span>
                <span className="flex size-4 items-center justify-center rounded-full bg-rose-500 text-[8px] text-white">
                  <Heart className="size-2.5 fill-white" aria-hidden="true" />
                </span>
                <span className="ml-0.5">{likes}</span>
              </span>
              <span className="flex items-center gap-1">
                <span>{t('preview.commentsCount', { count: MOCK_STATS.facebookComments })}</span>
                <span aria-hidden="true">·</span>
                <span>{t('preview.sharesCount', { count: MOCK_STATS.facebookShares })}</span>
              </span>
            </div>

            <div className="flex border-y border-slate-100 py-2.5 text-xs font-medium text-slate-600">
              <ActionItem icon={ThumbsUp} label={like} />
              <ActionItem icon={MessageCircle} label={comment} />
              <ActionItem icon={Share2} label={share} />
            </div>
          </article>

          {/* Feed continuation — the divider plus a stretched mock post guarantee full coverage. */}
          <div className="h-2 shrink-0 bg-[#f0f2f5]" aria-hidden="true" />

          <article className="flex min-h-0 flex-1 flex-col bg-white">
            <div className="flex items-center justify-between px-3 pb-2 pt-3">
              <div className="flex min-w-0 items-center gap-2">
                <Avatar brand="Brand Partner" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold leading-tight text-slate-900">
                    Brand Partner
                  </p>
                  <p className="flex items-center gap-1 truncate text-[10px] font-semibold text-[#0866FF]">
                    {t('preview.follow')}
                    <span className="font-normal text-slate-500">· 3h ·</span>
                    <Globe className="size-2.5 text-slate-500" aria-hidden="true" />
                  </p>
                </div>
              </div>
              <MoreHorizontal className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
            </div>

            <p className="shrink-0 px-3 pb-2 text-sm leading-5 text-slate-800">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do eiusmod tempor.
            </p>

            <div className="flex min-h-[140px] w-full flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200">
              <span className="text-[11px] font-medium text-slate-400">
                {t('preview.dropImage')}
              </span>
            </div>
          </article>
        </div>
      </div>

      {/* Pinned bottom navigation */}
      <nav className="z-20 flex w-full shrink-0 items-center justify-between border-t border-slate-200 bg-white px-1 py-2 text-slate-500">
        <FacebookTab icon={Home} label={t('preview.navHome')} active />
        <FacebookTab icon={Tv} label={t('preview.fbTabVideo')} />
        <FacebookTab icon={Users} label={t('preview.navFriends')} />
        <FacebookTab icon={Bell} label={t('preview.fbTabNotifications')} />
        <FacebookTab icon={Menu} label={t('preview.fbTabMenu')} />
      </nav>
    </div>
  )
}

/** One destination in Facebook's six-tab bottom navigation. */
function FacebookTab({
  icon: Icon,
  label,
  active = false,
}: {
  icon: LucideIcon
  label: string
  active?: boolean
}) {
  return (
    <span
      className={`flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center text-center ${
        active ? 'text-[#0866FF]' : 'text-slate-500 hover:text-slate-900'
      }`}
    >
      <Icon className="size-5 shrink-0" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
      <span className="mt-1 max-w-full truncate text-[10px] font-medium leading-none">{label}</span>
    </span>
  )
}

function ActionItem({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="flex flex-1 items-center justify-center gap-1.5">
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </span>
  )
}

/**
 * How a desktop layout is being presented. `embedded` is the small browser
 * preview; `fullscreen` is the immersive portal that owns the whole viewport.
 * TikTok uses it to scale the media stage up; Instagram uses it to show the
 * full, uncropped photo beside a slightly narrower sidebar. Facebook keeps
 * its native identity either way.
 */
type Presentation = 'embedded' | 'fullscreen'

interface DesktopLayoutProps {
  platform: PreviewPlatform
  brand: string
  handle: string
  /** The separately emphasized opening line. */
  headline: string
  /** Caption body and hashtags, sharing one character budget for truncation. */
  caption: string
  images: string[]
  likes: string
  dropImage: string
  presentation?: Presentation
}

/** Dispatches to the platform-native desktop design — three distinct layouts. */
function DesktopLayout(props: DesktopLayoutProps) {
  if (props.platform === 'instagram') return <InstagramDesktop {...props} />
  if (props.platform === 'tiktok') return <TikTokDesktop {...props} />
  return <FacebookDesktop {...props} />
}

/**
 * Instagram on the web — large media beside a fixed, scrollable post sidebar.
 * The media pane always fits the whole photo (`object-contain`) against its dark
 * backdrop, in both the embedded preview and fullscreen, so nothing is ever
 * cropped; the sidebar gives up a little width in fullscreen so the photo can
 * breathe.
 */
function InstagramDesktop({
  brand,
  handle,
  headline,
  caption,
  images,
  likes,
  dropImage,
  presentation = 'embedded',
}: DesktopLayoutProps) {
  const { t } = useLanguage()
  const count = images.length
  const { active, go } = useSlideIndex(count)
  const fullscreen = presentation === 'fullscreen'

  return (
    /* Fixed light palette: the Instagram mockup must never follow CaptiVibe's dark mode.
       The desktop composition is unconditional: this component only ever renders the PC preview,
       which is scaled as a whole rather than reflowed into a stacked mobile layout. */
    <div className="flex h-full flex-row bg-white">
      <div className="group relative flex min-h-0 flex-1 shrink-0 items-center justify-center overflow-hidden bg-black">
        <div className="relative h-full w-full overflow-hidden">
          {count > 0 ? (
            <>
              <div
                className="flex h-full transition-transform duration-300 ease-out motion-reduce:transition-none"
                style={{ transform: `translateX(-${active * 100}%)` }}
              >
                {images.map((src, index) => (
                  <img
                    key={`${src.slice(0, 24)}-${index}`}
                    src={src}
                    alt=""
                    className="h-full w-full shrink-0 object-contain object-center"
                  />
                ))}
              </div>

              <ImageCountBadge index={active} total={count} />

              {count > 1 && (
                <>
                  <GalleryArrow direction="left" label={t('preview.prevImage')} onClick={() => go(-1)} />
                  <GalleryArrow direction="right" label={t('preview.nextImage')} onClick={() => go(1)} />
                  <div className="absolute inset-x-0 bottom-3 z-20 flex items-center justify-center gap-1.5">
                    {images.map((_, index) => (
                      <span
                        key={`dot-${index}`}
                        className={`h-1.5 rounded-full transition-all duration-200 motion-reduce:transition-none ${
                          index === active
                            ? 'w-4 bg-gradient-to-r from-blue-500 to-fuchsia-500'
                            : 'w-1.5 bg-white/75'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-black px-10 text-center">
              <p className="text-sm font-medium text-white/60">{dropImage}</p>
            </div>
          )}
        </div>
      </div>

      <aside
        className={`flex h-full shrink-0 flex-col border-l border-slate-200 bg-white ${
          fullscreen ? 'w-[360px]' : 'w-[400px]'
        }`}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-5 py-4">
          <span className="rounded-full bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 p-[2px]">
            <span className="block rounded-full bg-white p-[2px]">
              <Avatar brand={brand} />
            </span>
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-normal text-slate-900">{handle}</p>
            <p className="truncate text-xs leading-normal text-slate-500">
              {t('preview.sponsored')} · Instagram
            </p>
          </div>
          <button
            type="button"
            className="ml-auto shrink-0 cursor-pointer text-sm font-semibold text-blue-600 transition duration-200 hover:opacity-80 focus-visible:outline-none focus-visible:underline"
          >
            {t('preview.follow')}
          </button>
        </header>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <TruncatedCaption
            headline={headline}
            caption={caption}
            threshold={DESKTOP_CAPTION_LIMIT}
            prefix={handle}
            prefixClassName="font-bold"
            className="text-sm leading-6 text-slate-900"
            tagClassName="font-medium text-[#0095F6]"
            buttonClassName="font-semibold text-slate-500 hover:text-slate-800"
          />

          {/* A short comment thread — enough activity to read as a real post. */}
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-900">{t('preview.commentsHeader')}</p>
            <ul className="mt-2.5 space-y-2.5">
              {PREVIEW_COMMENTS.slice(0, 2).map((item) => (
                <li key={item.handle} className="flex items-start gap-2">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
                    {item.handle.slice(0, 1).toUpperCase()}
                  </span>
                  <p className="text-xs leading-5 text-slate-700">
                    <span className="font-semibold text-slate-900">{item.handle}</span>{' '}
                    {t(item.text)}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-xs font-medium text-slate-500">
              {t('preview.viewAllComments', { count: MOCK_STATS.instagramComments })}
            </p>
          </div>

          <div className="mt-4 flex items-center gap-4 text-slate-900">
            <Heart className="size-6" aria-hidden="true" />
            <MessageCircle className="size-6" aria-hidden="true" />
            <Send className="size-6" aria-hidden="true" />
            <Bookmark className="ml-auto size-6" aria-hidden="true" />
          </div>
          <p className="mt-2 text-sm font-bold text-slate-900">{likes}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5 border-t border-slate-200 px-4 py-3">
          <MessageCircle className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            aria-label={t('preview.comment')}
            placeholder={t('preview.commentPlaceholder')}
            className="min-w-0 flex-1 bg-transparent text-sm leading-normal text-slate-900 outline-none placeholder:text-slate-400"
          />
          <button
            type="button"
            className="shrink-0 cursor-pointer text-sm font-semibold text-blue-600 transition duration-200 hover:opacity-80 focus-visible:outline-none focus-visible:underline"
          >
            {t('preview.post')}
          </button>
        </div>
      </aside>
    </div>
  )
}

/**
 * TikTok on the web — a light, professional feed layout in both modes: white
 * canvas, soft grey stage and a light creator sidebar with dark type. Only the
 * TikTok *phone* mockup keeps the brand's dark UI.
 */
function TikTokDesktop({ handle, headline, caption, images, dropImage, presentation = 'embedded' }: DesktopLayoutProps) {
  const { t } = useLanguage()
  const count = images.length
  const { active, go } = useSlideIndex(count)
  const fullscreen = presentation === 'fullscreen'

  return (
    <div className="flex h-full flex-row bg-white">
      {/* Left — the player *is* the stage: it takes every pixel left over beside the sidebar,
          so the media never floats small in the middle of an empty area. */}
      <div className="group relative min-h-0 w-full flex-1 overflow-hidden bg-slate-50">
        <div className={`absolute inset-0 ${fullscreen ? 'p-6' : 'p-5'}`}>
          <div className="relative h-full min-h-0 w-full overflow-hidden rounded-2xl bg-black shadow-sm ring-1 ring-slate-900/10">
            {count > 0 ? (
              <>
                <div
                  className="absolute inset-0 flex w-full transition-transform duration-300 ease-out motion-reduce:transition-none"
                  style={{ transform: `translateX(-${active * 100}%)` }}
                >
                  {/* The whole photo is fitted inside the stage on both axes, in both modes: the
                      media is never cropped, and the black player absorbs whatever letterboxing the
                      photo's own ratio leaves around it. */}
                  {images.map((src, index) => (
                    <img
                      key={`${src.slice(0, 24)}-${index}`}
                      src={src}
                      alt=""
                      className="h-full w-full shrink-0 object-contain object-center"
                    />
                  ))}
                </div>

                <ImageCountBadge index={active} total={count} />

                {count > 1 && (
                  <>
                    <GalleryArrow direction="left" label={t('preview.prevImage')} onClick={() => go(-1)} />
                    <GalleryArrow direction="right" label={t('preview.nextImage')} onClick={() => go(1)} />
                  </>
                )}
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 via-black to-slate-900 px-8 text-center">
                <p className="text-xs font-medium text-white/60">{dropImage}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right — light creator sidebar, separated by a hairline border. */}
      <aside className="flex h-full min-h-0 w-[360px] shrink-0 flex-col border-l border-slate-200 bg-white p-6">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-3">
            <Avatar brand={handle} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-normal text-slate-900">@{handle}</p>
              <p className="truncate text-xs leading-normal text-slate-500">{t('preview.following')}</p>
            </div>
            <button
              type="button"
              className="ml-auto shrink-0 cursor-pointer rounded-lg bg-[#FE2C55] px-4 py-2 text-xs font-bold text-white transition duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE2C55]/40"
            >
              {t('preview.follow')}
            </button>
          </div>

          <div className="custom-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto">
            <TruncatedCaption
              headline={headline}
              caption={caption}
              threshold={DESKTOP_CAPTION_LIMIT}
              className="text-sm leading-6 text-slate-800"
              buttonClassName="font-semibold text-slate-500 hover:text-slate-800"
            />

            <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5">
              <Music2 className="size-4 shrink-0 text-slate-700" aria-hidden="true" />
              <p className="truncate text-xs text-slate-600">{t('preview.music')}</p>
            </div>

            {/* Engagement row — TikTok Web's like / comment / save / share cluster. */}
            <div className="mt-4 flex items-center justify-between text-slate-700">
              <DesktopStat icon={Heart} value={MOCK_STATS.tiktokLikes} />
              <DesktopStat icon={MessageCircle} value={MOCK_STATS.tiktokComments} />
              <DesktopStat icon={Bookmark} value={MOCK_STATS.tiktokSaves} />
              <DesktopStat icon={Share2} value={MOCK_STATS.tiktokShares} />
            </div>

            {/* Comment preview — a hint of real activity under the post. */}
            <div className="mt-4 border-t border-slate-200 pt-4">
              <p className="text-xs font-semibold text-slate-900">
                {t('preview.commentsHeader')}{' '}
                <span className="font-normal text-slate-500 tabular-nums">{MOCK_STATS.tiktokComments}</span>
              </p>
              <ul className="mt-3 space-y-3">
                {PREVIEW_COMMENTS.slice(1, 3).map((item) => (
                  <li key={item.handle} className="flex items-start gap-2">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
                      {item.handle.slice(0, 1).toUpperCase()}
                    </span>
                    <p className="text-xs leading-5 text-slate-700">
                      <span className="font-semibold text-slate-900">@{item.handle}</span>{' '}
                      {t(item.text)}
                    </p>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-3 cursor-pointer text-xs font-semibold text-slate-500 transition duration-200 hover:text-slate-900 focus-visible:outline-none focus-visible:underline"
              >
                {t('preview.viewMoreComments')}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}

/** Icon + figure inside the TikTok desktop sidebar — the single, external engagement rail. */
function DesktopStat({ icon: Icon, value }: { icon: LucideIcon; value: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold">
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="tabular-nums">{value}</span>
    </span>
  )
}

/** Facebook on the web — authentic light-grey canvas with a centered white post card. */
function FacebookDesktop({ brand, headline, caption, images, dropImage, presentation = 'embedded' }: DesktopLayoutProps) {
  const { t } = useLanguage()
  const fullscreen = presentation === 'fullscreen'

  return (
    <div className={`min-h-full bg-[#f0f2f5] text-slate-900 ${fullscreen ? 'p-10' : 'p-6'}`}>
      <article
        className={`mx-auto w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${
          fullscreen ? 'max-w-[640px]' : 'max-w-[580px]'
        }`}
      >
        <header className="flex items-center gap-3 px-4 pt-4">
          <Avatar brand={brand} />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-normal text-slate-900">{brand}</p>
            <p className="flex items-center gap-1 truncate text-xs leading-normal text-slate-500">
              {t('preview.sponsored')} · 12m · <Globe className="size-3" aria-hidden="true" />
            </p>
          </div>
          <MoreHorizontal className="ml-auto size-5 shrink-0 text-slate-500" aria-hidden="true" />
        </header>

        <div className="px-4 pb-3 pt-2.5">
          {/* The hook is visually distinct; body and tags still truncate together as one post. */}
          <TruncatedCaption
            headline={headline}
            caption={caption}
            threshold={DESKTOP_CAPTION_LIMIT}
            className="text-[15px] leading-6 text-slate-800"
            tagClassName="font-medium text-[#0866FF]"
            buttonClassName="font-semibold text-slate-500 hover:text-slate-800"
          />
        </div>

        <FacebookImages images={images} dropImage={dropImage} />

        {/* Engagement summary — reaction cluster on the left, counts on the right. */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-2 text-[13px] text-slate-500">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="flex shrink-0 items-center -space-x-1.5" aria-hidden="true">
              <ReactionDot className="bg-sky-500" icon={ThumbsUp} />
              <ReactionDot className="bg-rose-500" icon={Heart} />
              <ReactionDot className="bg-amber-400" icon={Smile} />
            </span>
            <span className="truncate">
              {t('preview.reactions', { count: MOCK_STATS.facebookReactions })}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span>{t('preview.commentsCount', { count: MOCK_STATS.facebookComments })}</span>
            <span aria-hidden="true">·</span>
            <span>{t('preview.sharesCount', { count: MOCK_STATS.facebookShares })}</span>
          </span>
        </div>

        <div className="flex border-t border-slate-200 px-2 py-2.5 text-[15px] font-semibold text-slate-600">
          <ActionItem icon={ThumbsUp} label={t('preview.like')} />
          <ActionItem icon={MessageCircle} label={t('preview.comment')} />
          <ActionItem icon={Share2} label={t('preview.share')} />
        </div>
      </article>
    </div>
  )
}

/** One reaction bubble in Facebook's stacked summary — a coloured dot with a tiny glyph. */
function ReactionDot({ className, icon: Icon }: { className: string; icon: LucideIcon }) {
  return (
    <span
      className={`flex size-4 items-center justify-center rounded-full text-white ring-1 ring-white ${className}`}
    >
      <Icon className="size-2.5" aria-hidden="true" />
    </span>
  )
}

/**
 * Reference desktop canvas for the PC preview. Below `lg` the whole browser shell is rendered at
 * this size and then uniformly scaled into the available width, so the desktop layout keeps its
 * real landscape structure instead of reflowing into a mobile one.
 */
const DESKTOP_REFERENCE_WIDTH = 1100
const DESKTOP_REFERENCE_HEIGHT = 700
/** A shorter phone-only desktop canvas lets the same desktop UI render larger in portrait fullscreen. */
const PHONE_DESKTOP_REFERENCE_HEIGHT = 540
/** Tailwind's `lg` breakpoint: from here up the shell fills its column exactly as it always has. */
const DESKTOP_BREAKPOINT = 1024
/** Safety gap kept between the enlarged PC canvas and the screen edges (and the chrome bar). */
const FULLSCREEN_GUTTER = 10
/**
 * Phones get a two-pixel gutter around the enlarged PC canvas. After the 90° turn the reference
 * canvas is always *height*-bound — 700 units tall against a phone's ~390-unit landscape height —
 * so every pixel the gutter gives back goes straight into the canvas, and a wide gutter translates
 * directly into a smaller desktop simulation. Two pixels is enough to read the canvas edge against
 * the background without eating into it, and the safe-area insets are already paid for by the
 * dialog's own padding (`rotatedStyle`), so nothing here is load-bearing.
 */
const PHONE_FULLSCREEN_GUTTER = 2
/** Fallback height of the fullscreen chrome bar, used on the very first measuring pass. */
const FULLSCREEN_CHROME_HEIGHT = 48
/** Compact URL bar height on portrait phones to give the desktop simulation more room. */
const PHONE_FULLSCREEN_CHROME_HEIGHT = 28

/** From `sm` up the header grows to 69px and the panel's padding to 20px, so the reserve follows. */
const PHONE_FRAME_RESERVE_SM = 180
/** No phone preview grows past this, however tall the display is. */
const PHONE_FRAME_MAX_HEIGHT = 760
const PHONE_FRAME_MAX_HEIGHT_TIKTOK = 920
const PHONE_FRAME_MAX_HEIGHT_PC = 860
const PHONE_FRAME_RESERVE_PC = 120

/**
 * Minimal shape of the Screen Orientation API — absent on iOS Safari.
 *
 * `unlock()` returns `undefined`, *not* a promise: only `lock()` is promise-returning. Typing it as
 * `void` is what keeps the teardown below from chaining promise-only methods such as `.catch()`
 * onto it — the exact call that used to throw on exit and blank the page.
 */
type ScreenOrientationLike = {
  lock?: (orientation: 'landscape') => Promise<void>
  unlock?: () => void
}

/**
 * Desktop preview — a fixed-height browser shell whose content area scrolls.
 * The chrome hosts the fullscreen trigger, which re-renders the active layout
 * at full scale inside a modal.
 */
function BrowserPreview({
  platform,
  host,
  brand,
  handle,
  headline,
  caption,
  images,
  likes,
  dropImage,
}: DesktopLayoutProps & { host: string }) {
  const { t } = useLanguage()
  const [fullscreen, setFullscreen] = useState(false)

  const viewportRef = useRef<HTMLDivElement>(null)
  /** Below `lg` the shell is drawn at its reference size and scaled down to fit the measured width. */
  const [compact, setCompact] = useState(false)
  const [scale, setScale] = useState(1)

  /** The modal's chrome bar, measured so the enlarged phone canvas can be inset below it. */
  const fullscreenChromeRef = useRef<HTMLDivElement>(null)
  /* A phone that enlarges the PC preview gets the whole desktop canvas scaled to fit, rather than a
     reflowed slice of it. The flag is the *real* viewport, so a desktop browser's fullscreen — which
     already has room for the reference canvas — keeps its exact current behaviour. */
  const isPhoneViewport = useIsPhoneViewport()
  const [fullscreenScale, setFullscreenScale] = useState(1)

  useLayoutEffect(() => {
    const node = viewportRef.current
    if (!node) return

    /**
     * `compact` follows the *viewport* — the same `lg` breakpoint the desktop shell has always
     * used — so desktop/laptop previews keep their exact current size and behaviour. `scale`
     * follows the *container* width so the whole landscape shell always fits the narrowest
     * available width without its internal desktop columns ever reflowing.
     */
    const measure = () => {
      setCompact(window.innerWidth < DESKTOP_BREAKPOINT)

      const availableWidth = node.clientWidth
      const viewportHeight =
        window.visualViewport?.height ?? window.innerHeight

      // Chừa khoảng không cho header, toolbar và các thành phần xung quanh.
      const availableHeight = Math.max(0, viewportHeight - 170)

      const widthScale =
        availableWidth > 0
          ? availableWidth / DESKTOP_REFERENCE_WIDTH
          : 1

      const heightScale =
        availableHeight > 0
          ? availableHeight / DESKTOP_REFERENCE_HEIGHT
          : 1

      // Chỉ thu nhỏ thêm khi chiều cao không đủ.
      setScale(Math.min(1, widthScale, heightScale))
    }

    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)

    // Older mobile browsers may lack ResizeObserver — the resize listener above covers them.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(node)

    measure()

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
      window.visualViewport?.removeEventListener('resize', measure)
    }
  }, [])

  // Only the position/size of the rotated fullscreen shell, recomputed from the live viewport.
  const [rotated, setRotated] = useState(false)
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window === 'undefined' ? 0 : window.innerWidth,
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
  }))

  /**
   * Fullscreen teardown. The X button, the Escape key, a browser-initiated `fullscreenchange` and
   * unmounting all funnel through this one idempotent restore, so the page can never be left
   * front-locked, scrolled or otherwise unusable.
   */
  const overflowBeforeFullscreen = useRef<string | null>(null)
  const lockedOrientation = useRef<ScreenOrientationLike | null>(null)

  /** Idempotent: calling it again while already closed is a no-op state update. */
  const closeFullscreen = useCallback(() => setFullscreen(false), [])

  /**
   * Every restoration step is isolated in its own `try`. `ScreenOrientation.unlock()` returns
   * `undefined` — it is *not* promise-returning — and may also throw a DOMException, so a failure
   * there must never abort the remaining steps. Letting an exception escape a cleanup is fatal
   * here: this app has no error boundary, so React answers an uncaught error by unmounting the
   * whole tree, which is precisely the blank page the overlay used to leave behind on exit.
   */
  const restorePage = useCallback(() => {
    const previousOverflow = overflowBeforeFullscreen.current
    overflowBeforeFullscreen.current = null
    try {
      if (previousOverflow !== null) document.body.style.overflow = previousOverflow
    } catch {
      /* Restoring the scroll lock must never block the rest of the teardown. */
    }

    // Release the native lock so the OS can rotate back on exit. Best-effort only.
    const orientation = lockedOrientation.current
    lockedOrientation.current = null
    try {
      orientation?.unlock?.()
    } catch {
      /* `unlock()` resolves to `undefined`, not a promise, and may throw — never chain `.catch()`. */
    }
  }, [])

  useEffect(() => {
    if (!fullscreen) return

    // Lock the page behind the modal so scrolling never leaks to the main view. Captured once per
    // session so a duplicated/interrupted teardown still restores the original value verbatim.
    if (overflowBeforeFullscreen.current === null) {
      overflowBeforeFullscreen.current = document.body.style.overflow
    }
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeFullscreen()
    }
    // A browser-initiated exit must not leave React believing the overlay is still open.
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) closeFullscreen()
    }

    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('fullscreenchange', onFullscreenChange)

    /**
     * Best-effort native rotation (Android/Chrome). iOS Safari does not support locking the
     * orientation of an ordinary web page, so the CSS fallback below handles that case. Only
     * `lock()` is promise-returning and the lock is never required, hence the swallowed rejection.
     */
    const orientation = (screen as unknown as { orientation?: ScreenOrientationLike }).orientation
    if (orientation?.lock) {
      lockedOrientation.current = orientation
      try {
        Promise.resolve(orientation.lock('landscape')).catch(() => {})
      } catch {
        /* Unsupported for this document — the CSS rotation below still applies. */
      }
    }

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      restorePage()
    }
  }, [fullscreen, closeFullscreen, restorePage])

  /**
   * Portrait fullscreen rotates the shell 90°; landscape (or desktop) leaves it alone. Re-measured
   * on every resize/orientation change so the rotated box always exactly fills the viewport.
   */
  useLayoutEffect(() => {
    if (!fullscreen) return

    const update = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      // Bail out of the re-render when nothing moved, so a resize storm can't thrash the commit.
      setViewportSize((current) =>
        current.width === width && current.height === height ? current : { width, height },
      )
      setRotated(height > width)

      /* The reference desktop canvas is fitted into whatever the enlarged shell can spare: the
         landscape dimension (the physical one after the 90° turn), minus the chrome bar and a gutter
         on every side. Scaling the whole stage — rather than reflowing it — is what keeps the desktop
         composition intact *and* fully visible, instead of showing one wide slice of it.
         A phone uses a shorter 540-unit reference height and a compact browser bar so more of its
         landscape viewport is devoted to the desktop simulation. The width/height fit still caps
         the scale: the complete canvas remains inside the available viewport rather than being
         enlarged past the edges. Safe-area insets are handled by the rotated shell itself. */
      const landscapeWidth = Math.max(width, height)
      const landscapeHeight = Math.min(width, height)
      const chrome = fullscreenChromeRef.current?.offsetHeight ?? (isPhoneViewport ? PHONE_FULLSCREEN_CHROME_HEIGHT : FULLSCREEN_CHROME_HEIGHT)
      const gutter = isPhoneViewport ? PHONE_FULLSCREEN_GUTTER : FULLSCREEN_GUTTER
      const referenceHeight = isPhoneViewport ? PHONE_DESKTOP_REFERENCE_HEIGHT : DESKTOP_REFERENCE_HEIGHT
      const availableWidth = landscapeWidth - gutter * 2
      const availableHeight = landscapeHeight - chrome - (isPhoneViewport ? gutter : gutter * 2)
      setFullscreenScale(
        Math.max(
          0,
          Math.min(
            availableWidth / DESKTOP_REFERENCE_WIDTH,
            availableHeight / referenceHeight,
            1,
          ),
        ),
      )
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    window.visualViewport?.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [fullscreen, isPhoneViewport])

  const layoutProps: DesktopLayoutProps = {
    platform,
    brand,
    handle,
    headline,
    caption,
    images,
    likes,
    dropImage,
  }

  /**
   * Each platform gets its own fullscreen environment. Instagram, TikTok and
   * Facebook all keep a native light canvas — the mockups must never follow
   * CaptiVibe's dark mode.
   */
  const fullscreenBackground =
    platform === 'tiktok' ? 'bg-slate-50' : platform === 'facebook' ? 'bg-[#f0f2f5]' : 'bg-white'

  /**
   * Portrait fullscreen trick: the shell is laid out at `viewportHeight × viewportWidth` and rotated
   * 90° about its top-left corner, which lands it exactly on the physical viewport — a real
   * landscape canvas even though the browser still believes it is portrait. The padding insets the
   * content from the physical notch/cutout (safe-area insets only resolve with `viewport-fit=cover`).
   */
  const rotatedStyle: CSSProperties = {
    top: 0,
    left: 0,
    width: `${viewportSize.height}px`,
    height: `${viewportSize.width}px`,
    transformOrigin: 'top left',
    transform: 'rotate(90deg) translateY(-100%)',
    paddingTop: 'env(safe-area-inset-left, 0px)',
    paddingRight: 'env(safe-area-inset-bottom, 0px)',
    paddingBottom: 'env(safe-area-inset-right, 0px)',
    paddingLeft: 'env(safe-area-inset-top, 0px)',
  }

  return (
    <>
      {/* Measures the real available width for the scaling pass below. */}
      <div ref={viewportRef} className="flex w-full min-w-0 flex-col items-center justify-center">
        {/* In compact mode this box clips the untransformed 1100px stage, so the scaled shell can
            never leak a horizontal scrollbar into the page — and the shell stays `w-full` there,
            because a `max-w` inside the stage would scale down to a window with empty sides. Outside
            compact mode the shell is capped against the viewport instead: it can never grow tall
            enough to push the counter pill out of the panel, and the page inside scrolls. */}
        <div
          className={compact ? 'relative w-full overflow-hidden' : 'w-full max-w-[1100px]'}
          style={compact ? { height: DESKTOP_REFERENCE_HEIGHT * scale } : undefined}
        >
          <div
            className={compact ? 'absolute left-0 top-0' : 'w-full'}
            style={
              compact
                ? {
                    width: DESKTOP_REFERENCE_WIDTH,
                    height: DESKTOP_REFERENCE_HEIGHT,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                  }
                : undefined
            }
          >
            <div
              className={`mx-auto flex w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border/80 bg-background shadow-xl ${
                compact ? 'h-full' : 'h-[min(640px,calc(100vh_-_190px))] min-h-[670px] max-w-4xl'
              }`}
            >
              <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/70 px-3.5 py-2">
                <span className="flex shrink-0 gap-1.5" aria-hidden="true">
                  <span className="size-2.5 rounded-full bg-rose-400" />
                  <span className="size-2.5 rounded-full bg-amber-400" />
                  <span className="size-2.5 rounded-full bg-emerald-400" />
                </span>
                <span className="mx-auto flex min-w-0 items-center gap-1.5 rounded-full bg-card px-3 py-1 text-[11px] font-medium leading-normal text-muted-foreground">
                  <Globe className="size-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{host}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setFullscreen(true)}
                  aria-label={t('preview.fullscreen')}
                  title={t('preview.fullscreen')}
                  className="flex size-8 shrink-0 cursor-pointer select-none items-center justify-center rounded-lg text-muted-foreground transition duration-200 hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Maximize className="size-4" aria-hidden="true" />
                </button>
              </div>

              <div className="custom-scrollbar min-h-0 w-full flex-1 overflow-x-auto overflow-y-auto overscroll-contain touch-pan-y [webkit-overflow-scrolling:touch]">
                <DesktopLayout {...layoutProps} />
              </div>
            </div>
          </div>

          {/* Scale-independent trigger. The chrome's own Maximize button lives inside the scaled
              1100px stage, which on a phone shrinks it below a comfortable tap target — this FAB
              sits outside that transform so it keeps its full size. `compact` is the `lg:hidden`
              viewport case, and `BrowserPreview` only renders for the PC device, so this is exactly
              the "PC preview viewed on a phone" state. */}
          {compact && (
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="absolute top-3 right-3 z-30 inline-flex items-center gap-1.5 rounded-full bg-[#0866FF] px-3.5 py-1.5 text-xs font-bold text-white shadow-lg transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Maximize className="size-3.5" aria-hidden="true" />
              <span>{t('preview.fullscreenPC')}</span>
            </button>
          )}
        </div>
      </div>

      {fullscreen &&
        createPortal(
          /* Full-bleed immersive preview — the platform itself is the environment. */
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('preview.fullscreen')}
            className={`contain-paint fixed z-50 flex flex-col will-change-transform ${fullscreenBackground}`}
            style={rotated ? rotatedStyle : { inset: 0 }}
          >
            {/* Browser chrome mirrored from the embedded shell: dots, centred URL pill, close. */}
            <div
              ref={fullscreenChromeRef}
              className={`relative flex shrink-0 items-center border-b border-border bg-muted/70 ${
                isPhoneViewport ? 'h-7 gap-1 px-2 py-0' : 'gap-2 px-3.5 py-2'
              }`}
            >
              <span className={`flex shrink-0 ${isPhoneViewport ? 'gap-1' : 'gap-1.5'}`} aria-hidden="true">
                <span className={`${isPhoneViewport ? 'size-1.5' : 'size-2.5'} rounded-full bg-rose-400`} />
                <span className={`${isPhoneViewport ? 'size-1.5' : 'size-2.5'} rounded-full bg-amber-400`} />
                <span className={`${isPhoneViewport ? 'size-1.5' : 'size-2.5'} rounded-full bg-emerald-400`} />
              </span>
              <span className={`pointer-events-none absolute left-1/2 flex ${isPhoneViewport ? 'max-w-[48%]' : 'max-w-[55%]'} -translate-x-1/2 items-center rounded-full bg-card font-medium leading-normal text-muted-foreground ring-1 ring-border ${
                isPhoneViewport ? 'gap-1 px-1.5 py-0 text-[9px]' : 'gap-1.5 px-3 py-1 text-[11px]'
              }`}>
                <Globe className={`${isPhoneViewport ? 'size-2.5' : 'size-3'} shrink-0`} aria-hidden="true" />
                <span className="truncate">{host}</span>
              </span>
              <FullscreenCloseButton
                platform={platform}
                label={t('preview.closeFullscreen')}
                onClick={closeFullscreen}
                className="ml-auto"
              />
            </div>

            {isPhoneViewport ? (
              /* On a real phone the desktop reference canvas is shorter and typography is boosted
                 inside a scoped wrapper. The fit calculation still keeps the complete stage within
                 the rotated viewport. Any long post content can scroll inside this canvas without
                 scrolling the Preview Studio or the page behind it. */
              <div
                className="flex min-h-0 flex-1 items-center justify-center overflow-hidden"
                style={{ padding: PHONE_FULLSCREEN_GUTTER, paddingTop: 0 }}
              >
                <div
                  className="shrink-0 overflow-hidden rounded-lg"
                  style={{
                    width: DESKTOP_REFERENCE_WIDTH * fullscreenScale,
                    height: PHONE_DESKTOP_REFERENCE_HEIGHT * fullscreenScale,
                  }}
                >
                  <div
                    style={{
                      width: DESKTOP_REFERENCE_WIDTH,
                      height: PHONE_DESKTOP_REFERENCE_HEIGHT,
                      transform: `scale(${fullscreenScale})`,
                      transformOrigin: 'top left',
                    }}
                  >
                    <div className="phone-desktop-readable h-full w-full overflow-x-hidden overflow-y-auto overscroll-contain touch-pan-y [webkit-overflow-scrolling:touch]">
                      <DesktopLayout {...layoutProps} presentation="fullscreen" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
                {/* Definite height so the desktop layouts' `h-full` resolves; the Facebook card keeps
                    `min-h-full` and simply overflows this visible box, which the scroller still catches. */}
                <div className="h-full w-full">
                  <DesktopLayout {...layoutProps} presentation="fullscreen" />
                </div>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}

/**
 * Per-platform fullscreen exit, sized to match the embedded chrome's own action
 * button. Each mockup owns its own language: TikTok gets the brand-red focus
 * accent on a light chip, the others a neutral light chip.
 */
function FullscreenCloseButton({
  platform,
  label,
  onClick,
  className = '',
}: {
  platform: PreviewPlatform
  label: string
  onClick: () => void
  className?: string
}) {
  const tiktok = platform === 'tiktok'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex size-7 shrink-0 cursor-pointer select-none items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-sm transition duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 ${
        tiktok ? 'hover:border-[#FE2C55]/50 focus-visible:ring-[#FE2C55]/40' : 'focus-visible:ring-ring'
      } ${className}`}
    >
      <X className="size-4" aria-hidden="true" />
    </button>
  )
}
