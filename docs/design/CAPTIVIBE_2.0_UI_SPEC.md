# CaptiVibe 2.0 — Focused Creative Workspace

## Product decisions

- Main workspace: two top-level tabs, **Inputs** and **Results**.
- Default tab on a fresh visit: **Inputs**.
- After a valid Generate request begins, switch to **Results** and show the in-flight state. A successful generation or local fallback leaves the user on Results.
- Restoring an item from History switches to Results.
- Results is divided into three inner tabs: **Captions**, **Headlines**, and **Hashtags**. The content score/audit remains visible above these tabs.
- Preview Studio is a full-viewport overlay on both desktop and mobile.
- The Preview Studio can be opened from both the global Header and Results toolbar.
- Preview Studio has platform controls (Facebook / Instagram / TikTok) and device controls (Mobile / Desktop).
- Closing Preview Studio preserves platform, device, selected caption, selected headline, and selected hashtags.
- Admin and Learning Center remain a separate restricted route at `/admin`.

## Information architecture

1. App Header
   - Brand mark and product name.
   - Preview Studio action.
   - History action with count.
   - Compact Google sign-in / sign-out action.
   - More menu: language, theme, Inspiration, Admin (only for admins).
2. Main Workspace
   - Inputs tab: existing ControlPanel and all existing validation/upload behavior.
   - Results tab: audit score + inner result tabs + copy/undo/regenerate actions.
3. Preview Studio overlay
   - Dedicated full-viewport layer with safe-area padding.
   - Toolbar: title, platform selector, device selector, close action.
   - Canvas: existing PhonePreview renderer; no rewrite of the platform-specific preview screens.
4. Separate routes and drawers
   - HistoryDrawer remains available from Header.
   - CommunityContributionDialog remains available from More → Inspiration.
   - AdminDashboard remains at `/admin` and keeps its existing authentication guard.

## Responsive behavior

### Desktop
- One centered workspace column with a comfortable maximum width.
- Inputs and Results are mutually exclusive tabs, not side-by-side columns.
- Header stays on one row; non-primary actions are grouped in More.
- Preview Studio covers the viewport and uses the existing desktop/mobile preview selectors.

### Mobile
- Header stays on one compact row.
- Inputs / Results tabs are horizontally arranged above the current workspace content.
- Form and results use the document as the vertical scroll container; no nested fixed-height panel scrollers.
- Preview Studio covers the usable viewport, respects safe-area insets, locks background scrolling, and closes with its close button or Escape when supported.
- Preview interactions (image swipe / drag, mock phone frame rules, PC preview scaling) remain owned by the existing PhonePreview implementation.

## State ownership

`App` owns:
- workspace tab (`inputs | results`)
- Preview Studio open/closed state
- form and images
- generated content and regeneration / undo state
- selected caption/headline/hashtags
- preview platform and device

`ResultsPanel` owns only transient presentation state:
- selected inner result tab (`captions | headlines | hashtags`)
- card edit/menu state
- copy acknowledgement toast

`PreviewStudio` owns only overlay lifecycle behavior (Escape handling and body-scroll lock). It receives preview data and controls from App.

## Non-goals / preservation rules

- Do not rewrite `PhonePreview.tsx` or platform-specific social mockups as part of the workspace redesign.
- Do not change the active OpenAI GPT provider, prompt contract, output schema, image storage, history persistence, Supabase auth, Learning System migrations, or `.env` values.
- Do not change platform character limits or upload limits.
- Do not remove existing regenerate, per-item edit, undo, hashtag selection, history restore, or fallback behavior.

## Acceptance checklist

- Fresh app opens on Inputs.
- Generate switches to Results and shows the loading state while the request is running.
- Successful Gemini output and local fallback both remain on Results.
- Results subtabs show exactly one content group at a time, while score/audit remains visible.
- Open Preview works from Header and Results toolbar.
- Preview Studio fills the viewport at desktop and mobile breakpoints.
- Switching platform/device in Preview Studio updates the existing PhonePreview.
- Closing Preview Studio preserves the selected platform/device and content variant.
- Header has one row at 320px, 375px, tablet, and desktop widths.
- Vietnamese and English labels are complete for newly introduced UI.
- No regressions in Gemini, History, Undo, image management, Auth, or Learning features.
