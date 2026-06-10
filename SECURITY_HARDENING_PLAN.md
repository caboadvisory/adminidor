# Adminidor — Security Hardening Plan

*Prepared for: Cabo Advisory SL (owner/developer) · Scope: Adminidor (Next.js 16 / Supabase / Cloudflare R2 / Anthropic) · Context: regulated AML/KYC PII under GDPR + Spain's Ley 10/2010*

---

> ## ✅ Implementation status (2026-06-10)
>
> **Phase 0 (all done; `tsc`/lint/build green, headers verified at runtime):** security-header block + enforcing CSP + `poweredByHeader:false` (`next.config.ts`); `server-only` on the Anthropic modules; `national_id` + AML-note redaction in `clampClient` (which also fixed a latent bug — it was checking snake_case keys and never capping the nested arrays); `select('id')` so mutating actions in clients/projects/time/documents return `forbidden` on a zero-row RLS denial instead of a false success; raw `error.message` replaced with stable codes across those modules; forced-attachment downloads (`createDownloadUrl` → `ResponseContentDisposition`); server-action body cap + assistant message-length cap + `conversationId` UUID validation; boot-time env validation (`src/instrumentation.ts`).
>
> **Phase 1 keystone — audit log: done in code, needs DB apply.** Migration **`0008_audit_log.sql`** adds an append-only `audit_log` (admin-read, no UPDATE/DELETE), AFTER triggers on `clients`/`beneficial_owners`/`aml_screenings`/`profiles` (national_id masked in snapshots), and a `log_audit_event()` RPC. The app already calls it for document upload/download/delete, CSV + timesheet-PDF exports, report approval, and user create/update/activate-deactivate (attributed to the acting admin). **Apply `0008` to the database to activate capture** (until then `logAuditEvent` is a best-effort no-op — nothing breaks).
>
> **Still open:** the rest of Phase 1 (RLS regression test + CI, structured logging/error tracking, durable rate-limit) and all of Phases 2–3 (MFA, compliance program, backups/PITR, AV scanning, deployment separation, etc.).

---

## 1. Executive summary

Adminidor is, at its core, a **well-built and security-conscious application**. The authorization model is RLS-first and structurally sound: every one of the 9 tables has Row-Level Security enabled, admin-write is enforced through the recursion-safe `is_admin()` SECURITY DEFINER function, and the previously-critical **privilege-escalation hole (member self-promoting to admin) is genuinely closed** by migration `0007` using two independent controls (column-level `REVOKE/GRANT UPDATE` + a `BEFORE UPDATE` trigger). The prior review's application-layer fixes — CSV formula-injection neutralization, R2 filename sanitization + size/type caps, presigned-URL owner binding, assistant rate limiting, admin-query self-gating, server-only guards — are all confirmed present in the working tree. Server code consistently uses token-revalidated `getUser()` (never `getSession()`), and every server action validates input with zod and self-gates auth.

The gap is **not in the access rules — it is in everything that surrounds them**: defense-in-depth at the HTTP edge, accountability/auditability, observability, and compliance governance. For a firm whose core business is storing `national_id`, dates of birth, PEP flags, and AML screening results, three categories stand out as material:

1. **Zero audit logging.** There is no `audit_log` table and no logging anywhere (`grep` for `audit` / `console.` across `src/` and `supabase/` returns nothing). Nobody can answer "who viewed/changed/deleted this client's KYC record or downloaded this AML document, and when." This is close to a compliance *defect* under GDPR Art. 5(2)/30 and Ley 10/2010 record-keeping, not merely hardening.
2. **No HTTP security headers at all.** `next.config.ts` has no `headers()` block and `proxy.ts` sets none — so no CSP, HSTS, `X-Frame-Options`, nosniff, or Referrer-Policy. The KYC/AML console is clickjackable and has no XSS containment backstop (the Assistant renders model output).
3. **No safety net.** No test runner, no CI, no committed RLS regression test. The only proof that the critical `0007` fix holds was a throwaway script. A one-line edit to a policy or a future migration can silently re-open privilege escalation with zero signal.

