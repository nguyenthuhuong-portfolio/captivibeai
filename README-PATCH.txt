CAPTIVIBE AI — LEARNING SYSTEM PATCH
====================================

This patch adds:
- Optional Google login for public users (Guest can still Generate).
- Admin-only Developer Learning Center at /admin.
- Supabase PostgreSQL schema + Row Level Security policies.
- Personal inspiration storage for signed-in users.
- Community submissions with explicit consent and admin moderation.
- GPT-6 Luna reference analysis based on user-pasted post text (URL stored as provenance only).
- Stored learning patterns are not yet injected into Generate; this integration is deferred to the later DNA/learning phase.
- Generate uses one OpenAI GPT-6 Luna request; on failure, the existing Local Generator supplies clearly labelled mock/sample content. No Gemini or second GPT model is called.

SAFE MERGE
----------
1. Make a backup or Git commit of your current project.
2. Unzip this archive directly into the project root and allow overwriting files listed in the archive. The ZIP entries are already relative to the project root.
3. This patch intentionally DOES NOT include src/components/PhonePreview.tsx or
   src/components/Header.tsx, so your mobile/preview changes in those files remain untouched.
4. It DOES update src/App.tsx, src/main.tsx, package.json and backend files.
   If you have local edits in those particular files after the last source export,
   review/merge them before overwriting.
5. Do NOT copy any .env file from another source. This archive contains only .env.example.

SETUP
-----
1. Run: npm install
2. Create/update .env using .env.example. Set OPENAI_API_KEY and
   OPENAI_MODEL_ID=gpt-6-luna. Fill all four Supabase values:
   VITE_SUPABASE_URL=your Supabase project URL
   VITE_SUPABASE_ANON_KEY=your publishable/anon key
   SUPABASE_URL=same project URL
   SUPABASE_ANON_KEY=same publishable/anon key
3. In Supabase SQL Editor, run:
   supabase/migrations/001_learning_auth.sql
4. Configure Google OAuth in Google Cloud Console and enable Google provider in
   Supabase Authentication. Add the Supabase callback URL shown by Supabase to
   Google's Authorized redirect URIs. Add localhost / production site URLs to
   Supabase URL Configuration.
5. Start the app and sign in once using the Google account that should be Admin.
6. In Supabase SQL Editor, grant that account Admin role (replace email):
   insert into public.admin_roles (user_id)
   select id from auth.users where lower(email)=lower('admin@example.com')
   on conflict (user_id) do nothing;
7. Reload and open /admin.
8. Run: npm test && npm run build

SECURITY
--------
- Never put a Supabase service_role/secret key into VITE_* variables.
- The browser may use only the publishable/anon key with RLS enabled.
- Keep OPENAI_API_KEY server-side; do not commit .env.
- Admin is granted only through admin_roles. Do not expose admin insertion UI.
- Personal patterns are scoped to auth.uid(). Community patterns are global only
  after explicit consent and admin approval.

CURRENT MVP LIMITATIONS
-----------------------
- Guest users can Generate; personal saving,
  community submissions and admin features require Google sign-in.
- Guest history remains local. Cloud history sync is not part of this patch.
- Personal knowledge is stored per account; the user can sync it across devices
  by signing into the same Google account.
- This patch does not add a service_role key or production CAPTCHA. Add persistent
  rate limits/abuse protection before opening public submissions at scale.
- The current reference analyzer does not fetch social URLs. Paste the caption/text manually; a URL is stored only as provenance and is not treated as analyzed content.

VALIDATION IN THIS BUILD ENVIRONMENT
------------------------------------
- Node syntax checks passed for server/*.mjs and scripts/*.mjs.
- TypeScript/TSX syntax transpilation passed for 50 source files.
- Full npm build and Vitest suite were not run because npm install timed out in the
  packaging environment. Run npm install, npm test and npm run build on your Mac.
