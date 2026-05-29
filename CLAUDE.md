# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Adminidor — a modular admin app for a small consultancy/law firm. Multilingual (en/sv/es) from the start. First three modules: Clients, Projects, Time reporting. Single-firm tenancy model (one organization; users have roles).

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5 (strict) · Tailwind CSS v4 · next-intl (i18n) · Supabase (auth + Postgres) · Cloudflare R2 (file storage, S3-compatible).

## Commands

```bash
npm run dev      # dev server with Turbopack at http://localhost:3000
npm run build    # production build
npm run start    # serve the production build (run build first)
npm run lint     # ESLint (flat config, eslint.config.mjs)
npx tsc --noEmit # type-check without building
```

No test runner is configured yet. DB schema lives in `supabase/migrations/`; apply via the Supabase SQL editor or `supabase db push`.

## Architecture

- **Localized routing.** Everything lives under `src/app/[locale]/`. `[locale]/layout.tsx` is the root layout (it renders `<html>`, fonts, and `NextIntlClientProvider`) — there is intentionally **no `src/app/layout.tsx`**. Route groups: `(auth)` (public, e.g. login) and `(app)` (auth-guarded shell). The dashboard is `(app)/page.tsx` → `/{locale}`.
- **i18n is next-intl.** Config in `src/i18n/` (`routing.ts` defines `en`/`sv`/`es`, `navigation.ts` exports locale-aware `Link`/`useRouter`/`usePathname`/`redirect`, `request.ts` loads messages). Translations in `src/messages/{en,sv,es}.json`. The plugin is wired in `next.config.ts` via `createNextIntlPlugin()` (auto-detects `src/i18n/request.ts`). **Always navigate with the wrappers from `@/i18n/navigation`, not `next/link` / `next/navigation`**, or locale prefixes break.
- **Middleware is `src/proxy.ts`** (Next.js 16 renamed `middleware` → `proxy`). It runs next-intl routing **and** Supabase session refresh in one pass.
- **Supabase clients** in `src/lib/supabase/`: `server.ts` (Server Components/actions, async, uses `cookies()`), `client.ts` (browser), `middleware.ts` (`updateSession` for the proxy), `config.ts` (`isSupabaseConfigured()`), `auth.ts` (`getCurrentUser()`). The app degrades gracefully when env vars are missing (boots to the login screen instead of crashing) — preserve that.
- **Auth guard** is in `(app)/layout.tsx`: no user → `redirect` to `/login`. Sign-out is the `signOut` server action in `src/lib/auth-actions.ts`.
- **Cloudflare R2** in `src/lib/r2/`: `client.ts` (S3 client, `region: "auto"`), `presign.ts` (presigned PUT/GET URLs), `storage.ts` (`deleteObject`), `actions.ts` (`requestUploadUrl` server action). Uploads go browser→R2 via presigned `PUT`; file metadata is stored in the `documents` table. **Browser uploads require the R2 bucket to allow `PUT` via CORS** from the app origin (server-side access needs no CORS).
- **Feature modules** in `src/modules/`. **Clients** (KYC/AML/UBO), **Projects** (linked to a client; hourly/fixed billing), and **Time** (entries → project + user; price auto-calculated from project rate → else client base rate, fixed-price projects exclude per-entry amounts from the billable total) are fully built and share the same shape (`types.ts`, `schema.ts` zod, `queries.ts`, `actions.ts`, `display.ts`, `components/`). File attachments live in a **shared `src/modules/documents/` module** (R2-backed; `ownerType` is `client`|`project`). The **`src/modules/reports/`** module provides the Time sheet report (client + period → time entries grouped by project; filters via `searchParams` on `/reports/timesheet`). An admin-only **`src/modules/admin/`** module manages users via the Supabase Auth admin API — through a **service-role client** (`src/lib/supabase/admin.ts`, server-only) — and exports time entries to CSV (`/admin/export/time-entries`); users are soft-deleted by banning (deactivate), and the Admin nav item only shows to admins (`isAdmin` passed to the shell). Reports render to PDF server-side with `@react-pdf/renderer` (`pdf.tsx`; downloaded via the `/reports/timesheet/pdf` route handler), and an admin can approve a report to store the PDF on the client as a `kind='report'` document (`actions.ts` → R2 `putObject`). `@react-pdf/renderer` is in `serverExternalPackages` (next.config.ts) so it isn't bundled. New modules follow the same shape; routed pages live under `(app)/`. Server actions accept `unknown` and validate with zod at the boundary.
- **Database** — migrations in `supabase/migrations/` (`0001_init.sql` base schema; `0002_clients_kyc_aml.sql` adds client typing + KYC/AML; `0003_billing_rates.sql` adds client base rate, project billing type/fixed price, and time-entry `amount`/`unit_rate`; `0004_default_currency_eur.sql` sets EUR column defaults; `0005_document_kind.sql` adds `documents.kind` general|report). Tables: `profiles` (1:1 with `auth.users`, role `admin`/`member`, signup-trigger created), `clients` (individual/entity, KYC status/risk/review dates + sensitive fields like `national_id`), `beneficial_owners` (UBO), `aml_screenings` (provider-ready screening log), `projects`, `time_entries`, `documents` (R2 metadata). RLS everywhere: authenticated staff read all firm data; clients + KYC/AML records are admin-write; users manage their own time entries and uploads. Admin checks use the `public.is_admin()` SECURITY DEFINER function (avoids RLS recursion). Migrations must be applied in order via the Supabase SQL editor or `supabase db push`.

## Conventions / gotchas

- **Async request APIs (Next 16):** always `await params`, `await cookies()`.
- **Tailwind v4 is CSS-first — no `tailwind.config.js`.** Theme tokens are in `src/app/globals.css` (`@import "tailwindcss"` + `@theme inline`). PostCSS via `@tailwindcss/postcss`.
- **`next.config.ts` pins `turbopack.root`** to silence a workspace-root warning from a stray home-directory lockfile. Don't remove it unless that lockfile is gone.
- In server components, prefer `getTranslations`/`setRequestLocale`; in client components use `useTranslations`. Call `setRequestLocale(locale)` in pages/layouts to keep static rendering working.
- Secrets live in `.env.local` (gitignored). `.env.example` documents the required vars and IS committed.

## Next.js 16 caveat

This is Next.js 16, which has breaking changes versus older versions. Before writing non-trivial Next.js code, consult the version-matched docs bundled at `node_modules/next/dist/docs/` (App Router under `01-app/`).

@AGENTS.md
