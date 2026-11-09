# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/captivibe-ai/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** CaptiVibe AI
**Updated:** 2026-10-31
**Category:** SaaS (General)
**Direction:** Modern SaaS restraint (Linear / Vercel grade) — flat surfaces, one indigo accent, no decorative gradients.

---

## Global Rules

### Color Palette

Tokens live in `src/index.css` under `@theme` (light) and `.dark` (dark). Components must reference
the **semantic token class** (`bg-card`, `text-muted-foreground`, `border-border`), never a raw palette
color, so both themes stay in sync.

| Role | Light | Dark | CSS Variable | Utility |
|------|-------|------|--------------|---------|
| Primary | `#4F46E5` | `#818CF8` | `--color-primary` | `bg-primary` / `text-primary` |
| Primary Hover | `#4338CA` | `#A5B4FC` | `--color-primary-hover` | `hover:bg-primary-hover` |
| On Primary | `#FFFFFF` | `#0B1220` | `--color-on-primary` | `text-on-primary` |
| Secondary | `#6366F1` | `#6366F1` | `--color-secondary` | `bg-secondary` |
| On Secondary | `#FFFFFF` | `#0B1220` | `--color-on-secondary` | `text-on-secondary` |
| Accent | `#6366F1` | `#A5B4FC` | `--color-accent` | `bg-accent` |
| On Accent | `#FFFFFF` | `#0B1220` | `--color-on-accent` | `text-on-accent` |
| Background | `#F8FAFC` | `#0B1220` | `--color-background` | `bg-background` |
| Foreground | `#0F172A` | `#F8FAFC` | `--color-foreground` | `text-foreground` |
| Card | `#FFFFFF` | `#111827` | `--color-card` | `bg-card` |
| Card Foreground | `#0F172A` | `#F8FAFC` | `--color-card-foreground` | `text-card-foreground` |
| Elevated | `#FFFFFF` | `#172033` | `--color-elevated` | — (used by `.glass-strong`) |
| Muted | `#F1F5F9` | `#1E293B` | `--color-muted` | `bg-muted` |
| Muted Foreground | `#64748B` | `#94A3B8` | `--color-muted-foreground` | `text-muted-foreground` |
| Border | `#E2E8F0` | `#334155` | `--color-border` | `border-border` |
| Destructive | `#DC2626` | `#EF4444` | `--color-destructive` | `bg-destructive` / `text-destructive` |
| On Destructive | `#FFFFFF` | `#FFFFFF` | `--color-on-destructive` | `text-on-destructive` |
| Ring | `#818CF8` | `#A5B4FC` | `--color-ring` | `focus-visible:ring-ring` |

**Color notes:** A single indigo accent carries selection, primary actions and focus. There is no
orange CTA and no blue→purple gradient. Status colors (`amber`, `emerald`) are the only raw palette
colors permitted, and only for length/limit feedback in `src/lib/generate.ts`.

### Theme isolation — social platform previews

**This is a hard rule.** The application theme and the social-platform theme are separate systems.

- Instagram and Facebook mockups are **always light**, even when `.dark` is active on `<html>`.
- The TikTok **phone** mockup is **always dark**; the TikTok **desktop** mockup follows TikTok Web's
  light UI (`bg-white` canvas, `bg-slate-50` stage, light sidebar with dark type). Both ignore `.dark`.
- Platform mockups in `src/components/PhonePreview.tsx` must therefore use **fixed colors**
  (`bg-white`, `text-slate-900`, `bg-[#f0f2f5]`, `bg-black`, `#FE2C55`), never semantic tokens.
- Do not add `dark:` variants inside a platform mockup, and do not let a global CSS variable change
  a preview's appearance.

### Typography

- **Heading Font:** Plus Jakarta Sans
- **Body Font:** Plus Jakarta Sans
- **Mood:** friendly, modern, saas, clean, approachable, professional

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap');
```

### Spacing

Tailwind's default 4px scale. Conventions in this codebase:

| Token | Value | Usage |
|-------|-------|-------|
| `gap-1.5` / `p-0.5` | 6px / 2px | Segmented-control internals |
| `gap-2` / `p-2.5` | 8px / 10px | Icon gaps, chip padding |
| `gap-5` / `p-6` | 20px / 24px | Panel padding, column gaps |
| `lg:gap-8` / `lg:py-8` | 32px | Desktop two-column rhythm |

### Surfaces & Shadows

| Class | Definition | Usage |
|-------|------------|-------|
| `.glass` | `bg-card` + `border-border` + `--shadow-md` | Panels (opaque — no blur) |
| `.glass-strong` | `bg-elevated` + `border-border` + `--shadow-lg` | Drawers, dialogs |
| `--shadow-sm` | `0 1px 2px rgb(15 23 42 / .05)` | Buttons, chips |
| `--shadow-md` | `0 1px 2px, 0 8px 24px -16px` | Panels, cards |
| `--shadow-lg` | `0 1px 2px, 0 18px 40px -24px` | Elevated overlays |
| `--shadow-xl` | `0 24px 60px -32px` | Dialog / fullscreen overlay only |

**Backdrop blur is forbidden on scrolling surfaces.** It forces a full repaint each frame and drops
the app below 60 FPS. Overlays use solid or high-opacity fills instead (`bg-slate-950/60`).

---

## Component Specs

### Buttons

```css
/* Primary — flat indigo, no gradient, no layout-shifting hover */
.btn-primary {
  background: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: 0.75rem;
  padding: 0 1rem;
  min-height: 2.75rem;         /* 44px touch target */
  font-weight: 600;
  box-shadow: var(--shadow-sm);
  transition: background-color 200ms ease;
  cursor: pointer;
}
.btn-primary:hover { background: var(--color-primary-hover); }
.btn-primary:focus-visible { outline: 2px solid var(--color-ring); outline-offset: 2px; }

