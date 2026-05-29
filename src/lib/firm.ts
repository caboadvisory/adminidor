// Supplier / firm branding, configurable per deployment via env.
export const FIRM_NAME =
  process.env.NEXT_PUBLIC_FIRM_NAME?.trim() || "Cabo Advisory SL";

// Logo for on-screen surfaces (e.g. the report header <img>). An SVG path is
// fine here. Defaults to the bundled brand wordmark; override per deployment.
// NOTE: the PDF uses a raster version instead (see modules/reports/pdf-logo),
// because @react-pdf/renderer's <Image> cannot render SVG.
export const FIRM_LOGO_URL =
  process.env.NEXT_PUBLIC_FIRM_LOGO_URL?.trim() || "/brand/wordmark.svg";
