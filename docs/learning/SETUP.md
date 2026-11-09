# CaptiVibe Learning Center — setup guide

This source includes optional Google sign-in, Admin-managed Global DNA, and separate personal/community inspiration scaffolding. Global DNA is a single Admin-owned style profile used by every user. Approved Inspiration Cards and community-learning integration into Generate remain a separate later project step. Guest users can still generate content; Google sign-in is only required for Admin/account features.

## 1. Environment variables

Copy `.env.example` to `.env`. Keep `OPENAI_API_KEY` and `OPENAI_MODEL_ID=gpt-6-luna` on the server, then fill these values from Supabase → Project Settings → API:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

The browser key is a publishable/anon key and is expected to be public. Never add a Supabase `service_role` or secret key to a `VITE_` variable, commit it, or paste it into the browser. There is no public sign-up form; users can sign in with Google, while admin status is assigned separately through `admin_roles`.

The backend verifies the Supabase access token with `/auth/v1/user` and checks the caller's `admin_roles` row under RLS. This MVP does not need a service-role key.

## 2. Create the tables and RLS policies

Open Supabase → SQL Editor and run both migration files in order:

1. `supabase/migrations/001_learning_auth.sql`
2. `supabase/migrations/002_global_dna.sql`

Migration 001 creates:

- `admin_roles`
- `learning_references`
- `learning_patterns`
- row-level security policies for legacy global, personal and admin learning data

Migration 002 creates:

- `global_dna_sources`: exactly ten Admin-owned seed slots, private to Admins
- `global_style_profiles`: versioned compact Global DNA records (`draft`, `active`, `archived`)
- Admin-only RPCs for creating a draft version and atomically activating it
- RLS that lets Generate read only the active profile, while drafts/sources stay Admin-only

Do not disable RLS.

## 3. Configure Google OAuth

1. In Google Cloud Console, create or select a project.
2. Configure Google Auth Platform / OAuth consent screen.
3. Create an OAuth Client ID with application type **Web application**.
4. Add your app origin to **Authorized JavaScript origins**. For local development add `http://127.0.0.1:5173` and/or `http://localhost:5173` depending on the address used in the browser.
5. In Supabase → Authentication → Providers → Google, enable Google and paste the OAuth Client ID and Client Secret.
6. Copy the Supabase callback URL shown on that page into the Google OAuth client's **Authorized redirect URIs**. It usually resembles `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
7. In Supabase → Authentication → URL Configuration, set the Site URL and add the local and production app URLs to Redirect URLs.

The client uses Supabase OAuth PKCE and redirects back to the app origin. Supabase handles Google identity; CaptiVibe does not request access to a user’s Google Drive, Gmail or other Google APIs.

## 4. Bootstrap the first admin

1. Start the app and sign in with Google once from the public app.
2. In Supabase SQL Editor, run this statement with the exact Google email you intend to administer:

```sql
insert into public.admin_roles (user_id)
select id from auth.users where lower(email) = lower('YOUR_ADMIN_EMAIL@example.com')
on conflict (user_id) do nothing;
```

3. Reload the app. The Admin button should appear in the header.
4. Visit `/admin` to open the Developer Learning Center.

Admin roles can only be added or removed with SQL / trusted server tooling. The app intentionally has no public admin registration flow.

## 5. Local development

Use Node.js 22.12 or newer as required by this source package:

```bash
npm install
npm run dev
```

The `dev` script starts the Vite client and Node API server. Restart it after changing `.env`.

## 6. Global DNA and the separate learning features

### CaptiVibe Global DNA (implemented in this step)

1. Sign in as an Admin and open `/admin`.
2. In **CaptiVibe Global DNA**, fill the ten Admin reference-post slots. Paste the actual caption/post text; URL-only references are not fetched.
3. Save the ten posts, then choose **Analyze & create DNA draft**. The backend verifies the Admin session, reads the ten rows from `global_dna_sources`, and sends all ten together in one GPT request.
4. Review the compact profile preview. The analysis creates a `draft`; it does not change live generation.
5. Choose **Activate this version** to make it the single active profile for all users. The previous active version is archived. Later updates create a new version and require a new explicit activation.

The ten seed posts are system assets supplied by the project Admin. They are stored separately from `learning_references` and community submissions. The model extracts only reusable style traits (voice, hooks, rhythm, emoji habits, persuasion and CTA patterns); it must not transfer product facts, names, claims, prices or guarantees from the examples.

Generate uses the active profile from a server-side in-memory cache. The cache is warmed before the API starts accepting requests and has a five-minute TTL. When the TTL expires, the next Generate uses the last cached profile immediately while triggering a background refresh; Admin activation explicitly refreshes the cache before the activation request completes. A normal Generate request does not wait for a Supabase lookup. If Supabase is unavailable or there is no active profile, Generate continues without DNA.

### Existing reference / personal / community scaffolding (separate from DNA)

- The legacy developer-reference and pattern tables are not the ten Global DNA seed posts and cannot change the Global DNA profile.
- A signed-in user can create a personal inspiration reference. It remains scoped to that user.
- Community contributions remain pending until Admin review. They do not update Global DNA.
- Approved Inspiration Cards and their code-only selection during Generate are a separate later step; do not mix these records into the Global DNA source set.

## 7. URL access limitations

The current reference-analysis request does not fetch URLs. Paste the caption or visible text into the reference form; a URL is stored as provenance only. The app does not claim a page was analyzed unless post text was actually supplied.

## 8. Privacy and safety notes

- Guest users can still use the existing Generate flow; Google login is optional.
- Global DNA sources and draft versions are Admin-only; all users can use only the active compact DNA profile.
- Personal patterns are only selectable by their owner under RLS.
- Community references are not globally usable until approved and analyzed in the separate Inspiration Library workflow.
- Only abstract style patterns should be reused. Do not copy source captions verbatim or treat source marketing claims as facts about a new product.
- `OPENAI_API_KEY` remains server-side. `SUPABASE_SERVICE_ROLE_KEY` is not used in this MVP.
- Add CAPTCHA and stronger abuse controls before opening public community submissions at scale. The current API request limiter is process-local and intended as a starting guard, not a production abuse-prevention system.

## 9. Current MVP limitations

- Guest history remains local to the browser. Cloud history sync is not part of this learning/auth milestone.
- Personal inspiration requires sign-in; Guest Generate remains available.
- Admin role bootstrap is manual SQL, by design.
- There is no community leaderboard or public profile system.