**Top 5 things to do next (in order):**

1. **Ship a security-header block** (CSP report-only → enforce, HSTS, frame-ancestors, nosniff) in `next.config.ts` — hours of work, closes ~10 findings at once.
2. **Add an append-only `audit_log` table + DB triggers** on `clients`/`beneficial_owners`/`aml_screenings`/`profiles`, plus app-level events for document downloads and exports. The single highest-value compliance control.
3. **Commit an RLS authorization-matrix test + a CI gate** (lint, `tsc`, `npm audit`, secret-scan, the matrix). Converts "fixed once" into "continuously verified."
4. **Minimize PII egress to Anthropic** (strip `national_id` and raw AML notes in `clampClient`) and confirm/document the Anthropic DPA + zero-retention.
5. **Enable MFA for admins + login rate-limit/CAPTCHA** — account takeover of an admin is the highest-value attack path, and there is currently no second factor.

---

## 2. What's already solid

Credit where due — these are in place and verified, and should be **kept and locked down with tests** rather than re-touched:

- **RLS-first authorization across all 9 tables.** Reads firm-wide for staff (documented single-firm model), writes admin-gated via `is_admin()`, time entries owner-scoped, assistant conversations strictly owner-only. (`0001_init.sql`, `0002_clients_kyc_aml.sql`)
- **The critical privilege-escalation fix (`0007`).** Column-level `revoke update on profiles` + `grant update (full_name, locale)` + `prevent_role_self_change()` trigger that correctly allows the service-role path (`auth.uid()` null) while blocking a logged-in member. The INSERT vector is closed too (`handle_new_user` hardcodes `role='member'`). *(supabase/migrations/0007_security_hardening.sql)*
- **Correct auth primitives.** `getUser()` everywhere (token-revalidated), `getSession()` nowhere; `(app)/layout.tsx` guards pages and each route handler independently re-checks auth; admin actions self-gate with `requireAdmin()`. Unconfigured state **fails closed** (redirects to login).
- **Disciplined mutation surface.** Every `"use server"` action accepts `unknown` and validates with zod; privileged actions are role-gated in app code *and* RLS.
- **Prior remediations confirmed in-tree.** `sanitizeFileName()` (basename + char-strip + leading-dot strip), CSV `csvCell` formula neutralization, presigned PUT pinning content-type + 25 MB `ContentLength`, `attachDocument` owner-prefix binding (`documents/actions.ts:38-41`), per-user assistant rate limit, `import "server-only"` on the Supabase/R2 secret modules, content-type allowlist that **excludes SVG and text/html** (the load-bearing stored-XSS control).
- **Assistant data boundary.** Tools run under the user's RLS-scoped client (never the service-role client); `propose_time_entry` performs no write — it drafts an entry committed via the existing RLS-scoped `createTimeEntry`.
- **Secrets hygiene.** No privileged secret carries `NEXT_PUBLIC_`; all read only in server modules; `.env.local` gitignored and never committed; history scan clean; zero `console.*` so nothing is logged.

---

## 3. Open findings by severity

De-duplicated across dimensions (the security-headers and audit-log gaps surfaced in nearly every dimension and are collapsed to one row each). **Already-fixed items are excluded.**

