-- CaptiVibe Global + Personal Learning, Google Auth and Admin-only moderation.
-- Run once in Supabase SQL Editor. The frontend only uses the publishable/anon key.

create extension if not exists pgcrypto;

create table if not exists public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.learning_references (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references auth.users(id) on delete set null,
  source_type text not null check (source_type in ('developer', 'community', 'personal')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  title text not null check (char_length(title) between 1 and 120),
  source_url text check (source_url is null or (source_url like 'https://%' and char_length(source_url) <= 2048)),
  platform text not null default 'all' check (platform in ('instagram', 'tiktok', 'facebook', 'x', 'all')),
  category text not null default 'general' check (category in ('general', 'beauty', 'fashion', 'food', 'technology', 'lifestyle', 'education')),
  reference_text text check (reference_text is null or char_length(reference_text) <= 12000),
  consent_to_global boolean not null default false,
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reference_has_source check (coalesce(length(trim(source_url)), 0) > 0 or coalesce(length(trim(reference_text)), 0) > 0)
);

create table if not exists public.learning_patterns (
  id uuid primary key default gen_random_uuid(),
  reference_id uuid not null references public.learning_references(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  scope text not null check (scope in ('global', 'personal')),
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  title text not null check (char_length(title) between 1 and 120),
  platform text not null default 'all' check (platform in ('instagram', 'tiktok', 'facebook', 'x', 'all')),
  category text not null default 'general' check (category in ('general', 'beauty', 'fashion', 'food', 'technology', 'lifestyle', 'education')),
  pattern jsonb not null,
  quality_score integer not null default 50 check (quality_score between 0 and 100),
  created_at timestamptz not null default now(),
  constraint personal_pattern_owner check ((scope = 'global' and user_id is null) or (scope = 'personal' and user_id is not null))
);

create index if not exists learning_references_status_created_idx on public.learning_references(status, created_at desc);
create index if not exists learning_references_submitter_idx on public.learning_references(submitted_by, created_at desc);
create unique index if not exists learning_patterns_reference_scope_uidx on public.learning_patterns(reference_id, scope);
create index if not exists learning_patterns_global_lookup_idx on public.learning_patterns(scope, status, platform, category, quality_score desc);
create index if not exists learning_patterns_user_lookup_idx on public.learning_patterns(user_id, status, platform, category, quality_score desc);

alter table public.admin_roles enable row level security;
alter table public.learning_references enable row level security;
alter table public.learning_patterns enable row level security;

-- A signed-in user can see only their own admin row. There are intentionally no client-side
-- INSERT/UPDATE/DELETE policies for admin_roles; bootstrap admins with SQL (see setup guide).
drop policy if exists "admins can read own role" on public.admin_roles;
create policy "admins can read own role" on public.admin_roles
  for select to authenticated using (user_id = (select auth.uid()));

-- Approved global references are visible to everyone; submitters see their own pending items;
-- admins can review all rows.
drop policy if exists "read approved and own references" on public.learning_references;
create policy "read own or admin references" on public.learning_references
  for select to authenticated using (
    submitted_by = (select auth.uid())
    or exists (select 1 from public.admin_roles ar where ar.user_id = (select auth.uid()))
  );

drop policy if exists "submit own references or admin developer references" on public.learning_references;
create policy "submit own references or admin developer references" on public.learning_references
  for insert to authenticated with check (
    (
      source_type = 'community' and status = 'pending'
      and submitted_by = (select auth.uid()) and consent_to_global = true
    )
    or (
      source_type = 'personal' and status = 'approved'
      and submitted_by = (select auth.uid()) and consent_to_global = false
    )
    or (
      source_type = 'developer'
      and exists (select 1 from public.admin_roles ar where ar.user_id = (select auth.uid()))
    )
  );

drop policy if exists "admin manages references" on public.learning_references;
create policy "admin manages references" on public.learning_references
  for update to authenticated using (
    exists (select 1 from public.admin_roles ar where ar.user_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.admin_roles ar where ar.user_id = (select auth.uid()))
  );

drop policy if exists "admin or owner deletes references" on public.learning_references;
create policy "admin or owner deletes references" on public.learning_references
  for delete to authenticated using (
    exists (select 1 from public.admin_roles ar where ar.user_id = (select auth.uid()))
    or (submitted_by = (select auth.uid()) and source_type in ('personal', 'community'))
  );

-- Users can read approved global patterns plus their own personal patterns. Admins can see all.
drop policy if exists "read global or own personal patterns" on public.learning_patterns;
create policy "read global or own personal patterns" on public.learning_patterns
  for select to anon, authenticated using (
    (scope = 'global' and status = 'approved')
    or (scope = 'personal' and user_id = (select auth.uid()))
    or exists (select 1 from public.admin_roles ar where ar.user_id = (select auth.uid()))
  );

drop policy if exists "insert approved own personal or admin global patterns" on public.learning_patterns;
create policy "insert approved own personal or admin global patterns" on public.learning_patterns
  for insert to authenticated with check (
    (scope = 'personal' and status = 'approved' and user_id = (select auth.uid())
      and exists (select 1 from public.learning_references lr
        where lr.id = reference_id and lr.submitted_by = (select auth.uid())
          and lr.source_type = 'personal'))
    or (scope = 'global' and user_id is null and exists (
      select 1 from public.admin_roles ar where ar.user_id = (select auth.uid())
    ))
  );

drop policy if exists "admin or owner updates patterns" on public.learning_patterns;
create policy "admin or owner updates patterns" on public.learning_patterns
  for update to authenticated using (
    exists (select 1 from public.admin_roles ar where ar.user_id = (select auth.uid()))
    or (scope = 'personal' and user_id = (select auth.uid())
      and exists (select 1 from public.learning_references lr
        where lr.id = reference_id and lr.submitted_by = (select auth.uid())
          and lr.source_type = 'personal'))
  ) with check (
    exists (select 1 from public.admin_roles ar where ar.user_id = (select auth.uid()))
    or (scope = 'personal' and user_id = (select auth.uid())
      and exists (select 1 from public.learning_references lr
        where lr.id = reference_id and lr.submitted_by = (select auth.uid())
          and lr.source_type = 'personal'))
  );

drop policy if exists "admin or owner deletes patterns" on public.learning_patterns;
create policy "admin or owner deletes patterns" on public.learning_patterns
  for delete to authenticated using (
    exists (select 1 from public.admin_roles ar where ar.user_id = (select auth.uid()))
    or (scope = 'personal' and user_id = (select auth.uid()))
  );

-- anon needs table privilege because the public learning_patterns RLS policy checks admin_roles;
-- RLS has no anon policy on admin_roles, so anonymous reads still return zero rows.
grant select on public.admin_roles to anon, authenticated;
grant select, insert, update, delete on public.learning_references to authenticated;
grant select, insert, update, delete on public.learning_patterns to authenticated;
grant select on public.learning_patterns to anon;
