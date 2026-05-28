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
- **Cloudflare R2** in `src/lib/r2/`: `client.ts` (S3 client, `region: "auto"`), `presign.ts` (presigned PUT/GET URLs), `actions.ts` (`requestUploadUrl` server action). Uploads go browser→R2 via presigned URL; file metadata is stored in the `documents` table.
- **Feature modules** in `src/modules/{clients,projects,time}/` (`types.ts` + `queries.ts`). This is the modular boundary — new modules follow the same shape, and their routed pages live under `(app)/`.
- **Database** (`supabase/migrations/0001_init.sql`): `profiles` (1:1 with `auth.users`, role `admin`/`member`, auto-created via signup trigger), `clients`, `projects`, `time_entries`, `documents`. RLS is on everywhere: authenticated staff read all firm data; clients/projects are admin-write; users manage their own time entries and uploads. Admin checks use the `public.is_admin()` SECURITY DEFINER function (avoids RLS recursion).

## Conventions / gotchas

- **Async request APIs (Next 16):** always `await params`, `await cookies()`.
- **Tailwind v4 is CSS-first — no `tailwind.config.js`.** Theme tokens are in `src/app/globals.css` (`@import "tailwindcss"` + `@theme inline`). PostCSS via `@tailwindcss/postcss`.
- **`next.config.ts` pins `turbopack.root`** to silence a workspace-root warning from a stray home-directory lockfile. Don't remove it unless that lockfile is gone.
- In server components, prefer `getTranslations`/`setRequestLocale`; in client components use `useTranslations`. Call `setRequestLocale(locale)` in pages/layouts to keep static rendering working.
- Secrets live in `.env.local` (gitignored). `.env.example` documents the required vars and IS committed.

## Next.js 16 caveat

This is Next.js 16, which has breaking changes versus older versions. Before writing non-trivial Next.js code, consult the version-matched docs bundled at `node_modules/next/dist/docs/` (App Router under `01-app/`).

@AGENTS.md