| Severity | Area | Issue | Fix | Effort |
|---|---|---|---|---|
| **High** | Auditability / Compliance | **No audit log of any kind** — no record of who read/changed/deleted KYC/AML/PII, who exported time entries, or who downloaded documents. `deleteClient` (`clients/actions.ts:138`) is a hard `delete` with `ON DELETE CASCADE` that wipes UBO/AML/docs with no trace. | Append-only `audit_log` (migration 0008) + AFTER triggers on `clients`/`beneficial_owners`/`aml_screenings`/`profiles`; app-level events for document download, CSV/PDF export, report approval. | Medium |
| **High** | HTTP headers | **No CSP / clickjacking defense.** No `headers()` in `next.config.ts`; `proxy.ts` sets none → no CSP, no `frame-ancestors`/`X-Frame-Options`. KYC/AML console is framable; Assistant renders model output with no XSS backstop. | `headers()` block: strict CSP (report-only → enforce), `frame-ancestors 'none'` + `X-Frame-Options: DENY`. | Small–Med |
| **High** | Authn | **No MFA for admins.** Login is a single `signInWithPassword` (`login-form.tsx`); no `aal2` anywhere. A phished admin password = total AML/PII access. | Enable Supabase TOTP MFA; gate admin pages/actions on AAL2. | Medium |
| **High** | Test / CI | **No committed RLS regression test; no CI.** Only `dev/build/start/lint` scripts; no `.github/`. The `0007` fix is unverified by anything repeatable. | Vitest authorization-matrix suite vs disposable Supabase + CI (lint, `tsc`, `npm audit`, secret-scan, tests) as required checks. | Medium |
| **High** | Secrets / CI | **No secret scanning** (pre-commit or CI) despite service-role key, R2 secret, Anthropic key. `.env.local` exists on disk. | gitleaks pre-commit + CI job; enable GitHub push-protection. | Small |
| **Medium** | Authn | **No login rate-limit / brute-force protection.** `signInWithPassword` called directly from browser; the in-app `rateLimit()` is used only by the assistant route. | Enable Supabase Auth rate-limit + CAPTCHA (Turnstile/hCaptcha); consider server-action login wrapper keyed on IP+email. | Small–Med |
| **Medium** | Edge auth | **Auth enforced only in layout + per-handler — fail-open by omission.** `proxy.ts` refreshes the session but never denies; a future `route.ts` that forgets `getCurrentUser()` is reachable unauthenticated. | Add an allowlist-based deny in `proxy.ts` (everything but `(auth)` + assets requires a user) — belt-and-braces, keep per-handler checks. | Small |
| **Medium** | Config / Secrets | **No boot-time env validation.** Every config coalesces missing vars to `""`; a wrong/blank service-role key ships and "looks healthy." | zod env schema (or `@t3-oss/env-nextjs`) imported from `instrumentation.ts`; validate shape (URL, JWT, `sk-ant-` prefix), fail fast. | Small |
| **Medium** | Assistant / GDPR | **KYC/AML PII egresses to Anthropic.** `clampClient` (`tools.ts`) truncates `notes` and caps arrays but does **not** strip `national_id` or AML hit detail before sending to the API. DPA/zero-retention/RoPA unconfirmed. | Redact `national_id` + raw AML notes from tool results (or gate full-client egress to admins); confirm + document DPA, zero-retention, RoPA entry. | Small |
| **Medium** | Observability | **No structured logging / error tracking.** Zero `console.*`; assistant catch collapses everything to `assistant_error` with nothing recorded. Operators are blind to bugs vs attacks vs outages. | Add pino + an error tracker (Sentry/GlitchTip self-hosted for EU residency); `error.tsx`/`global-error.tsx`; PII scrub in `beforeSend`. | Medium |
| **Medium** | Authz / Auditability | **Write actions report success on zero-row RLS matches.** `updateTimeEntry`/`deleteTimeEntry`/`deleteClient`/`deleteDocument` only check `error`, so an RLS denial returns `{ok:true}` — masks denials, weakens future audit accuracy. | `.select('id')` and treat zero rows as `forbidden`/`not_found`. | Small |
| **Medium** | HTTP headers | **No HSTS / nosniff / Referrer-Policy / Permissions-Policy.** CSV + timesheet-PDF routes stream attacker-influenced content; URLs carry `clientId`/`from`/`to`. | Add HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, deny-by-default `Permissions-Policy`. | Trivial |
| **Medium** | DoS / Cost | **Rate-limit is in-memory + chat-only; no global Anthropic spend cap.** Per-process `Map` multiplies by instance count on serverless; CSV/PDF/presign routes unthrottled. | Shared-store limiter (Upstash/Postgres) + global daily token/spend cap + billing alerts; throttle export routes. | Medium |
| **Medium** | R2 / Malware | **No AV/malware scanning of uploads.** Allowlisted-but-malicious files (macro PDF/DOCX, polyglot) are re-served to staff and embedded in client-facing report PDFs. | Post-upload scan (R2 event → Worker/ClamAV or hosted API) + magic-byte validation; gate downloads on `scan_status='clean'`. | Large |
| **Medium** | Backups / DR | **No documented PITR / R2 versioning / restore runbook.** AML records legally retained ~10 yrs; one delete or account incident is currently unrecoverable. | Enable Supabase PITR + R2 versioning/Object-Lock; off-platform `pg_dump`; write + rehearse a restore runbook. | Medium |
| **Medium** | Erasure / Remanence | **Client delete orphans documents rows + R2 objects.** `documents.owner_id` has no FK to `clients`; `deleteClient` deletes only the `clients` row; R2 objects under `client/<id>/` linger → defeats GDPR Art. 17 erasure. | On client/project delete, enumerate + delete `documents` rows and R2 objects (or add FK + transactional cleanup / GC job). Cover with a test. | Medium |
| **Medium** | Compliance | **No DPIA / RoPA / retention policy / DSR tooling.** Large-scale AML/PEP processing legally requires a DPIA (Art. 35) and RoPA (Art. 30); KYC PII stored forever with no purge. | Commission DPIA; maintain RoPA listing Supabase/R2/Anthropic; define retention schedule + `retention_until` + pg_cron purge/anonymize; build export/erasure tooling. | Medium |
| **Medium** | Supabase config | **Project-level auth settings un-versioned & unknown.** No `config.toml`; JWT TTL, refresh-rotation/reuse-detection, leaked-password (HIBP), email-confirm, captcha all dashboard-only. | Codify `supabase/config.toml`; enable HIBP, refresh-token rotation + reuse detection, short access-token TTL, email confirmation, captcha. | Small |
| **Medium** | R2 account | **Bucket CORS / IAM scope / public-access unverified** (off-repo). An `*` CORS origin or account-wide token widens blast radius. | Verify: token scoped to one bucket least-privilege; no public r2.dev; CORS = exact origins only; capture as committed config; account 2FA. | Small |
| **Medium** | IR / Governance | **No incident-response / breach-notification plan.** With no logging/alerting, the firm cannot establish "awareness" or meet the GDPR Art. 33 72-hour clock. | Write IR plan: detection signals, AEPD/72h path, secret-revocation checklist, session invalidation, post-incident template. | Small |
| **Medium** | Deployment | **No hardened deploy substrate / environment separation.** No IaC; the prior RLS matrix ran against **production**; preview deploys of an AML app are publicly reachable by default. | Separate staging Supabase project; protect/disable preview deploys; enforce HTTPS/HSTS at edge; commit env+headers as IaC. | Medium |
| **Medium** | Test / CI | **No unit tests for security helpers or zod schemas.** `sanitizeFileName`, `csvCell`, `rateLimit`, upload allowlist, `isCurrentUserAdmin` are all pure and untested — a regression silently re-opens a fixed bug. | Vitest unit tests asserting each invariant directly (cheapest, highest-signal). | Small |
| **Medium** | CI | **No migration-drift check.** Migrations hand-applied; nothing proves the live DB matches committed SQL (live DB could be missing `0007`). | CI applies all migrations to ephemeral Postgres + runs the RLS suite; optional `supabase db diff` vs staging. | Medium |
| **Low** | Errors | **Raw Postgres `error.message` returned to client** across all modules (and to admins in the user form). Leaks schema/constraint/RLS detail. | Map to stable localized codes; log raw message server-side keyed to a request id. | Small |
| **Low** | CSRF | **No server-action Origin allowlist; chat POST has no Origin check.** Relies on Next default + SameSite=Lax. | Set `serverActions.allowedOrigins`; add explicit same-origin check on `/assistant/chat`. | Small |
| **Low** | Conventions | **Two actions skip the unknown+zod boundary** — `approveTimesheet` (`reports/actions.ts`) and `deleteDocument` (`documents/actions.ts`). | Accept `unknown`, validate (UUIDs, `YYYY-MM-DD`, enum). | Trivial |
| **Low** | R2 | **Downloads served inline, no forced attachment.** `createDownloadUrl` sets no `ResponseContentDisposition`; safety rests entirely on the allowlist never gaining SVG/HTML. | Add `ResponseContentDisposition: attachment`; comment the SVG/HTML exclusion as a security control. | Trivial |
| **Low** | R2 | **`attachDocument` trusts client-declared size/type; no HeadObject.** Allows dangling rows / metadata divergence. | HeadObject after PUT; populate authoritative size/type; reject if absent. | Small |
| **Low** | R2 | **No lifecycle / retention / versioning** — hard delete is unrecoverable; orphans accumulate. | R2 versioning/Object-Lock + lifecycle + reconciliation sweep. | Medium |
| **Low** | Secrets | **`import "server-only"` missing on Anthropic modules** (`anthropic/config.ts`, `client.ts`) — the one gap the `0007` round missed. | Add `import "server-only";` as line 1 of both. | Trivial |
| **Low** | Secrets | **No rotation runbook / production secret-store guidance.** Cached module-level clients require redeploy to pick up rotation. | Document per-secret rotation + cadence + offboarding trigger; use platform secret store. | Small |
| **Low** | Authn | **Weak password policy** — `min(8)` only, no complexity/HIBP. | Enable Supabase HIBP + raise to 12+ / zxcvbn; force first-login change for admin-provisioned accounts. | Small |
| **Low** | Headers | **`X-Powered-By` disclosed; no COOP/CORP.** | `poweredByHeader:false`; add COOP/CORP `same-origin`. | Trivial |
| **Low** | DoS | **No request-body size limit; assistant message length unbounded.** | Set `serverActions.bodySizeLimit`; cap message length; validate `conversationId` as UUID. | Trivial |
| **Low** | Encryption | **No field-level encryption** of `national_id`/DOB/AML at rest — relies on platform default only. | pgsodium/Vault or app-layer encryption for `national_id` + AML detail; document key custody. | Medium |
| **Low** | Deps | **No Node pin, Dependabot/Renovate, `.npmrc`, or `npm ci` discipline; postcss <8.5.10 (build-time).** | Add `engines`/`.nvmrc`/`packageManager`, Dependabot weekly, `.npmrc engine-strict`, use `npm ci`. | Small |

