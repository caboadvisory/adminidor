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
- **Feature modules** in `src/modules/`. **Clients** (KYC/AML/UBO), **Projects** (linked to a client; hourly/fixed billing), and **Time** (entries → project + user; price auto-calculated from project rate → else client base rate, fixed-price projects exclude per-entry amounts from the billable total) are fully built and share the same shape (`types.ts`, `schema.ts` zod, `queries.ts`, `actions.ts`, `display.ts`, `components/`). File attachments live in a **shared `src/modules/documents/` module** (R2-backed; `ownerType` is `client`|`project`). The **`src/modules/reports/`** module provides the Time sheet report (client + period → time entries grouped by project; filters via `searchParams` on `/reports/timesheet`). An admin-only **`src/modules/admin/`** module manages users via the Supabase Auth admin API — through a **service-role client** (`src/lib/supabase/admin.ts`, server-only) — and exports time entries to CSV (`/admin/export/time-entries`); users are soft-deleted by banning (deactivate), and the Admin nav item only shows to admins (`isAdmin` passed to the shell). The **`src/modules/dashboard/`** module powers `(app)/page.tsx` — a role-aware dashboard (`getDashboardData({userId,isAdmin})`): admins see firm KPIs + a KYC/AML compliance panel; members see a personal time view. Charts use **Recharts** in client components (`components/charts.tsx`); aggregation is done in JS (no migration). The **`src/modules/assistant/`** module is a natural-language chat (Anthropic API, Claude Opus 4.8 — `src/lib/anthropic/`, `ANTHROPIC_API_KEY` server-only, `isAssistantConfigured()`): the streaming agentic loop lives in the `/assistant/chat` **route handler** (NDJSON to the client). Data access is **read-only tools** (`tools.ts`) wrapping existing queries under the user's RLS-scoped client; the only write is `propose_time_entry`, which **does not write** — it drafts an entry the user confirms in a card, committing via the existing `createTimeEntry` (`actions.ts`). Chat history (`assistant_conversations`/`assistant_messages`) is **owner-only/private** RLS. Reports render to PDF server-side with `@react-pdf/renderer` (`pdf.tsx`; downloaded via the `/reports/timesheet/pdf` route handler), and an admin can approve a report to store the PDF on the client as a `kind='report'` document (`actions.ts` → R2 `putObject`). `@react-pdf/renderer` is in `serverExternalPackages` (next.config.ts) so it isn't bundled. New modules follow the same shape; routed pages live under `(app)/`. Server actions accept `unknown` and validate with zod at the boundary.
- **Database** — migrations in `supabase/migrations/` (`0001_init.sql` base schema; `0002_clients_kyc_aml.sql` adds client typing + KYC/AML; `0003_billing_rates.sql` adds client base rate, project billing type/fixed price, and time-entry `amount`/`unit_rate`; `0004_default_currency_eur.sql` sets EUR column defaults; `0005_document_kind.sql` adds `documents.kind` general|report; `0006_assistant.sql` adds `assistant_conversations`/`assistant_messages` with owner-only RLS; `0007_security_hardening.sql` locks down `profiles.role` — column-level `UPDATE` grant restricting members to `full_name`/`locale` + a trigger — so a member can't self-promote to admin via a direct PostgREST write; see `SECURITY_REVIEW.md`; `0008_audit_log.sql` adds an append-only `audit_log` (admin-read, no UPDATE/DELETE) written only via SECURITY DEFINER routines — AFTER triggers on `clients`/`beneficial_owners`/`aml_screenings`/`profiles` plus a `log_audit_event()` RPC the app calls for document downloads, CSV/PDF exports, report approval, and user management; see `SECURITY_HARDENING_PLAN.md`). Tables: `profiles` (1:1 with `auth.users`, role `admin`/`member`, signup-trigger created), `clients` (individual/entity, KYC status/risk/review dates + sensitive fields like `national_id`), `beneficial_owners` (UBO), `aml_screenings` (provider-ready screening log), `projects`, `time_entries`, `documents` (R2 metadata). RLS everywhere: authenticated staff read all firm data; clients + KYC/AML records are admin-write; users manage their own time entries and uploads. Admin checks use the `public.is_admin()` SECURITY DEFINER function (avoids RLS recursion). Migrations must be applied in order via the Supabase SQL editor or `supabase db push`.

## Conventions / gotchas

- **Async request APIs (Next 16):** always `await params`, `await cookies()`.
- **Tailwind v4 is CSS-first — no `tailwind.config.js`.** Theme tokens are in `src/app/globals.css` (`@import "tailwindcss"` + `@theme inline`). PostCSS via `@tailwindcss/postcss`.
- **Brand design system (Cabo Advisory).** `globals.css` defines the palette: cream `background` `#f5f3ed`, white `surface`, slate-blue `primary` `#7797ae`, warm `border`/`border-strong`, and body `foreground` `#2b3a44` (the palette is low-contrast, so palette colours are surfaces/accents/large headings only — body copy uses the dark slate). **No dark mode** (removed). Fonts via `next/font` in `[locale]/layout.tsx`: Questrial (body, `font-sans`), Oswald (in-app headings, `font-heading`, applied to `h1–h4`), Saira Stencil One (`font-display`, brand display). Brand assets in `public/brand/`: `wordmark.svg` + `icon.svg` are transparent crops derived from the originals `public/{logotype,profile-icon}.svg`; `wordmark.png` is the raster the PDF uses (react-pdf can't render SVG — see `src/modules/reports/pdf-logo.ts`). The wordmark renders via `src/components/brand/wordmark.tsx`; favicon is `src/app/icon.svg`. Use brand tokens (`bg-surface`, `text-muted`, `border-border`, `bg-primary`…), not `black/white` opacity or `dark:` utilities.
- **`next.config.ts` pins `turbopack.root`** to silence a workspace-root warning from a stray home-directory lockfile. Don't remove it unless that lockfile is gone.
- **Security headers** are set in `next.config.ts` `headers()`: an enforcing CSP (`'unsafe-inline'`/`'unsafe-eval'` are still required — no nonce yet; `connect-src` allowlists Supabase + R2), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP, and HSTS (prod). `poweredByHeader` is off. If the CSP blocks something, flip the header key to `Content-Security-Policy-Report-Only` while tuning.
- **Boot-time env validation** is in `src/instrumentation.ts` (`register()`): warns on missing vars (the app still degrades gracefully to the login screen) and throws in production on present-but-malformed secrets.
- **Audit logging:** server actions/routes call `logAuditEvent()` (`src/lib/audit.ts`) → the `log_audit_event()` RPC (migration 0008). It's best-effort (never blocks the user action); regulated mutations are also captured by DB triggers. See `SECURITY_REVIEW.md` and `SECURITY_HARDENING_PLAN.md`.
- In server components, prefer `getTranslations`/`setRequestLocale`; in client components use `useTranslations`. Call `setRequestLocale(locale)` in pages/layouts to keep static rendering working.
- Secrets live in `.env.local` (gitignored). `.env.example` documents the required vars and IS committed.

## Next.js 16 caveat

This is Next.js 16, which has breaking changes versus older versions. Before writing non-trivial Next.js code, consult the version-matched docs bundled at `node_modules/next/dist/docs/` (App Router under `01-app/`).

@AGENTS.md
