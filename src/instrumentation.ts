/**
 * Boot-time environment validation. Runs once at server startup (Next.js
 * `register` hook). Catches the silent-misconfiguration failure mode where a
 * blank or malformed key ships and the app "looks healthy" until a request hits
 * it.
 *
 * Policy: the app intentionally degrades gracefully when Supabase/R2/Anthropic
 * are absent (boots to the login screen), so a *missing* var only WARNS. A var
 * that is present but clearly malformed (wrong shape) is a real misconfig — in
 * production that throws to fail fast; in dev it warns.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const isProd = process.env.NODE_ENV === "production";
  const problems: string[] = [];

  const isUrl = (v?: string) => {
    if (!v) return false;
    try {
      new URL(v);
      return true;
    } catch {
      return false;
    }
  };
  const looksJwt = (v?: string) => !!v && v.split(".").length === 3;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropic = process.env.ANTHROPIC_API_KEY;

  if (!url) problems.push("warn:  NEXT_PUBLIC_SUPABASE_URL is not set");
  else if (!isUrl(url))
    problems.push("error: NEXT_PUBLIC_SUPABASE_URL is not a valid URL");

  if (!anon) problems.push("warn:  NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  else if (!looksJwt(anon))
    problems.push("error: NEXT_PUBLIC_SUPABASE_ANON_KEY is not a JWT");

  if (!service)
    problems.push(
      "warn:  SUPABASE_SERVICE_ROLE_KEY is not set (admin features disabled)",
    );
  else if (!looksJwt(service))
    problems.push("error: SUPABASE_SERVICE_ROLE_KEY is not a JWT");

  // An empty string means "Assistant not configured" (a supported state); only
  // flag a value that is present but clearly not an Anthropic key.
  if (anthropic && !anthropic.startsWith("sk-ant-"))
    problems.push(
      "error: ANTHROPIC_API_KEY is set but does not look like an Anthropic key (expected sk-ant-…)",
    );

  // R2 is all-or-nothing for browser uploads.
  const r2Core = [
    process.env.R2_ACCESS_KEY_ID,
    process.env.R2_SECRET_ACCESS_KEY,
    process.env.R2_BUCKET,
    process.env.R2_ENDPOINT || process.env.R2_ACCOUNT_ID,
  ];
  const r2Set = r2Core.filter(Boolean).length;
  if (r2Set > 0 && r2Set < 4)
    problems.push(
      "warn:  R2_* is partially configured (document uploads will fail until complete)",
    );
  if (process.env.R2_ENDPOINT && !isUrl(process.env.R2_ENDPOINT))
    problems.push("error: R2_ENDPOINT is not a valid URL");

  if (problems.length === 0) return;

  const banner = `[adminidor] environment validation:\n  ${problems.join("\n  ")}`;
  const hasErrors = problems.some((p) => p.startsWith("error:"));
  if (isProd && hasErrors) {
    // Fail fast: don't ship a deploy with malformed secrets that looks healthy.
    throw new Error(banner);
  }
  console.warn(banner);
}