**Info / accepted decisions (no action unless circumstances change):** all-staff read of every document/KYC record incl. timesheet PDF route (consciously accepted single-firm model, `SECURITY_REVIEW.md #7`) — **revisit now that the firm is in production and audit logging is on the table**, and at minimum pair it with read-access logging; cookie attributes rely on `@supabase/ssr` defaults (sound but unasserted); encryption-at-rest via platform default (acceptable but undocumented).

---

## 4. Phased hardening roadmap

### Phase 0 — Now (days): high-leverage, small effort

| Item | What / Where | Why (regulated-data tie-in) | Effort |
|---|---|---|---|
| **Security headers** | `headers()` block in `next.config.ts` on `/(.*)`: CSP (start `Content-Security-Policy-Report-Only`), `frame-ancestors 'none'` + `X-Frame-Options: DENY`, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `poweredByHeader:false`. For CSP, account for next/font + Recharts inline styles (`style-src 'self' 'unsafe-inline'` in v1) and `connect-src` for the Supabase + R2 origins the browser calls. | Clickjacking of the KYC/AML console and a missing XSS backstop (Assistant renders model output) are baseline failures for PII handling. One change closes ~10 findings. | Small |
| **Anthropic server-only guard** | `import "server-only";` line 1 of `src/lib/anthropic/config.ts` + `client.ts`. | A billable, privileged key one careless client import from the browser bundle. | Trivial |
| **PII minimization to Anthropic** | In `clampClient` (`tools.ts`), strip/redact `national_id` and raw AML notes; or gate full-client egress to admins. | Special-category-adjacent AML data leaves the processor boundary on every Assistant query touching a client. | Small |
| **Env validation** | zod env schema imported from `instrumentation.ts`; validate shape, fail fast. | A blank/wrong service-role key currently ships looking healthy — silent misconfig on a regulated system. | Small |
| **Error-message hygiene** | Map DB `error.message` → stable codes across `**/actions.ts`; log raw server-side. | Stops schema/RLS-detail leakage to clients; precondition for clean audit logging. | Small |
| **Stop silent RLS-denial successes** | `.select('id')` in the mutating actions; zero rows → `forbidden`/`not_found`. | Makes authorization denials observable — the hook the audit log will hang on. | Small |
| **Login throttle + CAPTCHA** | Enable Supabase Auth rate-limit + Turnstile/hCaptcha on `login-form.tsx`. | Account takeover of an admin is the top path to bulk AML/PII; today unthrottled at the app layer. | Small |
| **Body/Origin caps** | `serverActions.bodySizeLimit` + `allowedOrigins`; cap assistant message length; same-origin check on `/assistant/chat`. | Cheap cost/abuse + CSRF defense-in-depth on a token-spending POST. | Trivial |
| **Forced-attachment downloads** | `ResponseContentDisposition: attachment` in `createDownloadUrl`; comment the SVG/HTML allowlist exclusion as a security control. | Removes the implicit coupling where XSS-safety rests only on the allowlist. | Trivial |