/* Destructive — same shape, red fill, brightness-only hover */
.btn-destructive {
  background: var(--color-destructive);
  color: var(--color-on-destructive);
  transition: filter 200ms ease;
}
.btn-destructive:hover { filter: brightness(1.1); }

/* Ghost / icon button */
.btn-ghost {
  color: var(--color-muted-foreground);
  border-radius: 0.75rem;
  transition: background-color 200ms ease, color 200ms ease;
}
.btn-ghost:hover { background: var(--color-muted); color: var(--color-foreground); }
```

### Segmented control (platform / device / tabs / language)

One recipe everywhere: `flex shrink-0 items-center gap-0.5 rounded-xl border border-border bg-muted p-0.5`.

```css
.segment {
  border-radius: 0.5rem;
  padding: 0.375rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  transition: background-color 200ms ease, color 200ms ease;
  cursor: pointer;
}
.segment[aria-selected="true"],
.segment[aria-pressed="true"] {
  background: var(--color-primary);
  color: var(--color-on-primary);
  box-shadow: var(--shadow-sm);
}
.segment[aria-selected="false"]:hover { background: var(--color-card); color: var(--color-foreground); }
```

### Selection pills (audience / tone)

Multi-select pills live in `PillGroup.tsx`. Checked → `.pill-selected` (flat indigo, no gradient),
unchecked → `border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/5`.
Always 44px tall, `rounded-full`, `text-sm font-semibold`.

### Cards

```css
.panel {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 1rem;          /* rounded-2xl */
  box-shadow: var(--shadow-md);
}
```

Static surfaces — no hover lift on panels or list items.

### Inputs

```css
.input {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  transition: border-color 200ms ease, box-shadow 200ms ease;
}
.input::placeholder { color: var(--color-muted-foreground); }
.input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-ring) 30%, transparent);
  outline: none;
}
```

### Dialogs & overlays

```css
.overlay      { background: rgb(2 6 23 / 0.60); }   /* solid scrim, never blurred */
.dialog       { background: var(--color-elevated); border: 1px solid var(--color-border);
                border-radius: 1rem; box-shadow: var(--shadow-xl); padding: 1.5rem; }
```

Dialogs use `role="alertdialog"` / `role="dialog"` + `aria-modal`, autofocus the safest action,
close on Escape, and lock `document.body.style.overflow` while open.

### Phone preview frame

`aspect-[9/19.5] max-h-full max-w-[320px]` inside a `p-[3px] bg-slate-900 rounded-[2.75rem]` bezel,
placing the Dynamic Island and a safe-area strip **outside** the screen's own scroller, so the
Home Indicator never overlaps content. The screen body scrolls with `.scrollbar-width-none`.

The reserved safe-area strip is `h-3` for the TikTok phone (its dark nav already carries its own
bottom padding) and `h-6` for Instagram / Facebook, so every nav ends just above the Home Indicator.

### Platform preview layouts

- **Instagram** — mobile is settled: a fixed `aspect-[4/5]` frame, a pinned action bar and an
  internal scroll when a caption expands. Desktop adds a short mock comment thread to the sidebar.
- **Facebook** never pages a phone feed through photos. Mobile mirrors the app shell: a pinned top
  app bar (blue `#0866FF` wordmark + circular action buttons), a single scrolling feed band
  (`flex-1 overflow-y-auto`, grey `#f0f2f5` canvas), and a pinned five-tab bottom navigation
  (Home, Video, Friends, Notifications, Menu). The
  scrolling feed holds the real post plus a stretched mock follow-up post so the canvas is always
  covered. Inside a post the media sits in a fixed `aspect-square` band and uses `FacebookMobileGrid`
  (1 centred `object-contain`, 2 columns, 3 = hero + two stacked, 4 = 2×2, 5+ = full-height hero
  beside a 2×2 block with the last tile masked by `+N`).
  Desktop keeps `FacebookImages`, its intrinsic-ratio grid, plus a reaction summary bar.
