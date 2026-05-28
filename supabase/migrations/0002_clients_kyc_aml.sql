-- Adminidor — Clients module: KYC + AML foundation
-- Adds client typing (individual/entity), KYC fields on clients, beneficial
-- owners (UBO) for entities, and a provider-ready AML screening log.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.client_type as enum ('individual', 'entity');
create type public.kyc_status as enum ('not_started', 'in_progress', 'verified', 'rejected', 'expired');
create type public.risk_level as enum ('low', 'medium', 'high');
create type public.aml_screening_type as enum ('pep', 'sanctions', 'adverse_media');
create type public.aml_screening_result as enum ('clear', 'hit', 'pending');

-- ---------------------------------------------------------------------------
-- clients: type + KYC columns
-- ---------------------------------------------------------------------------
alter table public.clients
  add column client_type public.client_type not null default 'entity',
  -- entity-specific
  add column jurisdiction text,
  add column legal_form text,
  -- individual-specific
  add column date_of_birth date,
  add column nationality text,
  add column national_id text,           -- sensitive PII; protected by RLS
  -- KYC
  add column kyc_status public.kyc_status not null default 'not_started',
  add column risk_level public.risk_level,
  add column kyc_verified_at timestamptz,
  add column kyc_verified_by uuid references public.profiles(id),
  add column kyc_review_due date;

-- ---------------------------------------------------------------------------
-- beneficial_owners (UBO; primarily for entity clients)
-- ---------------------------------------------------------------------------
create table public.beneficial_owners (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  full_name text not null,
  date_of_birth date,
  nationality text,
  ownership_percentage numeric(5, 2),
  is_pep boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index beneficial_owners_client_id_idx on public.beneficial_owners (client_id);

create trigger beneficial_owners_set_updated_at
  before update on public.beneficial_owners
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- aml_screenings (point-in-time check log; provider-ready)
-- ---------------------------------------------------------------------------
create table public.aml_screenings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  screening_type public.aml_screening_type not null,
  result public.aml_screening_result not null default 'pending',
  provider text not null default 'manual',  -- seam for a future screening API
  reference text,                           -- external provider reference id
  screened_at timestamptz not null default now(),
  screened_by uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

create index aml_screenings_client_id_idx on public.aml_screenings (client_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Authenticated staff read; KYC/AML records are admin-managed (consistent with
-- clients being admin-write in the single-firm model).
-- ---------------------------------------------------------------------------
alter table public.beneficial_owners enable row level security;
alter table public.aml_screenings enable row level security;

create policy beneficial_owners_select on public.beneficial_owners
  for select to authenticated using (true);
create policy beneficial_owners_insert_admin on public.beneficial_owners
  for insert to authenticated with check (public.is_admin());
create policy beneficial_owners_update_admin on public.beneficial_owners
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy beneficial_owners_delete_admin on public.beneficial_owners
  for delete to authenticated using (public.is_admin());

create policy aml_screenings_select on public.aml_screenings
  for select to authenticated using (true);
create policy aml_screenings_insert_admin on public.aml_screenings
  for insert to authenticated with check (public.is_admin());
create policy aml_screenings_update_admin on public.aml_screenings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy aml_screenings_delete_admin on public.aml_screenings
  for delete to authenticated using (public.is_admin());