### Phase 1 — Short term (1–2 weeks)

| Item | What / Where | Why | Effort |
|---|---|---|---|
| **Audit log (the keystone)** | Migration `0008`: append-only `audit_log` (actor_id, action, entity_type, entity_id, before/after jsonb, occurred_at), INSERT-only RLS / no UPDATE/DELETE, admin-read. AFTER triggers on `clients`/`beneficial_owners`/`aml_screenings`/`profiles(role)` (covers direct-PostgREST + service-role paths); app-level events for `getDocumentDownloadUrl`, the CSV export route, the timesheet-PDF route, and `approveTimesheet`. | GDPR Art. 5(2)/30 accountability + Ley 10/2010 record-keeping. Without it the firm cannot scope a breach or prove CDD/EDD decisions. Highest business value. | Medium |
| **RLS regression matrix** | `tests/rls/authorization-matrix.test.ts` (Vitest) vs a disposable Supabase project: member→`role=admin` blocked, member `full_name` update allowed, anon cannot read clients, member cannot write clients/projects/UBO/AML, time-entry owner binding, conversation isolation, assistant tools never see another user's data. | The only thing that proves `0007` still holds; today a future migration can silently re-open priv-esc. | Medium |
| **Helper + schema unit tests** | Vitest for `sanitizeFileName`, `csvCell`, `rateLimit`, `uploadRequestSchema`, `timeEntryInputSchema`, `isCurrentUserAdmin`. | Locks every prior fix as a continuously-verified invariant. | Small |
| **CI pipeline** | `.github/workflows/ci.yml`: `npm ci`, lint, `tsc --noEmit`, `npm audit`, the Vitest suites; `security.yml`: gitleaks + dependency-review + CodeQL. Branch protection on `main`. Apply migrations to ephemeral Postgres to catch drift. | No assurance gate before code touching AML data ships; secrets/vuln-deps reach prod undetected. | Medium |
| **Edge auth deny** | Allowlist gate in `proxy.ts` (deny unauthenticated everywhere but `(auth)` + assets), keeping per-handler checks. | Converts fail-open-by-omission to fail-closed-by-default. | Small |
| **Structured logging + error tracking** | pino + Sentry/GlitchTip (self-hosted, EU residency); `error.tsx`/`global-error.tsx`; log the assistant/tool catch blocks; PII scrub. | Operators currently blind; cannot establish breach "awareness." | Medium |
| **Durable rate-limit + spend cap** | Move `rate-limit.ts` to Upstash/Postgres; global daily Anthropic token cap; throttle CSV/PDF; billing alerts. | Per-process limiter is bypassed on serverless; runaway Opus loop = unbounded bill. | Medium |

