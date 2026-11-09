CAPTIVIBE AI - UI POLISH PATCH

Files included:
- src/App.tsx
- src/components/Header.tsx
- src/components/AccountAccessBar.tsx
- src/components/CommunityContributionDialog.tsx
- src/pages/AdminDashboard.tsx
- src/lib/i18n.ts
- src/index.css

What this patch changes:
1. Moves account actions into the main Header; removes the separate second account toolbar.
2. Keeps the header to one compact row on phone/tablet. Inspiration and Admin are available in the More menu; the sign-in/sign-out action remains visible.
3. Shows full account labels and Inspiration/Admin actions inline on wide screens.
4. Adds pointer cursors to enabled buttons, links, menu controls and labels; disabled buttons use not-allowed.
5. Fixes primary button foreground classes to use the project's existing `text-on-primary` design token, so blue buttons have white text.
6. Adds Vietnamese and English translations for account actions, the Inspiration dialog and the Learning Center.

Install:
1. Back up your current project first.
2. Extract this ZIP into the project root (the folder containing package.json).
3. Allow overwriting the listed files.
4. Run `npm run dev` and test both VI and EN using the language selector.
5. Run `npm run build` before deploying.

Important:
- This patch is based on the Learning System patch/source snapshot previously shared in this conversation.
- It does not include PhonePreview.tsx, Header-independent preview logic, server files, .env, or API keys.
- If you have made newer manual edits to App.tsx, Header.tsx, CommunityContributionDialog.tsx or AdminDashboard.tsx after installing the Learning System patch, back them up and compare before overwriting.
