# Adminidor

A modular administrative web app for a small consultancy / law firm. Modern, clean UI with multilingual support (English, Swedish, Spanish) from the outset.

First three modules: **Clients**, **Projects**, **Time reporting**.

## Tech stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (CSS-first config)
- **next-intl** for i18n (`en` default, `sv`, `es`) via a `[locale]` route segment
- **Supabase** for authentication and Postgres (with Row Level Security)
- **Cloudflare R2** for file storage (S3-compatible, presigned uploads)

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your env file and fill in values:
   ```bash
   cp .env.example .env.local
   ```
   See [Environment](#environment) below.
3. Apply the database schema to your Supabase project: run `supabase/migrations/0001_init.sql`
   (via the Supabase SQL editor, or `supabase db push` with the Supabase CLI).
4. Run the dev server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/en/login`.

> The app boots without credentials (you'll see the localized login screen), but
> authentication, data, and file uploads require Supabase + R2 to be configured.

## Environment

| Variable                        | Scope        | Purpose                                  |
| ------------------------------- | ------------ | ---------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Public       | Supabase project URL                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public       | Supabase anon key                        |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server only  | Service-role key for admin operations    |
| `R2_ACCOUNT_ID`                 | Server only  | Cloudflare account id (derives endpoint) |
| `R2_ACCESS_KEY_ID`              | Server only  | R2 access key                            |
| `R2_SECRET_ACCESS_KEY`          | Server only  | R2 secret key                            |
| `R2_BUCKET`                     | Server only  | R2 bucket name                           |
| `R2_ENDPOINT`                   | Server only  | Optional; overrides the derived endpoint |

## Scripts

| Command         | Description                                    |
| --------------- | ---------------------------------------------- |
| `npm run dev`   | Start the dev server (Turbopack) on port 3000  |
| `npm run build` | Create a production build                       |
| `npm run start` | Serve the production build                      |
| `npm run lint`  | Run ESLint                                      |

## Project structure

```
src/
  app/[locale]/        # localized routes: (auth)/login, (app)/{dashboard,clients,projects,time}
  components/          # app-shell (sidebar, locale switcher, user menu) and ui primitives
  i18n/                # next-intl routing, navigation, request config
  lib/                 # supabase clients, R2 client + presign, shared utils
  messages/            # en.json, sv.json, es.json
  modules/             # feature modules: clients, projects, time (types + queries)
  proxy.ts             # next-intl routing + Supabase session refresh (Next.js 16 middleware)
supabase/migrations/   # SQL schema + RLS
```

## Dependencies

**Runtime**

- `next` 16.2.6 · `react` / `react-dom` 19.2.4
- `next-intl` — internationalization
- `@supabase/supabase-js`, `@supabase/ssr` — auth + database
- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` — Cloudflare R2
- `zod` — validation · `clsx` + `tailwind-merge` — class utilities

**Development**

- `typescript`, `@types/*`, `tailwindcss` + `@tailwindcss/postcss`, `eslint` + `eslint-config-next`

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [next-intl Documentation](https://next-intl.dev/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