### Phase 2 — Medium term (1–2 months)

| Item | What / Where | Why | Effort |
|---|---|---|---|
| **Admin MFA (AAL2)** | Supabase TOTP enrollment + gate admin pages/actions on `getAuthenticatorAssuranceLevel()==='aal2'`. | A single phished admin password = full KYC/AML access; also an AML supervisory expectation. | Medium |
| **Compliance program** | DPIA (Art. 35) covering KYC/AML/PEP + the Assistant LLM flow; RoPA (Art. 30) listing Supabase/R2/Anthropic + locations; signed DPAs (confirm Anthropic zero-retention + EU residency); documented lawful basis. | Mandatory for large-scale special-category processing; currently absent. | Medium |
| **Retention + DSR tooling** | `relationship_ended_at`/`retention_until` columns + pg_cron purge/anonymize; admin export (Art. 15/20) + anonymization (Art. 17 with the AML statutory-retention exception). | Art. 5(1)(c)/(e) minimization/storage-limitation; today KYC PII kept forever. | Medium |
| **Fix erasure/orphan bug** | On client/project delete, delete `documents` rows + R2 objects under `client/<id>/` (FK + transactional cleanup or GC job). | Concrete defect: deletes leave `national_id`-bearing files in R2 → failed erasure + data remanence. | Medium |
| **Backups / PITR / DR** | Enable Supabase PITR (document RPO/RTO); R2 versioning + Object-Lock; off-platform `pg_dump`; restore runbook + rehearsal. | ~10-yr AML retention is legally mandated; one delete/account incident is currently unrecoverable. | Medium |
| **Supabase + R2 config codified** | `supabase/config.toml` (HIBP, refresh-rotation + reuse-detection, short JWT TTL, email-confirm, captcha); verify R2 token least-privilege + no public bucket + exact-origin CORS + account 2FA. | First-class controls currently dashboard-only and unreviewed. | Small |
| **Field-level encryption** | pgsodium/Vault for `national_id` + AML hit detail. | Service-role/backup compromise otherwise yields cleartext national identifiers. | Medium |
| **AV scanning** | R2 event → ClamAV/hosted scan; magic-byte validation; gate downloads on `scan_status='clean'`. | Firm otherwise a malware vector among staff and to clients receiving report PDFs. | Large |
| **Dependency policy** | Dependabot/Renovate weekly; `engines`/`.nvmrc`/`packageManager`; `.npmrc engine-strict`; `npm ci` in CI; resolve postcss advisory. | Patches/advisories otherwise unnoticed; non-reproducible builds. | Small |
| **Deployment separation** | Separate staging Supabase project; protect/disable preview deploys; enforce HTTPS/HSTS at edge; env + headers as IaC. | The RLS matrix ran against **production**; preview deploys of an AML app are publicly reachable by default. | Medium |

