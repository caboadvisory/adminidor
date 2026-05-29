# Adminidor

A modular administrative web app for a small consultancy / law firm. Modern, clean UI with multilingual support (English, Swedish, Spanish) from the outset, built around a single-firm model where staff have roles.

## Modules

| Module | Status | Notes |
| ------ | ------ | ----- |
| **Clients** | Built | Individuals & legal entities, KYC, beneficial owners (UBO), AML screening, and document storage |
| **Projects** | Built | Linked to a client; status, hourly rate, currency, dates, and R2 document storage |
| **Time reporting** | Built | Entries linked to a project + user: date, duration, task, billable flag, and an auto-calculated (editable) price |
| **Reports** | Built | Time sheet: logged time + cost for a client over a period, grouped by project |
| **Admin** | Built | Admin-only: manage users (add/edit/deactivate) and export all time entries to CSV |

### Clients — KYC / AML

- **Client types:** individual (name, DOB, nationality, national ID/tax no.) or legal entity (legal name, registration number, jurisdiction, legal form).
- **KYC:** status (`not_started`, `in_progress`, `verified`, `rejected`, `expired`), risk rating (`low`/`medium`/`high`), verification timestamp (set automatically when status becomes `verified`), and a periodic review date.
- **Beneficial owners (UBO):** for entities — name, DOB, nationality, ownership %, and PEP flag.
- **AML screening:** a provider-ready log of point-in-time checks — type (`pep`, `sanctions`, `adverse_media`), result (`clear`/`hit`/`pending`), provider, external reference, and notes. Designed so a screening-provider API can be plugged in later.
- **Documents:** files stored in Cloudflare R2 via presigned URLs (upload / download / delete); metadata kept in Postgres.

### Projects

- Each project belongs to a **client**. Fields: name, code, status (`active`, `on_hold`, `completed`, `archived`), and start / end dates.
- **Billing:** hourly (with a project hourly rate + currency) or **fixed price**. A fixed-price project bills its fixed amount; per-entry amounts are still recorded but excluded from the billable total.
- **Documents:** engagement letters and other files stored in Cloudflare R2 (the same shared upload flow as Clients).
- Admin-write; all staff can read.

### Time reporting

- Entries are linked to a **project** and a **user**, and capture: **date**, **duration** (hours logged, not start/stop), **task description**, a **billable** flag, and a **price**.
- The **price** auto-calculates from the effective hourly rate × duration and is editable per entry. The **effective rate** is the project's hourly rate, falling back to the client's base hourly rate.
- A project's **fixed price overrides** per-entry pricing in the billable total.
- Each user manages their own entries at `/time`; admins can read all. A project's detail page shows its entries and a billing summary (logged hours + billable total, or the fixed price).

### Reports

- A reports hub (`/reports`). The first report — **Time sheet** (`/reports/timesheet`) — takes a **client** and a **date range** and lists all logged time for that client in the period (date, hours, description, cost), **grouped by project** with per-project subtotals and an overall total (per currency). It is headed by the configurable **supplier** (name + optional logo, see `NEXT_PUBLIC_FIRM_*`), the **client**, and the **period**. Non-billable entries are shown but excluded from cost totals. The filter is encoded in the URL, so a report view is shareable. Reports **download as a PDF** (server-rendered via `@react-pdf/renderer`), and an **admin** can **approve** a report to save the PDF onto the client as a `report` document. Viewing/downloading is open to all staff; approving is admin-only.

### Admin

- Visible only to administrators (`/admin`). Admins can **add, edit, and deactivate users**. New users are created with a password and auto-confirmed; deactivation bans sign-in but keeps all records (soft delete). Lockout protection prevents demoting or deactivating your own account.
- **Export**: all time entries to **CSV** — columns: client, project, user, date, hours, description, cost, currency.
- Uses a service-role Supabase client (`src/lib/supabase/admin.ts`) for the Auth admin API; only ever called from admin-gated server actions / routes.

