-- Expose only Admin-approved community references and their style patterns to the Inspiration Picker.
-- Developer DNA source posts and personal references remain outside the shared inspiration library.

drop policy if exists "read approved community inspiration references" on public.learning_references;
create policy "read approved community inspiration references"
on public.learning_references
for select to anon, authenticated
using (
  source_type = 'community'
  and status = 'approved'
  and consent_to_global = true
);

grant select on public.learning_references to anon;

drop policy if exists "read global or own personal patterns" on public.learning_patterns;
create policy "read approved community inspiration or own personal patterns"
on public.learning_patterns
for select to anon, authenticated
using (
  (
    scope = 'global'
    and status = 'approved'
    and exists (
      select 1 from public.learning_references lr
      where lr.id = reference_id
        and lr.source_type = 'community'
        and lr.status = 'approved'
        and lr.consent_to_global = true
    )
  )
  or (scope = 'personal' and user_id = (select auth.uid()))
  or exists (
    select 1 from public.admin_roles ar
    where ar.user_id = (select auth.uid())
  )
);
