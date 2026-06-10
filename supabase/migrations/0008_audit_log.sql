-- ---------------------------------------------------------------------------
-- 0008_audit_log.sql
--
-- Append-only accountability trail. For a firm processing regulated AML/KYC
-- personal data, GDPR Art. 5(2)/30 and Spain's Ley 10/2010 require demonstrable
-- record-keeping: who created/changed/deleted a client/KYC/AML record, and who
-- read/exported regulated material.
--
-- Design:
--   * One table `audit_log`, admin-read only, with NO update/delete paths
--     (append-only — even admins cannot rewrite history via PostgREST).
--   * Direct writes by end-user roles are revoked; all writes flow through
--     SECURITY DEFINER functions/triggers that run as the table owner.
--   * AFTER triggers capture mutations to clients / beneficial_owners /
--     aml_screenings / profiles(role). `national_id` is masked in the stored
--     snapshot to avoid proliferating the national identifier.
--   * `log_audit_event()` records app-level events (document downloads, CSV/PDF
--     exports, report approval, user management) under the caller's identity.
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id    uuid,            -- auth.users id; no FK so the record survives user deletion
  actor_email text,            -- denormalized for the same reason
  action      text not null,   -- e.g. 'client.update', 'document.download', 'user.deactivate'
  entity_type text not null,   -- 'client' | 'beneficial_owner' | 'aml_screening' | 'profile' | 'document' | 'time_entries' | 'report'
  entity_id   text,
  summary     text,
  metadata    jsonb            -- before/after snapshot for row triggers
);

create index audit_log_occurred_at_idx on public.audit_log (occurred_at desc);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index audit_log_actor_idx on public.audit_log (actor_id);

alter table public.audit_log enable row level security;

-- Admins may read the trail. There are intentionally NO insert/update/delete
-- policies: end users never write or mutate it directly.
create policy audit_log_select_admin on public.audit_log
  for select to authenticated using (public.is_admin());

-- Belt-and-braces: strip direct table DML from the API roles. All writes go
-- through the SECURITY DEFINER routines below (which run as the table owner and
-- are unaffected by these grants).
revoke insert, update, delete on public.audit_log from authenticated, anon;

-- Resolve the acting user's email (SECURITY DEFINER so it can read auth.users).
create or replace function public._audit_actor_email()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select email from auth.users where id = auth.uid();
$$;

-- App-level event logger. Called from server actions / route handlers under the
-- caller's RLS-scoped client so auth.uid() attributes the actor.
create or replace function public.log_audit_event(
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_summary text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor_id, actor_email, action, entity_type, entity_id, summary)
  values (auth.uid(), public._audit_actor_email(), p_action, p_entity_type, p_entity_id, p_summary);
end;
$$;

revoke all on function public.log_audit_event(text, text, text, text) from public;
grant execute on function public.log_audit_event(text, text, text, text) to authenticated;

-- AFTER-row trigger: records create/update/delete on regulated tables. The
-- entity label is passed as a trigger argument. national_id is masked in the
-- snapshot so the identifier is not duplicated into the audit table.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity text := tg_argv[0];
  v_action text;
  v_id     text;
  v_before jsonb;
  v_after  jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := v_entity || '.create';
    v_id := (new.id)::text;
    v_after := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    -- For profiles, only audit role changes (full_name/locale edits are noise).
    if v_entity = 'profile' and new.role is not distinct from old.role then
      return new;
    end if;
    v_action := v_entity || '.update';
    v_id := (new.id)::text;
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
  else -- DELETE
    v_action := v_entity || '.delete';
    v_id := (old.id)::text;
    v_before := to_jsonb(old);
  end if;

  -- Mask the national identifier in stored snapshots (only when present + non-null).
  if v_before ? 'national_id' and (v_before->>'national_id') is not null then
    v_before := jsonb_set(v_before, '{national_id}', '"[redacted]"');
  end if;
  if v_after ? 'national_id' and (v_after->>'national_id') is not null then
    v_after := jsonb_set(v_after, '{national_id}', '"[redacted]"');
  end if;

  insert into public.audit_log (actor_id, actor_email, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    public._audit_actor_email(),
    v_action,
    v_entity,
    v_id,
    jsonb_strip_nulls(jsonb_build_object('before', v_before, 'after', v_after))
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger audit_clients
  after insert or update or delete on public.clients
  for each row execute function public.audit_row_change('client');

create trigger audit_beneficial_owners
  after insert or update or delete on public.beneficial_owners
  for each row execute function public.audit_row_change('beneficial_owner');

create trigger audit_aml_screenings
  after insert or update or delete on public.aml_screenings
  for each row execute function public.audit_row_change('aml_screening');

create trigger audit_profiles
  after insert or update or delete on public.profiles
  for each row execute function public.audit_row_change('profile');