## Tech stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript** (strict)
- **Tailwind CSS v4** (CSS-first config; no `tailwind.config.js`)
- **next-intl** for i18n (`en` default, `sv`, `es`) via a `[locale]` route segment
- **Supabase** for authentication and Postgres (with Row Level Security)
- **Cloudflare R2** for file storage (S3-compatible, presigned uploads)
- **zod** for input validation at server-action boundaries

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your env file and fill in values (see [Environment](#environment)):
   ```bash
   cp .env.example .env.local
   ```
3. Apply the database migrations to your Supabase project **in order** via the SQL editor
   (or `supabase db push`):
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_clients_kyc_aml.sql`
   - `supabase/migrations/0003_billing_rates.sql`
   - `supabase/migrations/0004_default_currency_eur.sql`
   - `supabase/migrations/0005_document_kind.sql`
4. Configure the **R2 bucket CORS** policy so the browser can upload (see [File storage](#file-storage-cloudflare-r2)).
5. Create an admin user (see [Authentication & roles](#authentication--roles)).
6. Run the dev server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/en/login`.

> The app boots without credentials (you'll see the localized login screen), but
> authentication, data, and file uploads require Supabase + R2 to be configured.

## Environment

Secrets live in `.env.local` (gitignored). `.env.example` documents every variable and is committed.

| Variable                        | Scope        | Purpose                                            |
| ------------------------------- | ------------ | -------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Public       | Supabase project URL                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public       | Supabase anon key                                  |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server only  | Service-role key for admin/server operations       |
| `R2_ACCOUNT_ID`                 | Server only  | Cloudflare account id (used to derive the endpoint) |
| `R2_ACCESS_KEY_ID`              | Server only  | R2 access key                                      |
| `R2_SECRET_ACCESS_KEY`          | Server only  | R2 secret key                                      |
| `R2_BUCKET`                     | Server only  | R2 bucket name                                     |
| `R2_ENDPOINT`                   | Server only  | Optional; overrides the endpoint derived from the account id |
| `NEXT_PUBLIC_FIRM_NAME`         | Public       | Supplier/firm name on report headers (default: `Cabo Advisory SL`) |
| `NEXT_PUBLIC_FIRM_LOGO_URL`     | Public       | Optional logo for report headers (URL or `/public` path)     |

## Authentication & roles

- Sign-in is email + password (Supabase). There is no public sign-up in the UI — staff accounts are created by an admin.
- Every `auth.users` row auto-creates a `profiles` row (via a DB trigger) with role **`member`**.
- **Roles:**
  - `admin` — full write access to clients, KYC/AML records, and projects.
  - `member` — reads all firm data; manages their own time entries and their own document uploads.

**Create the first admin user.** Add a user in the Supabase dashboard (Authentication → Users → Add user, with "auto-confirm"), then promote it:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

## Data model

Postgres tables (all with Row Level Security enabled):

- `profiles` — 1:1 with `auth.users`; role (`admin`/`member`), preferred locale.
- `clients` — type (individual/entity), contact + address, KYC status/risk/review dates, a base hourly rate, and identifying fields (incl. sensitive `national_id`).
- `beneficial_owners` — UBO records linked to a client.
- `aml_screenings` — AML screening log linked to a client.
- `projects` — linked to a client; status, hourly rate or fixed price (billing type), currency, dates.
- `time_entries` — linked to a project and a user; date, minutes, description, billable, and amount (auto-calculated, editable) + the unit rate applied.
- `documents` — R2 object metadata (owner type/id, key, filename, size, and `kind`: general or report).

**RLS summary:** authenticated staff can read all firm data; clients and KYC/AML records are admin-write; users manage their own time entries and document uploads. Admin checks use a `public.is_admin()` `SECURITY DEFINER` function to avoid policy recursion. Schema changes live in `supabase/migrations/` and must be applied in order.

## File storage (Cloudflare R2)

Uploads go **browser → R2** using a short-lived presigned `PUT` URL minted server-side; the file's metadata is then recorded in `documents`. Downloads use a presigned `GET`. Server-side access needs no CORS, but **browser uploads require a CORS policy** on the bucket.

Apply this in the Cloudflare dashboard (R2 → your bucket → Settings → CORS Policy). Add your production origin alongside localhost when you deploy:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## Internationalization

- Locales: **English** (`en`, default), **Swedish** (`sv`), **Spanish** (`es`). All routes are prefixed with the locale (e.g. `/sv/clients`), and the in-app switcher (top-right) re-localizes the current page.
- Translations live in `src/messages/{en,sv,es}.json`; routing/config in `src/i18n/`.
- **To add a locale:** add it to `src/i18n/routing.ts` and create a matching `src/messages/<locale>.json`.

## Scripts

| Command            | Description                                    |
| ------------------ | ---------------------------------------------- |
| `npm run dev`      | Start the dev server (Turbopack) on port 3000  |
| `npm run build`    | Create a production build                       |
| `npm run start`    | Serve the production build                      |
| `npm run lint`     | Run ESLint                                      |
| `npx tsc --noEmit` | Type-check without emitting                     |

## Project structure

```
src/
  app/[locale]/
    layout.tsx                 # root layout: <html>, fonts, NextIntlClientProvider
    (auth)/login/              # public login (page + client form)
    (app)/                     # auth-guarded shell
      layout.tsx               # guard + sidebar/topbar shell
      page.tsx                 # dashboard
      clients/                 # list, new, [id] (detail), [id]/edit
      projects/  time/         # placeholder pages
  components/
    app-shell/                 # sidebar, locale switcher, user menu
    ui/                        # button, input, card, badge, select, textarea
  i18n/                        # routing, navigation, request config
  lib/
    supabase/                  # server, client, middleware, config, auth helpers
    r2/                        # client, presign, storage, config, upload action
    auth-actions.ts            # sign-out
    utils.ts                   # cn()
  messages/                    # en.json, sv.json, es.json
  modules/
    clients/                   # types, schema (zod), queries, actions, display, components/
    projects/                  # same shape as clients (no KYC/AML)
    documents/                 # shared R2 document module (used by clients & projects)
    time/                      # types + queries stub
  proxy.ts                     # Next.js 16 middleware: locale routing + Supabase session refresh
supabase/migrations/           # 0001_init.sql, 0002_clients_kyc_aml.sql
```

## Architecture notes

- **Routing:** everything lives under `src/app/[locale]/`; `[locale]/layout.tsx` is the root layout (there is no `src/app/layout.tsx`). Navigate with the wrappers from `@/i18n/navigation`, not `next/link`/`next/navigation`, to preserve locale prefixes.
- **Middleware:** Next.js 16 renames `middleware` → `proxy`; `src/proxy.ts` runs next-intl routing and Supabase session refresh in one pass.
- **Async request APIs:** Next.js 16 requires `await params` and `await cookies()`.
- **Tailwind v4** is CSS-first — theme tokens are defined in `src/app/globals.css` (`@import "tailwindcss"` + `@theme inline`), not a JS config.
- `next.config.ts` pins `turbopack.root` to silence a workspace-root warning from a stray home-directory lockfile.

## Dependencies

**Runtime**

- `next` 16.2.6 · `react` / `react-dom` 19.2.4
- `next-intl` — internationalization
- `@supabase/supabase-js`, `@supabase/ssr` — auth + database
- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` — Cloudflare R2
- `zod` — validation · `clsx` + `tailwind-merge` — class utilities

**Development**

- `typescript`, `@types/*`, `tailwindcss` + `@tailwindcss/postcss`, `eslint` + `eslint-config-next`

## Status & roadmap

- ✅ **Foundation** — localized, auth-guarded app shell; Supabase auth with a single-firm, role-based RLS model; Cloudflare R2 storage; i18n (en/sv/es).
- ✅ **Clients** — full CRUD with KYC, beneficial owners (UBO), AML screening, and documents.
- ✅ **Projects** — full CRUD linked to clients, with hourly/fixed billing and documents.
- ✅ **Time reporting** — log time against a project (date, duration, task, billable, auto-calculated price); per-project billing summary with fixed-price support.
- ✅ **Reports** — time sheet (client + period, grouped by project with subtotals and totals), PDF download, and approve-to-client (saves the PDF to the client's documents).
- ✅ **Admin** — user management (add / edit / deactivate) and CSV export of all time entries.
- ⬜ **Future** — invoicing, dashboard metrics, AML screening-provider integration, and deployment.

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [next-intl Documentation](https://next-intl.dev/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
