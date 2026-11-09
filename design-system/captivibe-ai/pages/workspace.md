# CaptiVibe AI — Workspace Page Spec (Mobile-first Product & UX Blueprint)

> **LOGIC:** This file is the page-level override for the app's single screen, the **workspace**.
> Where it disagrees with [MASTER.md](../MASTER.md), this file wins. Everything not restated here
> still follows the Master file.

**Project:** CaptiVibe AI
**Page:** Workspace (the only page — the whole SPA)
**Updated:** 2026-11-06
**Type:** Product & UX specification for the existing app, not a redesign brief.

**Basis of this document.** Every statement about "what exists today" was read from the working tree
at the revision below, not from memory. Rendering was inspected statically (source + breakpoint
math), so any row marked *needs a live pass* is a requirement to be confirmed in a browser, not a
measured result.

| Item | Value |
|---|---|
| Files read | `src/App.tsx`, `src/types.ts`, `src/index.css`, `index.html`, `src/lib/i18n.ts`, and the components `Header`, `ControlPanel`, `ImageDropzone`, `ResultsPanel`, `PhonePreview` |
| AI design docs read | `docs/ai/AI_SPECIFICATION.md`, `PROMPTS.md`, `OUTPUT_SCHEMA.json`, `BENCHMARK_TEST_CASES.md` |
| Git | **No repository present** — the workspace is not under version control, so no `status`/`diff` was available to separate finished from in-progress work |
| Scope | Documentation only. No `src/` change, no API call, no backend, no data-shape change |

---

## 1. Purpose and scope

The workspace is where a seller turns a short product brief into publish-ready social copy. This
spec defines the **mobile-first** behaviour of that screen and the **content-first** behaviour of the
results it produces. It does **not** redesign the product; it locks the rules the current build is
already close to, and names the gaps.

In scope: journey, per-surface behaviour, breakpoints, touch/keyboard/viewport handling, the AI
results UX contract, and a check of the marketing brief's completeness.

