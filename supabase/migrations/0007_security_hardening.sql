-- ---------------------------------------------------------------------------
-- 0007_security_hardening.sql
--
-- Fixes the CRITICAL privilege-escalation finding from the security review:
-- the `profiles_update_self_or_admin` RLS policy correctly gates *which row* a
-- user may update (id = auth.uid()), but Postgres RLS cannot gate *which
-- column*. Because `role` lives on that same row, an authenticated member could
-- promote themselves with a direct PostgREST call:
--     PATCH /rest/v1/profiles?id=eq.<own-uid>  { "role": "admin" }
-- (verified live). The app's admin UI is unaffected — it changes roles through
-- the service-role client, which uses the `service_role` Postgres role and a
-- null auth.uid(); both defenses below intentionally allow that path.
--
-- Defense 1 (primary): column-level privileges. `authenticated` may update only
--   the safe self-service columns; `role` (and id/created_at/updated_at) cannot
--   be targeted in an UPDATE at all.
-- Defense 2 (backstop): a BEFORE UPDATE trigger that rejects any role change
--   made by a non-admin authenticated session, in case the column grant is ever
--   loosened.
-- ---------------------------------------------------------------------------

-- Defense 1 — column-level UPDATE privileges.
revoke update on public.profiles from authenticated;
grant update (full_name, locale) on public.profiles to authenticated;

-- Defense 2 — block role changes by non-admin authenticated sessions.
-- auth.uid() is null for the service_role client (the legitimate admin path),
-- so that path is allowed; a logged-in member (auth.uid() set, not admin) is not.
create or replace function public.prevent_role_self_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'not authorized to change role';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_no_role_self_change on public.profiles;
create trigger profiles_no_role_self_change
  before update on public.profiles
  for each row execute function public.prevent_role_self_change();
