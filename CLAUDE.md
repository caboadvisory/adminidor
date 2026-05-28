# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5 (strict) · Tailwind CSS v4. Fresh `create-next-app` scaffold — the homepage is still the default template.

## Commands

```bash
npm run dev      # dev server with Turbopack at http://localhost:3000
npm run build    # production build
npm run start    # serve the production build (run build first)
npm run lint     # ESLint (flat config, eslint.config.mjs)
```

No test runner is configured yet. `npx tsc --noEmit` type-checks without building.

## Architecture

- **App Router under `src/app/`.** `layout.tsx` is the root layout (loads Geist fonts via `next/font/google` and `globals.css`); `page.tsx` is `/`. Add routes as nested folders with their own `page.tsx`.
- **Import alias:** `@/*` → `./src/*` (see `tsconfig.json`).
- **Tailwind v4 is CSS-first — there is no `tailwind.config.js`.** Theme tokens live in `src/app/globals.css` via `@import "tailwindcss"` and the `@theme inline { … }` block (colors, fonts). Add design tokens there, not in a JS config. PostCSS wiring is `@tailwindcss/postcss` in `postcss.config.mjs`.
- **`next.config.ts` pins `turbopack.root` to `__dirname`.** Required: there is a stray `package-lock.json` in the home directory, so without this Turbopack infers the wrong workspace root. Don't remove it unless that lockfile is gone.

## Next.js 16 caveat

This is Next.js 16, which has breaking changes versus older versions you may know. Before writing non-trivial Next.js code, consult the version-matched docs bundled at `node_modules/next/dist/docs/` (App Router lives under `01-app/`).

@AGENTS.md
