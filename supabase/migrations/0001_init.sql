-- Adminidor initial schema (single-firm model)
-- Modules: profiles (staff), clients, projects, time_entries, documents (R2 metadata)

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'member');
create type public.project_status as enum ('active', 'on_hold', 'completed', 'archived');
create type public.document_owner_type as enum ('client', 'project');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- SECURITY DEFINER so it can read profiles without tripping RLS (avoids
-- recursion when referenced from RLS policies).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.user_role not null default 'member',
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile whenever an auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  registration_number text,
  contact_email text,
  contact_phone text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  country text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  code text,
  status public.project_status not null default 'active',
  hourly_rate numeric(12, 2),
  currency text not null default 'SEK',
  start_date date,
  end_date date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_client_id_idx on public.projects (client_id);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- time_entries
-- ---------------------------------------------------------------------------
create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null default current_date,
  minutes integer not null check (minutes > 0),
  description text,
  billable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index time_entries_project_id_idx on public.time_entries (project_id);
create index time_entries_user_id_idx on public.time_entries (user_id);

create trigger time_entries_set_updated_at
  before update on public.time_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- documents (metadata for files stored in Cloudflare R2)
-- ---------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_type public.document_owner_type not null,
  owner_id uuid not null,
  file_name text not null,
  r2_key text not null unique,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index documents_owner_idx on public.documents (owner_type, owner_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Single firm: any authenticated staff member can read all data. Writes to
-- clients/projects are admin-only; staff manage their own time entries and
-- their own document uploads.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.time_entries enable row level security;
alter table public.documents enable row level security;

-- profiles
create policy profiles_select on public.profiles
  for select to authenticated using (true);
create policy profiles_update_self_or_admin on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- clients
create policy clients_select on public.clients
  for select to authenticated using (true);
create policy clients_insert_admin on public.clients
  for insert to authenticated with check (public.is_admin());
create policy clients_update_admin on public.clients
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy clients_delete_admin on public.clients
  for delete to authenticated using (public.is_admin());

-- projects
create policy projects_select on public.projects
  for select to authenticated using (true);
create policy projects_insert_admin on public.projects
  for insert to authenticated with check (public.is_admin());
create policy projects_update_admin on public.projects
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy projects_delete_admin on public.projects
  for delete to authenticated using (public.is_admin());

-- time_entries
create policy time_entries_select on public.time_entries
  for select to authenticated using (true);
create policy time_entries_insert_own on public.time_entries
  for insert to authenticated with check (user_id = auth.uid() or public.is_admin());
create policy time_entries_update_own on public.time_entries
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
create policy time_entries_delete_own on public.time_entries
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- documents
create policy documents_select on public.documents
  for select to authenticated using (true);
create policy documents_insert_own on public.documents
  for insert to authenticated with check (uploaded_by = auth.uid());
create policy documents_delete_own on public.documents
  for delete to authenticated using (uploaded_by = auth.uid() or public.is_admin());
