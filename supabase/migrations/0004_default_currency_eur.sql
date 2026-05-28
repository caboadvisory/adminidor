-- Adminidor — default currency to EUR
-- Aligns the database column defaults with the application default (EUR).
-- Existing rows are unchanged; this only affects future inserts that omit a
-- currency (the app always supplies one).

alter table public.clients alter column default_currency set default 'EUR';
alter table public.projects alter column currency set default 'EUR';
