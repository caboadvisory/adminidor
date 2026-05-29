// Supplier / firm branding, configurable per deployment via env.
// Defaults to Cabo Advisory SL when unset.
export const FIRM_NAME =
  process.env.NEXT_PUBLIC_FIRM_NAME?.trim() || "Cabo Advisory SL";

// Optional logo. May be an absolute URL or a path under /public (e.g. /logo.png).
export const FIRM_LOGO_URL = process.env.NEXT_PUBLIC_FIRM_LOGO_URL?.trim() || "";
