import "server-only";

export const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? "";
export const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? "";
export const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? "";
export const R2_BUCKET = process.env.R2_BUCKET ?? "";
export const R2_ENDPOINT =
  process.env.R2_ENDPOINT ??
  (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : "");

export function isR2Configured(): boolean {
  return Boolean(
    R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET && R2_ENDPOINT,
  );
}

// Upload constraints enforced server-side when minting presigned PUT URLs.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

// Allowlist of content types accepted for document uploads (PDFs, images and
// common office formats). The signed PUT pins the Content-Type, so the browser
// must send exactly this value or R2 rejects the upload.
export const ALLOWED_UPLOAD_CONTENT_TYPES: readonly string[] = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/heic",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];
