-- Adminidor — billing rates & time-entry amounts
-- Adds a client base hourly rate, project billing type + fixed price, and
-- monetary fields on time entries. Additive; existing RLS is unchanged.

-- ---------------------------------------------------------------------------
-- clients: base hourly rate (fallback rate for the client's projects)
-- ---------------------------------------------------------------------------
alter table public.clients
  add column default_hourly_rate numeric(12, 2),
  add column default_currency text not null default 'SEK';

-- ---------------------------------------------------------------------------
-- projects: billing type + fixed price
-- A 'fixed' project bills a single fixed_price; per-entry amounts are still
-- recorded but excluded from the project's billable total.
-- ---------------------------------------------------------------------------
create type public.project_billing_type as enum ('hourly', 'fixed');

alter table public.projects
  add column billing_type public.project_billing_type not null default 'hourly',
  add column fixed_price numeric(12, 2);

-- ---------------------------------------------------------------------------
-- time_entries: monetary fields
-- unit_rate = hourly rate applied at entry time (snapshot of the effective
-- rate: project rate, else client base rate). amount = entry price
-- (rate * hours by default, editable).
-- ---------------------------------------------------------------------------
alter table public.time_entries
  add column unit_rate numeric(12, 2),
  add column amount numeric(12, 2);
