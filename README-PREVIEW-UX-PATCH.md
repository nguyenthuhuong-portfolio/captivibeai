# CaptiVibe – Preview UX Patch

This patch updates the current CaptiVibe 2.0 Preview Studio and Phone Preview.

## Changes

1. TikTok Mobile Preview no longer displays left/right arrow buttons on any viewport. The mobile-screen renderer keeps horizontal touch swipe and mouse drag navigation.
2. Instagram Mobile Preview supports horizontal touch swipe and mouse drag on its media area. On a real phone, the image arrows are hidden; desktop browser mobile mockups keep their hover arrows.
3. The character counter now has a localized label (`Ký tự` / `Chars`) and is grouped immediately beside the close button in the Preview Studio toolbar.
4. PC Preview fullscreen on a real phone uses a shorter 540px reference canvas, a 28px browser/domain bar and a slightly narrower URL pill. The width/height fit still prevents the whole canvas from spilling outside the screen.
5. A scoped `phone-desktop-readable` style increases text and icon sizes and trims excess padding only in PC fullscreen viewed on a real phone. It does not affect normal desktop previews or the mobile social feed previews.
6. The phone fullscreen PC canvas has an internal vertical scroller for long post content; the Preview Studio and page behind it remain locked.

## Files included

- `src/components/PhonePreview.tsx`
- `src/components/PhonePreview.test.tsx`
- `src/components/PreviewStudio.tsx`
- `src/index.css`
- `src/lib/i18n.ts`

No `.env`, API key, Supabase secret, backend provider or database migration is included.

## Install

Run from the project root (the folder containing `package.json`) after making a backup:

```bash
 ditto . "../CaptiVibe backup - Before Preview UX Patch"
 unzip -o ~/Downloads/CaptiVibe-Preview-UX-Patch.zip
 npm run build
 npm test
 npm run dev
```

## Validation performed in packaging environment

- TypeScript/TSX syntax transpilation passed for all four changed TypeScript files.
- Node syntax is not affected; no server files are changed.
- Full Vite build and Vitest were not run because project dependencies are not installed in this environment.
