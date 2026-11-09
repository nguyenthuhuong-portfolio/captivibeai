-- CaptiVibe Global DNA: ten Admin-owned seed posts -> one versioned system-wide style profile.
-- This is intentionally separate from community/personal learning_references and learning_patterns.

create extension if not exists pgcrypto;

create table if not exists public.global_dna_sources (
  id uuid primary key default gen_random_uuid(),
  position smallint not null unique check (position between 1 and 10),
  title text not null check (char_length(trim(title)) between 1 and 120),
  source_text text not null check (char_length(trim(source_text)) between 30 and 5000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.global_style_profiles (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique check (version > 0),
  profile jsonb not null check (jsonb_typeof(profile) = 'object'),
  source_count smallint not null check (source_count = 10),
  source_ids uuid[] not null check (cardinality(source_ids) = 10),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  activated_at timestamptz
);

create unique index if not exists global_style_profiles_single_active_uidx
  on public.global_style_profiles ((status)) where status = 'active';
create index if not exists global_style_profiles_version_idx
  on public.global_style_profiles (version desc);

alter table public.global_dna_sources enable row level security;
alter table public.global_style_profiles enable row level security;

-- The ten seed posts are only visible/manageable to Admins. They are never community posts.
drop policy if exists "admins manage global dna sources" on public.global_dna_sources;
create policy "admins manage global dna sources" on public.global_dna_sources
  for all to authenticated
  using (exists (select 1 from public.admin_roles ar where ar.user_id = (select auth.uid())))
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.admin_roles ar where ar.user_id = (select auth.uid()))
  );

-- Everyone may read only the active compact DNA for Generate. Draft/history remain Admin-only.
drop policy if exists "read active global dna or admin history" on public.global_style_profiles;
create policy "read active global dna or admin history" on public.global_style_profiles
  for select to anon, authenticated
  using (
    status = 'active'
    or exists (select 1 from public.admin_roles ar where ar.user_id = (select auth.uid()))
  );

-- No direct writes to profile versions. All creation/activation goes through Admin-checked RPCs.
revoke all on public.global_dna_sources from anon;
revoke all on public.global_style_profiles from anon, authenticated;
grant select, insert, update, delete on public.global_dna_sources to authenticated;
grant select on public.global_style_profiles to anon, authenticated;

create or replace function public.create_global_style_draft(
  p_profile jsonb,
  p_source_ids uuid[],
  p_source_hash text
)
returns setof public.global_style_profiles
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin_id uuid := auth.uid();
  v_version integer;
  v_draft_id uuid;
  v_source_count integer;
  v_current_hash text;
begin
  if v_admin_id is null or not exists (
    select 1 from public.admin_roles ar where ar.user_id = v_admin_id
  ) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  lock table public.global_dna_sources in share mode;

  if jsonb_typeof(p_profile) <> 'object'
     or cardinality(p_source_ids) <> 10
     or p_source_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_global_dna_payload' using errcode = '22023';
  end if;

  select count(distinct id) into v_source_count
  from public.global_dna_sources
  where id = any(p_source_ids);
  if v_source_count <> 10 then
    raise exception 'dna_requires_exactly_10_sources' using errcode = '22023';
  end if;

  -- Guard against Admin edits made while the one-request GPT analysis was running.
  select encode(digest(string_agg(
    position::text || E'\n' || char_length(title)::text || ':' || title || E'\n' ||
    char_length(source_text)::text || ':' || source_text,
    E'\n---\n' order by position
  ), 'sha256'), 'hex')
  into v_current_hash
  from public.global_dna_sources;
  if v_current_hash is distinct from p_source_hash then
    raise exception 'dna_sources_changed_rebuild_required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('captivibe-global-dna-version'));
  select coalesce(max(version), 0) + 1 into v_version
  from public.global_style_profiles;

  insert into public.global_style_profiles (
    version, profile, source_count, source_ids, source_hash, status, created_by
  ) values (
    v_version, p_profile, 10, p_source_ids, p_source_hash, 'draft', v_admin_id
  ) returning id into v_draft_id;

  return query select * from public.global_style_profiles where id = v_draft_id;
end;
$$;

create or replace function public.activate_global_style_profile(p_profile_id uuid)
returns setof public.global_style_profiles
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin_id uuid := auth.uid();
  v_saved_hash text;
  v_current_hash text;
  v_profile_status text;
begin
  if v_admin_id is null or not exists (
    select 1 from public.admin_roles ar where ar.user_id = v_admin_id
  ) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  lock table public.global_dna_sources in share mode;

  select source_hash, status into v_saved_hash, v_profile_status
  from public.global_style_profiles
  where id = p_profile_id and status in ('draft', 'archived') and source_count = 10;
  if v_saved_hash is null then
    raise exception 'dna_draft_not_found' using errcode = '22023';
  end if;

  -- Drafts must still match the current ten Admin seed posts. Archived versions
  -- are immutable snapshots and may be reactivated for rollback.
  if v_profile_status = 'draft' then
    select encode(digest(string_agg(
      position::text || E'\n' || char_length(title)::text || ':' || title || E'\n' ||
      char_length(source_text)::text || ':' || source_text,
      E'\n---\n' order by position
    ), 'sha256'), 'hex')
    into v_current_hash
    from public.global_dna_sources;

    if v_current_hash is distinct from v_saved_hash then
      raise exception 'dna_sources_changed_rebuild_required' using errcode = '22023';
    end if;
  end if;

  update public.global_style_profiles
  set status = 'archived'
  where status = 'active';

  update public.global_style_profiles
  set status = 'active', activated_at = now()
  where id = p_profile_id and status in ('draft', 'archived');

  return query select * from public.global_style_profiles where id = p_profile_id;
end;
$$;

revoke all on function public.create_global_style_draft(jsonb, uuid[], text) from public, anon;
revoke all on function public.activate_global_style_profile(uuid) from public, anon;
grant execute on function public.create_global_style_draft(jsonb, uuid[], text) to authenticated;
grant execute on function public.activate_global_style_profile(uuid) to authenticated;