### Phase 3 — Ongoing

| Item | What / Where | Why | Effort |
|---|---|---|---|
| **Incident-response plan** | Detection signals (auth-failure spikes, RLS denials, admin anomalies — once logging exists), AEPD/72h notification path, secret-revocation checklist (rotate Supabase service-role + R2 + Anthropic, force resets, invalidate sessions), post-incident template. | GDPR Art. 33/34 obligation; today no IR process and no telemetry to feed it. | Small |
| **Secret rotation cadence** | 90-day rotation + immediate-on-offboarding/leak; note cached clients need redeploy. | Limits exposure of a silently-leaked key; predictable response to compromise. | Small |
| **Periodic access review** | Keep the admin set minimal and reviewed; revisit the all-staff-read decision for KYC/AML fields; add bulk-export/anomaly alerting. | Insider risk dominates the all-staff-read + no-audit-log model. | Small |
| **Pen-test / security review cadence** | Annual external pen test + a review on each major feature; re-run the RLS matrix in CI on every PR. | Catches drift and new attack surface as the app evolves. | Medium |
| **CSP enforcement + monitoring** | Promote CSP from Report-Only to enforce once Recharts/font violations are tuned; keep a violation report sink. | Avoids silently breaking the dashboard while gaining real XSS containment. | Small |

