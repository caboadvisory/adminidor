"use server";

import { basename } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getCurrentUser } from "@/lib/supabase/auth";
import {
  ALLOWED_UPLOAD_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
  isR2Configured,
} from "./config";
import { createUploadUrl } from "./presign";

const uploadRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z
    .string()
    .min(1)
    .refine((v) => ALLOWED_UPLOAD_CONTENT_TYPES.includes(v), {
      message: "unsupported_content_type",
    }),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  ownerType: z.enum(["client", "project"]),
  ownerId: z.string().uuid(),
});

// Reduce a user-supplied file name to a safe basename: strips any path
// component (defeats `../` / embedded-slash traversal into another owner's key
// prefix) and replaces anything outside [A-Za-z0-9._-].
function sanitizeFileName(name: string): string {
  const base = basename(name).replace(/[^\w.\-]+/g, "_").slice(0, 200);
  return base.replace(/^\.+/, "") || "file";
}

export type UploadRequest = z.infer<typeof uploadRequestSchema>;

/**
 * Mints a short-lived presigned PUT URL for a direct browser-to-R2 upload.
 * Plumbing for the document modules; not yet wired to UI.
 */
export async function requestUploadUrl(input: UploadRequest) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  if (!isR2Configured()) {
    throw new Error("R2 storage is not configured");
  }

  const { fileName, contentType, size, ownerType, ownerId } =
    uploadRequestSchema.parse(input);

  const key = `${ownerType}/${ownerId}/${randomUUID()}-${sanitizeFileName(fileName)}`;
  const url = await createUploadUrl(key, contentType, size);

  return { url, key };
}
