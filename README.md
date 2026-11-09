# CaptiVibe Phone Preview Refinement

Patch for the current CaptiVibe 2.0 source.

## Changes

1. TikTok mobile preview now uses the same standard handset frame as the other PC mobile-preview mockups (9px border, standard rounded corners and shadow). The previous slim 3px TikTok-only frame is removed.
2. On a real phone viewport, TikTok's mobile handset is allowed to grow up to 920px and its height is calculated from the available small viewport after subtracting the actual top/bottom safe-area insets and the 57px Preview Studio toolbar. This avoids a fixed reserve that left unused space.
3. Responsive social-preview typography is increased modestly across Facebook, Instagram and TikTok while retaining `clamp()` bounds and the older-browser fallback.
4. TikTok image navigation is restored:
   - Horizontal swipe on touch devices.
   - Horizontal mouse drag in desktop browsers when viewing TikTok Mobile Preview.
   - Always-visible left/right arrow buttons when there are multiple images.
   - Pointer capture helps complete a drag if the pointer/finger moves outside the preview surface.
   - Arrow buttons do not trigger swipe handling; the right arrow is moved away from TikTok's action rail.
5. Added/updated tests for the standard frame, available phone height, visible arrows and horizontal swipe navigation.

## Files in this patch

- `src/components/PhonePreview.tsx`
- `src/components/PhonePreview.test.tsx`
- `src/index.css`

No `.env`, API keys, Supabase configuration, backend files, `PreviewStudio.tsx`, or other platform renderers are included.

## Install

Run from the CaptiVibe project root after making a backup:

```bash
unzip -o ~/Downloads/CaptiVibe-Phone-Preview-Refinement.zip
npm run build
npm test
npm run dev
```

The patch is intended for the latest CaptiVibe 2.0 source that already includes the previous Phone Adaptive patch. It should not be applied to an older source snapshot without comparing the affected files first.

## Validation performed here

- TypeScript/TSX syntax transpilation passed for both changed `.tsx` files.
- Full `npm run build` and `npm test` were not run because dependencies are not installed in this packaging environment.