- **TikTok** desktop is a light UI (`bg-white` canvas, `bg-slate-50` stage) and the media player
  **is** the stage: it takes the full width left over beside the `360px` sidebar. Embedded fills it
  with `object-cover`; Fullscreen switches to `object-contain` so the whole photo is visible
  uncropped inside the black player. The phone mockup stays dark.
- The engagement controls live in **exactly one place per view** — the TikTok sidebar rail on
  desktop, the right-hand action rail on the phone. Never repeat them over the media itself.
- Any Fullscreen player shows the *complete* media (`object-contain`, centred on a dark surface).
  Cropping is acceptable in Embedded only.
- Desktop sidebars carry a small comment thread and an engagement row. Every mock figure lives in
  `MOCK_STATS` / `PREVIEW_COMMENTS` in `PhonePreview.tsx` — never inline in the JSX.

### PC preview on a phone

`BrowserPreview` always renders the *desktop* composition — `InstagramDesktop` / `TikTokDesktop` /
`FacebookDesktop` never reflow into a stacked mobile layout, so their desktop structure is
unconditional rather than `lg:`-gated.

- **Normal mode** — below `lg` (`DESKTOP_BREAKPOINT`, measured on the *viewport*) the shell is laid
  out at `DESKTOP_REFERENCE_WIDTH × DESKTOP_REFERENCE_HEIGHT` (1100×700) inside a clipped wrapper and
  uniformly scaled by `containerWidth / 1100` (`transform-origin: top left`). The scale is measured
  with `ResizeObserver` + `resize`/`orientationchange`; the shell keeps its aspect ratio, never
  reflows, never crops and never introduces horizontal scrolling. From `lg` up the shell is untouched
  and fills its column exactly as before.
- **Fullscreen** — the overlay tries `screen.orientation.lock('landscape')` (Android/Chrome) and, when
  the viewport is still portrait (`innerWidth < innerHeight`), falls back to a CSS 90° rotation of the
  **overlay only**: the box is sized `viewportHeight × viewportWidth`, `transform-origin: top left`,
  `transform: rotate(90deg) translateY(-100%)`, which lands it exactly on the physical viewport. The
  rotation is recomputed on resize/orientation change and is skipped when the device is already
  landscape, so a successful OS rotation is never applied twice. Safe-area insets are mapped through
  the same rotation (physical top → local left, etc.); they resolve only with `viewport-fit=cover`.
- Exiting restores the previous scale, releases the orientation lock, restores body scrolling and
  unmounts the portal, so the app is never left rotated.

---

## Style Guidelines

**Style:** Modern SaaS restraint

**Keywords:** flat, spacious, quiet, single accent, crisp borders, generous whitespace, functional motion

**Best For:** productivity tools, content generators, dashboards, preview-heavy interfaces

**Key Effects:** 1px semantic borders, one indigo accent for state, `200ms` color transitions,
shadows used only to separate elevation layers.

### Page Pattern

**Pattern Name:** Split workspace (form + live preview)

- **Layout:** `lg:grid lg:grid-cols-12` — controls `col-span-5`, results/preview `col-span-7`.
  Below `lg` the two columns stack into a single `overflow-y-auto` main region.
- **Conversion Strategy:** the preview updates live, so the value proposition is visible before submit.
  The primary CTA stays pinned to the bottom of the control column.
- **Section Order:** header (brand, language, history, theme) > controls > preview/results > history drawer.

---

## Anti-Patterns (Do NOT Use)

- ❌ Blue→orange or blue→purple decorative gradients
- ❌ `backdrop-blur-*` on anything that scrolls
- ❌ Translucent body copy / low-contrast text (4.5:1 minimum)
- ❌ Hover effects that move layout (`-translate-y`, `scale`) on panels or list rows
- ❌ Semantic tokens inside a social-platform mockup
- ❌ `dark:` variants inside a social-platform mockup

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — use Lucide SVG icons
- ❌ **Missing `cursor-pointer`** — all clickable elements
- ❌ **Instant state changes** — always transition (150–300ms)
- ❌ **Invisible focus states** — every interactive element needs a visible focus ring
- ❌ **Hardcoded `px` widths on the shell** — use flex/`min-w-0` so nothing clips at 320px

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] Only semantic token classes outside platform mockups
- [ ] Instagram/Facebook previews still light in dark mode; the TikTok phone preview still dark
- [ ] No emojis used as icons (Lucide only)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states use color transitions only (no layout shift)
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive at 320 / 360 / 375 / 390 / 430 / 768 / 1024 / 1280 / 1440 / 1920
- [ ] No horizontal scroll; no clipped buttons; no overlapping content
- [ ] `npm run build` (`tsc --noEmit && vite build`) passes