---

## 5. Quick-win checklist

Ordered by leverage — top items deliver the most risk reduction per hour. Copy-paste and tick off:

```
[ ] Add headers() to next.config.ts: CSP (Report-Only first), frame-ancestors 'none' +
    X-Frame-Options: DENY, HSTS, X-Content-Type-Options: nosniff, Referrer-Policy,
    Permissions-Policy; set poweredByHeader: false
[ ] Add `import "server-only";` to src/lib/anthropic/config.ts and client.ts
[ ] Redact national_id + raw AML notes in clampClient (src/modules/assistant/tools.ts)
[ ] Add zod env-validation module imported from instrumentation.ts (fail fast on bad config)
[ ] Enable Supabase Auth rate-limit + CAPTCHA on the login form; turn on HIBP/leaked-password
[ ] Map raw error.message -> stable codes in **/actions.ts (esp. admin user form); log raw server-side
[ ] Make mutating actions select('id') and return forbidden/not_found on zero rows
[ ] ResponseContentDisposition: attachment in createDownloadUrl; comment the SVG/HTML allowlist exclusion
[ ] Set serverActions.bodySizeLimit + allowedOrigins; cap assistant message length; UUID-validate conversationId
[ ] Add allowlist auth deny in src/proxy.ts (fail-closed by default; keep per-handler checks)
[ ] Add gitleaks pre-commit hook + enable GitHub secret scanning / push protection
[ ] Create migration 0008: append-only audit_log + AFTER triggers on clients/beneficial_owners/
    aml_screenings/profiles; app events for document downloads + CSV/PDF exports + report approval
[ ] Add Vitest: unit tests (sanitizeFileName, csvCell, rateLimit, upload + time schemas, isCurrentUserAdmin)
[ ] Add Vitest RLS authorization-matrix test vs a disposable Supabase project (member self-promote blocked)
[ ] Add .github/workflows: ci.yml (npm ci, lint, tsc, npm audit, tests) + security.yml (gitleaks,
    dependency-review, CodeQL); branch-protect main
[ ] Fix client-delete orphaning: delete documents rows + R2 objects under client/<id>/ on deleteClient
[ ] Confirm & document the Anthropic DPA + zero-retention; add the transfer to the RoPA
[ ] Commit supabase/config.toml (refresh-token rotation+reuse-detection, short JWT TTL, email confirm)
[ ] Verify R2: bucket non-public, token scoped least-privilege to one bucket, CORS = exact origin only
[ ] Add engines/.nvmrc/packageManager + Dependabot weekly; switch installs to npm ci
```

---

*Relevant files cited: `next.config.ts`, `src/proxy.ts`, `src/lib/supabase/middleware.ts`, `src/app/[locale]/(app)/layout.tsx`, `src/modules/clients/actions.ts`, `src/modules/documents/actions.ts`, `src/modules/assistant/tools.ts`, `src/app/[locale]/(app)/assistant/chat/route.ts`, `src/lib/anthropic/{config,client}.ts`, `src/lib/r2/{actions,presign}.ts`, `src/lib/rate-limit.ts`, `supabase/migrations/0001–0007`. Already-fixed items (migration 0007 priv-esc, CSV/R2/rate-limit/owner-binding/server-only) acknowledged as DONE and excluded from open findings.*