Out of scope: implementing anything. No code, no Gemini call, no quota, no backend, no history
schema change. The Stage-2 code plan already lives in
[AI_SPECIFICATION.md §10](file:///Users/a/Desktop/Apps/CapAI/docs/ai/AI_SPECIFICATION.md#L716-L771);
this document only adds the *UX* conditions those changes must satisfy.

---

## 2. Product direction

**What CaptiVibe AI is.** An AI creative assistant that produces marketing content for products.

**Core value (verbatim, and the tie-breaker for every decision below):**

> "Giúp người làm marketing tạo nội dung tự nhiên, đúng thông tin sản phẩm, phù hợp nền tảng và
> gần như có thể đăng ngay mà không phải chỉnh sửa nhiều."

**The two priorities, in order:**

1. **Mobile-first.** The app must be genuinely good on a phone — a re-composed experience, not a
   shrunken desktop. A change that improves desktop at the cost of the 320–430px range loses.
2. **AI content quality.** The copy must read as if a marketer wrote it: natural, true to the
   brief, useful, and ready to post with little editing.

**Non-goals.** Not a dashboard. Not an analytics tool. Not a scheduling or publishing tool. The
score is a quality assessment of the copy, never a prediction of reach, engagement, conversion or
virality — this is a hard rule inherited from the AI contract and repeated in §6.

---

## 3. What exists today vs. what is only in the documents

Read this table before touching code. It is the boundary between "already built" and "described but
not built".

### 3.1 Shipped (present in the working tree)

| Area | Reality in the code |
|---|---|
| Shell | [App.tsx](file:///Users/a/Desktop/Apps/CapAI/src/App.tsx#L466-L535): `flex h-screen flex-col overflow-hidden`; a sticky `Header`, then a `<main>` that is a single scroll column below `lg` and a `lg:grid-cols-12` split (controls `5`, results `7`) from `lg` up |
| Header | [Header.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/Header.tsx): brand + subtitle (subtitle hidden under `sm`), EN/VI language segmented control, History button (label hidden under `sm`, count badge), theme toggle. Controls are 36–44px tall |
| Brief form | [ControlPanel.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/ControlPanel.tsx): product name (≤80), description (≤500), audience multi-select, free-text audience (≤150), tone single-select. Inline error summary + per-field errors |
| Images | [ImageDropzone.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/ImageDropzone.tsx): empty state is one large drop target; with photos, a `grid-cols-2` → `xs:grid-cols-3` gallery, pointer-event drag-reorder with a 44px handle, per-tile remove, "remove all", and a verbatim list of refused files |
| Generate | [ControlPanel.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/ControlPanel.tsx#L126-L135): full-width primary button, `disabled` while generating, label swaps to "Generating captions…" |
| Results toolbar | [ResultsPanel.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/ResultsPanel.tsx#L237-L300): one wrapping row; left = Preview/Results tabs, right = preview controls (platform menu + device toggle) **or** the results actions (Copy post, Undo, Regenerate all) |
| Score card | [ResultsPanel.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/ResultsPanel.tsx#L844-L925): a ring for `overall` plus three bars — `virality`, `cta`, `readability` — and a templated "AI Insight" sentence |
| Cards | Caption and headline cards are two-row: a compact metadata/action strip on top, the full text on its own line below; a "⋯" menu holds Copy / Edit / Regenerate / Undo; inline edit; a per-card "Preview" selection |
| Preview | [PhonePreview.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/PhonePreview.tsx): Instagram / Facebook / TikTok mockups, mobile phone frame + PC browser frame, fullscreen portal. Platform mockups use **hard-coded** colors, never semantic tokens |
| History | `HistoryDrawer` + `useHistory` — localStorage for text, IndexedDB for image Blobs (per project memory) |
| Platform | Local i18n `en`/`vi`, light/dark theme, `ErrorBoundary`, `NoticeStack` |

### 3.2 Documented only — NOT implemented

These appear in `docs/ai/*` (Stage 1 design) and are **not** in the code. Treat them as the target
state, and do not describe them as existing.

| Feature | Where it is specified | Current app |
|---|---|---|
| AI backend / Gemini call | [AI_SPECIFICATION.md §11](file:///Users/a/Desktop/Apps/CapAI/docs/ai/AI_SPECIFICATION.md#L772-L808) | None — generation is the local deterministic `generateContent` with a `setTimeout(650)` placeholder |
| AI-assigned scores + per-item `feedback` | AI_SPEC §4, §6 | Scores are heuristics (`scoreContent` etc.); there is **no** `feedback` field on a card |
| Per-item regeneration over the network | AI_SPEC §8.2 | Synchronous local bank rotation (`rotateInBank`) |
| `image_insights` | AI_SPEC §4 | Not present |
| `outputLanguage` request field | AI_SPEC §3.1, §12 (decision 2) | Not present; generated copy is hard-coded English |
| Post objective / goal field | Not yet specified — this doc §7 proposes it | Not present |
| Per-card loading on regenerate | AI_SPEC §10.2 | Not present |
| `notice.ai*` failure keys | AI_SPEC §9.1 | Not present (only `notice.generateFailed`) |

**Consequence for this spec:** the surfaces in §5 are written so that the Stage-2 additions
(per-card feedback, AI scores, per-card loading, new notices) drop into the *existing* card and
panel structure. No new panel, no new tab, no new colour.

---

## 4. The mobile-first journey

One linear path, usable one-handed, with no dead end.

| # | Step | Screen surface | Success signal |
|---|---|---|---|
| 1 | Open the app, enter the product brief | Header + Control panel (§5.1, §5.2) | Fields accept input; counters live; nothing clipped |
| 2 | Add photos and order them | Image gallery (§5.3) | Photos appear in a 2-up grid; drag handle reorders; refusals are explained |
| 3 | Choose audience, tone, and the post objective | Audience / Tone / Objective (§5.2) | Selection is visibly a *choice*, not a text field |
| 4 | Generate | Generate button + loading (§5.4) | Button locks; label changes; no double submit |
| 5 | Read, pick, edit, or regenerate one item | Results list + cards (§5.6, §5.7) | The chosen headline/caption drives the live preview; per-card re-roll keeps siblings intact |
| 6 | Preview across platforms | Preview (§5.8) | Instagram / Facebook / TikTok, mobile and PC, all render correctly in both themes |
| 7 | Copy the finished post | Master copy action (§5.5) | One tap copies headline + caption + selected tags, with a confirmation toast |

**Step 4 → 5 is the critical mobile hand-off.** Today, after a successful generation the code does
`setTab('results')`, but the results panel sits *below* the entire brief form in the single mobile
scroll column, so the first thing a phone user sees after tapping Generate is still the form. The
spec requires an explicit, visible transition into the results (§5.4). This is the single most
important mobile fix in this document.

---

## 5. Surface-by-surface UX specification

Each surface lists: what is correct today and must be preserved, and the mobile requirement to hold
the build to.

### 5.1 Header

- **Keep:** sticky top bar, brand block, language segment, history entry with count badge, theme
  toggle. Logo mark is 44px; icon buttons are 44px; the language segment is 36px tall.
- **Mobile requirements:**
  - The product name (`h1`) must stay on one line — it already uses `truncate`; keep it.
  - The subtitle is hidden under `sm` on purpose (space); keep that, so the bar never wraps to two
    rows at 320px.
  - The History button must keep a ≥44px touch target even when its text label is hidden. Its icon+
    padding currently meets this; a future change must not shrink it.
  - Total header height must not grow on mobile. A second row of controls is a regression.

### 5.2 Brief form (Control panel)

- **Keep:** field order (images → product name → description → audience → free text → tone), the
  inline error summary that focuses itself, the character counters with amber/red feedback, and
  `min-h-11` inputs.
- **Mobile requirements:**
  - Inputs sit inside one scroll region; do not nest a second scroller inside the form on mobile.
  - Labels must not wrap into the input; long labels use the existing stacked layout.
  - Every interactive control ≥44px tall (pills, tone buttons, audience pills).
  - The camera/photo affordance must be reachable without scrolling past a wall of text — images
    are first in the form already; keep it that way.
- **Proposed additions** (assessment and rationale in §7): a single-select **Post objective** and an
  optional **Extra brief details** field. Both optional, neither may lengthen the form into a
  questionnaire.

### 5.3 Image upload and gallery

- **Keep:** drop target as the empty state; `grid-cols-2` on phones that becomes 3 columns from
  400px (`xs`); pointer-event reorder that works identically for mouse and touch; a 44px numbered
  drag handle; per-tile remove; a verbatim refusal list.
- **Mobile requirements:**
  - Tiles are square (`aspect-square`) and never overflow their grid cell; the grid is already
    `grid-cols-2` at 320px, which is the safe minimum.
  - The reorder gesture must remain touch-friendly and must not fight the page scroll. The current
    handle uses `touch-none`; keep that so a drag does not scroll the page underneath.
  - The refusal notice must be readable on a phone: short, named, bilingual (§5.10).
  - Never require a long-press to reorder (discoverability + accessibility). Keyboard reorder via
    arrow keys already exists; keep it.

### 5.4 Generate button and loading state

- **Keep:** full-width primary button at the end of the form; `disabled` while generating; label
  change; the `submittingRef` guard that blocks a double submit.
- **Mobile requirements (the key change):**
  1. **Reach the results on success.** After a successful generation, the results must come to the
     user: either (a) scroll the results panel into view with a smooth scroll and move focus to its
     tab row/heading, or (b) on mobile, render the results panel *before* the form in document order
     once content exists. (b) is the more robust of the two and does not depend on a scroll
     animation finishing. Pick one and state it in the code PR.
  2. **Loading must be visible and honest.** The button keeps its in-place spinner/label; the
     results area, when empty, may show a skeleton, but the loading state must never leave a blank
     panel with no explanation.
  3. **The button must not be covered by the on-screen keyboard** (§8, viewport).
  4. A failed generation must leave the brief and any previous content untouched and return the
     button to its idle label (already enforced by `try/catch/finally`; preserve it).

### 5.5 Results toolbar and tabs

- **Keep:** one wrapping row; tabs on the left; on the Preview tab the platform menu + device
  toggle; on the Results tab the master **Copy post** action, **Undo**, and **Regenerate all**. The
  toolbar is deliberately `z-50` so the platform menu overlays the mockups.
- **Mobile requirements:**
  - The row wraps rather than clips; at 320px the clusters may go to two lines — that is acceptable
    and preferred over hiding actions.
  - "Copy post" is the primary action for step 7; keep it visually primary (solid indigo, white
    text — already `#4F46E5`/white). Do not demote it to a ghost button.
  - Do not add a third cluster to this row on mobile; it is already at its density limit.

### 5.6 Caption / Headline cards

- **Keep:** the two-row card (top = metadata + actions, bottom = the full text at the card's full
  width); index-stable `key`s so editing never blurs; the "⋯" actions menu with Copy, Edit,
  Regenerate-this, Undo-this; inline edit; the per-card "Preview this" selection; `break-words` so a
  long token can't overflow.
- **Mobile requirements:**
  - The text is the primary content; the metadata strip must never push it down the card.
  - The "⋯" trigger stays 44px. The menu opens as a right-anchored popover within the card; confirm
    it never runs off the left edge at 320px (*needs a live pass*).
  - Editing uses an auto-growing / fixed `rows` textarea inside the card; the page must not jump
    when a card enters edit mode.
  - Selection model: caption and headline selections are **independent** (already true). Keep it —
    choosing a hook must not swap the body copy.

### 5.7 AI score and feedback

- **Keep:** one ring for the overall figure (currently `overall` from the heuristic scorer), the
  per-card `n/100` badge, and the existing accessible labels (`role="img"`, `results.scoreAria`).
- **Requirements (content-first):**
  - Human-readable score = **AI quality assessment**. Never label any AI number "virality",
    "conversion" or "sales". See §6.
  - Each caption/headline card must eventually carry **one** `feedback` line of at most 120
    characters that names a single concrete change. It renders in the existing
    `text-xs text-muted-foreground` role, under the text.
  - Feedback must be **collapsible or secondary**, so the card does not become a wall of prose. The
    user reads the copy first; the assessment supports it. Recommended: one line, clamped, expand
    via the existing "read more" affordance pattern.
  - The legacy `virality` bar must be removed or re-purposed (it has no AI analogue). `cta` and
    `readability` map onto the closest rubric criteria. This is wording + mapping, not a redesign —
    the component keeps its name and shape ([AI_SPECIFICATION.md §6.2](file:///Users/a/Desktop/Apps/CapAI/docs/ai/AI_SPECIFICATION.md#L506-L516)).

### 5.8 Multi-platform preview

- **Keep:** all of it. The platform mockups are the product's showpiece.
- **Hard rules (from MASTER, restated because they are easy to break):**
  - Instagram and Facebook mockups are **always light**; the TikTok **phone** mockup is **always
    dark**; the TikTok **desktop** mockup is light. They ignore the app's `.dark` class.
  - Platform mockups in `PhonePreview.tsx` use **fixed colors only** — never a semantic token, never
    a `dark:` variant.
  - Engagement controls appear in exactly one place per view.
  - A fullscreen player shows the complete image (`object-contain`); cropping is allowed only in
    embedded mode.
- **Mobile requirements:**
  - The phone frame keeps `aspect-[9/18.5]`, a `min(680px, calc(100dvh - …))` height cap and a
    `max-w-[430px]` width, so it scales by height and never distorts or clips.
  - The reserved safe-area strip stays `h-3` (TikTok) / `h-6` (others) so the nav never sits under
    the Home Indicator.
  - The whole-post character counter is pinned **below** the mockup, outside its scroller; keep it
    visible at every breakpoint.
  - Do not introduce horizontal scrolling inside the preview column; the PC view already scales the
    desktop shell rather than reflowing it.

### 5.9 History

- **Keep:** drawer/portal, body scroll lock while open, restore of brief + copy + images, and the
  "images missing" notice when Blobs were evicted.
- **Mobile requirements:**
  - The drawer must be dismissible by a visible control and by Escape; the close control stays in a
    dedicated toolbar area (project convention) so it never overlaps content.
  - Restoring an entry is a navigation event: it sets the Results tab. On mobile, follow §5.4's
    "bring results into view" rule so a restore does not dump the user at the top of the form.
  - No change to the stored shape is permitted in this task (text in localStorage, Blobs in
    IndexedDB, `imageIds` only).

### 5.10 Error and empty states

- **Keep:** the `NoticeStack` channel (no `alert()`), the inline form error summary that receives
  focus, and bilingual, non-technical messages.
- **Mobile requirements:**
  - Notices must be legible in one line at 320px or wrap gracefully; they must not cover the
    Generate button or the results toolbar for long.
  - The results empty state (currently a dashed placeholder) must point the user to the Generate
    action; after §5.4's change it is the state a phone user is most likely to land on.
  - Every user-facing error is a short sentence in the active UI language; technical detail goes to
    the console only.

---

## 6. AI Results UX — content first, not decoration

The results surface exists to help the user **read and act on copy**. Metrics support that; they are
never the headline.

**Each caption / headline must offer, in the user's reach:**

1. The complete text, at full width, unclipped.
2. A quality score that is honestly an **AI quality assessment**.
3. One short, concrete, actionable remark.
4. Copy.
5. Edit.
6. Regenerate-this (independently).
7. Undo (independently).

**Rules:**

- The score is **not** "virality", not "conversion rate", not "sales ability". Do not put any of
  those words next to an AI number — in labels, tooltips, or ARIA text. This is the app-side
  expression of the AI contract's standing rule.
- Per-item feedback must never push the copy off-screen or turn a card into a report. Read the copy
  first; the assessment is a footnote you can expand.
- Regeneration of one item must not touch its siblings, must not create a history row, and must not
  clear the user's headline/caption selection.
- A failed regeneration keeps the previous text on screen and offers a retry without a reload.
- Do not add a per-metric table. One score per item, one remark per item.

---

## 7. Marketing brief — is it complete enough?

**Assessment.** The current form ([types.ts `ProductForm`](file:///Users/a/Desktop/Apps/CapAI/src/types.ts#L42-L52))
collects product name, description, audience (presets + free text) and tone. That is enough to
produce *plausible* copy, but it is thin on the two things that most affect "sát mục tiêu thực tế"
(close to the real objective):

- **What the post is for.** The form has no notion of the post's *objective* (introduce a product vs.
  share an existing offer vs. invite engagement). Copy written without it drifts generic.
- **Any hard facts the seller must include.** A required message, an actual promotion, or a desired
  CTA has nowhere to live today. The AI contract forbids inventing these, so if the seller has one
  and cannot state it, the copy must omit it — a real loss.

Note: the free-text **Custom target audience** field already exists and is *not* the same thing as an
objective or an offer; do not repurpose it.

**Recommendation — at most two additions, both optional:**

| # | Field | Type | Why | Notes |
|---|---|---|---|---|
| 1 | **Post objective** | single-select: `introduce` \| `engage` \| `promote` \| `educate` (final labels TBD) | Steers framing without turning the form into a quiz | Drives prompt intent; may map to the AI `strategy` emphasis |
| 2 | **Extra brief details** | optional free text, short cap | Carries a mandatory message, a real offer, or a CTA the seller wants used | Reuses the existing text-input pattern; hard cap like the other fields |

**Constraints on these additions:**

- Neither is required. A user who ignores both must still get a usable result.
- They must not add a screen of scrolling; place them after tone (objective) and near the description
  (extra details), not as a new section.
- Any offer text entered here is **data**, and the "no fabricated claims" rule still applies — the
  model may use the offer because the seller stated it, and only then.
- If added, the strings need both `en` and `vi` entries in [i18n.ts](file:///Users/a/Desktop/Apps/CapAI/src/lib/i18n.ts),
  and if persisted they touch history — which is a separate, deliberate decision (see §11).

---

## 8. Responsive, viewport and keyboard requirements

**Breakpoints to verify:** 320, 360, 375, 390, 430 (plus the existing `xs` = 400px, `sm` = 640,
`lg` = 1024). The application of these is a *static* read of the source; the rows marked *live pass*
must be confirmed in a real browser/emulator before release.

| # | Requirement | Status from static read |
|---|---|---|
| 1 | No horizontal overflow at 320–430 | Likely OK — shell uses `min-w-0`, cards use `break-words`, gallery is `grid-cols-2`. *Needs a live pass on long unbroken strings and long product names.* |
| 2 | No clipped buttons or sub-44px targets | Mostly OK — inputs `min-h-11`, icon buttons `size-11`, pills 44px. *Needs a live pass on the card "⋯" menu at 320px and the header at 320px.* |
| 3 | Keyboard must not cover the focused field or the Generate button | **At risk.** The shell is `h-screen` (100vh) with `overflow-hidden`; iOS does not resize 100vh when the keyboard opens, so a focused low field — or the Generate button — can sit under the keyboard. See the viewport fixes below. |
| 4 | Avoid nested scroll areas | Low risk — below `lg` the results panel does **not** create its own scroller (its `overflow-y-auto` is `lg:`-gated); the only inner scrollers are the phone mockup and the option menus. Keep it that way. |
| 5 | Bring the user to the results after success | **Missing today** — see §5.4. Required. |
| 6 | One-handed operation for primary actions | **Partial.** Generate is full-width but lives at the end of a long form; the header actions are top-right. Recommended: a sticky bottom CTA on mobile, or at minimum ensure the Generate button is reachable without scrolling past the whole form. |
| 7 | Consistency across Android and iOS | Use `dvh` units, `env(safe-area-inset-*)`, and avoid iOS-only or Android-only hacks. Keep `-webkit-font-smoothing`. |
| 8 | Safe area + viewport handling | **Gap found.** [index.html](file:///Users/a/Desktop/Apps/CapAI/index.html#L6) sets `width=device-width, initial-scale=1.0` — it lacks `viewport-fit=cover` (so any `env(safe-area-inset-*)` would resolve to 0) and lacks `interactive-widget=resizes-content` (the Chrome-for-Android hint that helps the keyboard resize the layout). Recorded as a required implementation change in §10; **not** applied in this task. |

**Viewport recommendations (to be applied with the mobile fix, not now):**

- Prefer `100dvh` over `100vh` for the app shell so mobile browser toolbars don't clip the layout.
- Add `viewport-fit=cover` **only when** a real `env(safe-area-inset-*)` is consumed; until then it
  changes nothing. The stage-safe approach is to add it together with the safe-area usage.
- Add `interactive-widget=resizes-content` to the viewport meta (progressive; ignored elsewhere).
- Any use of `env(safe-area-inset-*)` must be paired with the `viewport-fit=cover` change above, or
  the inset is always 0 and the layout silently reverts to today's behaviour.
- Tailwind `calc` values must keep the underscore form (`calc(100dvh_-_... )`) — project convention.

---

## 9. Design system and preview integrity

**Follow [MASTER.md](../MASTER.md).** The Master's rules that this page is most likely to break:

- Components outside platform mockups use **semantic tokens only** (`bg-card`, `text-foreground`,
  `border-border`). No raw palette colors, no decorative gradients.
- **No `backdrop-blur` on anything that scrolls.** This page has several scroll regions; keep
  surfaces opaque.
- One indigo accent for state; `amber`/`emerald` only for length/limit feedback.
- No layout-shifting hover on panels or list rows.
- Lucide icons only, never emoji-as-icon. `cursor-pointer` on everything clickable. Visible focus
  rings. `prefers-reduced-motion` respected.
- `PhonePreview.tsx` is the **one** place allowed to hard-code colors, and never a semantic token or
  a `dark:` variant inside a mockup.

**Path consistency fix applied.** MASTER.md's page-logic header previously pointed at
`design-system/pages/[page-name].md`, which does not exist. It now points at
`design-system/captivibe-ai/pages/[page-name].md`, matching this file's real location and the
convention `design-system/<project-slug>/pages/`.

**Do not break the existing mockups.** Any change to the card or toolbar must be re-checked against
all six preview states: Instagram mobile/desktop, Facebook mobile/desktop, TikTok mobile/desktop, in
both app themes.

---

## 10. Implementation deltas — what stays, what changes

Documentation-only summary; the code plan itself is
[AI_SPECIFICATION.md §10](file:///Users/a/Desktop/Apps/CapAI/docs/ai/AI_SPECIFICATION.md#L716-L769).

### Stays exactly as it is

- The shell layout, Header, control-panel field order, image gallery + reorder, tone/audience
  pickers, character counters and inline validation.
- The results toolbar composition, the two-row card structure, the "⋯" actions menu, inline edit,
  per-card preview selection, hashtag toggles + master copy.
- All six platform mockups and their fixed palettes.
- History storage shape (localStorage text + IndexedDB Blobs, `imageIds`), and its restore flow.

### Changes when the mobile / Stage-2 work is implemented (not now)

| # | Change | Surface | Why |
|---|---|---|---|
| 1 | Bring results into view on success (scroll-into-view **or** results-before-form on mobile) | App / Results | §5.4, §8 row 5 |
| 2 | Mobile viewport: prefer `dvh`, add `viewport-fit=cover` **iff** safe-area insets are used, add `interactive-widget=resizes-content` | `index.html`, shell | §8 rows 3, 8 |
| 3 | Optional sticky bottom Generate CTA on mobile | Control panel | §8 row 6 |
| 4 | Per-card `feedback` line (≤120 chars, secondary, clampable) | Card | §6 |
| 5 | Per-card loading on regenerate (existing `RotateCw` + `animate-spin`) | Card | §6 |
| 6 | Score ring reads the AI score; retire/re-purpose the `virality` bar | Score card | §6, AI_SPEC §6.2 |
| 7 | New `notice.ai*` failure keys in **both** `en` and `vi` | i18n | AI_SPEC §9.1 |
| 8 | Add Post objective + Extra brief details (optional) | Brief form | §7 |
| 9 | Any user-visible string added in both languages | i18n | project convention |

**None of the above is implemented in this task.**

---

## 11. Open product decisions (need a human call)

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | Post-success navigation on mobile | Smooth-scroll to results **vs** reorder results above the form once content exists | Reorder — deterministic, no dependence on a scroll animation, works with a screen reader |
| 2 | The `virality` bar | Remove it **vs** re-purpose it | Remove or re-purpose; an AI quality score must not be labelled "virality" |
| 3 | Where feedback appears | One clamped line under the text **vs** replacing the templated insight sentence **vs** both | Per-card clamped line for AI content; keep the card short |
| 4 | Are Objective / Extra-details persisted to history? | Persist **vs** session-only | Persist only if cheap and backward-compatible; otherwise session-only for the first release |
| 5 | Is the post objective a new field or folded into an existing one? | New single-select **vs** reuse tone/audience | New field — tone and objective are orthogonal |
| 6 | Sticky mobile CTA | Yes **vs** no | Yes if it does not cover the last field or the keyboard |

---

## Appendix A — AI contract issues to resolve (recorded, NOT fixed here)

These are real inconsistencies found while reading `docs/ai/*`. **None is fixed, and none may be
reported as fixed.** They are listed so a later task can close them deliberately. Each is grounded
in a specific citation.

| # | Issue | Evidence | Why it matters | Suggested resolution (proposal only) |
|---|---|---|---|---|
| A-1 | **8 MB request cap contradicts the 20 MB image budget** | [AI_SPECIFICATION.md §3.3](file:///Users/a/Desktop/Apps/CapAI/docs/ai/AI_SPECIFICATION.md#L217) caps the whole body at 8 MB; `IMAGE_LIMITS.maxTotalBytes` is 20 MB in [limits.ts](file:///Users/a/Desktop/Apps/CapAI/src/lib/limits.ts) | A user can legally assemble 20 MB of photos the backend is told to reject | Decide one number. Either raise the body cap to ≥20 MB, or lower the upload budget — one source of truth, mirrored on both sides |
| A-2 | **G-01 uses an empty description that the validator forbids** | [BENCHMARK_TEST_CASES.md G-01 note](file:///Users/a/Desktop/Apps/CapAI/docs/ai/BENCHMARK_TEST_CASES.md#L112-L115) says the field must be padded and the backend "should accept it or return `invalid_description`"; [AI_SPECIFICATION.md §3.3](file:///Users/a/Desktop/Apps/CapAI/docs/ai/AI_SPECIFICATION.md#L211-L217) requires trimmed length 1–500 | The case is not reproducible as written, so its score cannot be compared across rounds | State explicitly whether the backend accepts an empty description (and adapts) or returns a 400. Make the code match |
| A-3 | **The fabricated-content rule is stated three different ways, and a referenced section does not exist** | PROMPTS.md references "AI_SPECIFICATION.md §5.4" four times ([one](file:///Users/a/Desktop/Apps/CapAI/docs/ai/PROMPTS.md#L350), [two](file:///Users/a/Desktop/Apps/CapAI/docs/ai/PROMPTS.md#L513), [three](file:///Users/a/Desktop/Apps/CapAI/docs/ai/PROMPTS.md#L560)) and OUTPUT_SCHEMA.json twice ([caption](file:///Users/a/Desktop/Apps/CapAI/docs/ai/OUTPUT_SCHEMA.json#L74), [headline](file:///Users/a/Desktop/Apps/CapAI/docs/ai/OUTPUT_SCHEMA.json#L105)) — but AI_SPECIFICATION §5 has only 5.1–5.3 | Either the gate is a hard rejection (PROMPTS/OUTPUT_SCHEMA/BENCHMARK treat it as pass/fail) or it is "not a gate" (AI_SPEC §5.1). Both are asserted | Add the missing §5.4 that defines the factual gate, and make §5.1, §5.3, PROMPTS §3/§7 and BENCHMARK §3 agree on one behaviour (reject vs. prompt-only) |
| A-4 | **The canonical example contains a usage-frequency detail the brief never gave** | [OUTPUT_SCHEMA.json `examples[0].headlines[2]`](file:///Users/a/Desktop/Apps/CapAI/docs/ai/OUTPUT_SCHEMA.json#L180): "…một bước chăm sóc **mỗi ngày**" — "daily", while the B-01 brief says only "brightens … in 7 days" | The reference example itself violates the model's own "no detail the brief doesn't support" rule, so it teaches the wrong behaviour and can't be used as a benchmark oracle as-is | Remove the cadence word (e.g. "…một bước chăm sóc cho làn da") so the example is fully traceable to the brief |
| A-5 | **Shared vs. platform-optimised captions is undecided** | The contract takes a single `platformHint` ([AI_SPEC §3.1](file:///Users/a/Desktop/Apps/CapAI/docs/ai/AI_SPECIFICATION.md#L150)) while the rubric scores "purpose and platform suitability" ([AI_SPEC §6.1](file:///Users/a/Desktop/Apps/CapAI/docs/ai/AI_SPECIFICATION.md#L459-L466)); the app generates **one** caption set reused across all previews | Users don't know if a TikTok preview shows a caption written for TikTok; limits and hook style differ per platform | Decide and document: one shared set tuned to a default platform, **or** per-platform variants. Whatever is chosen, the UI must say which |
| A-6 | **Default output language vs. interface language is unresolved** | Output defaults to `vi` ([AI_SPEC §3.1](file:///Users/a/Desktop/Apps/CapAI/docs/ai/AI_SPECIFICATION.md#L149)); the UI's `loadLanguage` defaults to **`en`** ([AI_SPEC §2.3 row 4](file:///Users/a/Desktop/Apps/CapAI/docs/ai/AI_SPECIFICATION.md#L97), §12 decision 2); today's generated copy is hard-coded English | A Vietnamese-default output with an English-default UI is a surprising mix; the UI must be deliberate | Open decision 2 stands: either follow the interface language, give output its own persisted setting, or default both to `vi`. Whichever is chosen, state it in the UI or in a setting |

---

## Appendix B — References

- Master: [MASTER.md](../MASTER.md)
- AI contracts: [AI_SPECIFICATION.md](file:///Users/a/Desktop/Apps/CapAI/docs/ai/AI_SPECIFICATION.md), [PROMPTS.md](file:///Users/a/Desktop/Apps/CapAI/docs/ai/PROMPTS.md), [OUTPUT_SCHEMA.json](file:///Users/a/Desktop/Apps/CapAI/docs/ai/OUTPUT_SCHEMA.json), [BENCHMARK_TEST_CASES.md](file:///Users/a/Desktop/Apps/CapAI/docs/ai/BENCHMARK_TEST_CASES.md)
- Key source: [App.tsx](file:///Users/a/Desktop/Apps/CapAI/src/App.tsx), [ControlPanel.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/ControlPanel.tsx), [ResultsPanel.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/ResultsPanel.tsx), [PhonePreview.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/PhonePreview.tsx), [Header.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/Header.tsx), [types.ts](file:///Users/a/Desktop/Apps/CapAI/src/types.ts), [i18n.ts](file:///Users/a/Desktop/Apps/CapAI/src/lib/i18n.ts), [index.html](file:///Users/a/Desktop/Apps/CapAI/index.html)
