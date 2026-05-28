"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getCurrentUser } from "@/lib/supabase/auth";
import { isR2Configured } from "./config";
import { createUploadUrl } from "./presign";

const uploadRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1),
  ownerType: z.enum(["client", "project"]),
  ownerId: z.string().uuid(),
});

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

  const { fileName, contentType, ownerType, ownerId } =
    uploadRequestSchema.parse(input);

  const key = `${ownerType}/${ownerId}/${randomUUID()}-${fileName}`;
  const url = await createUploadUrl(key, contentType);

  return { url, key };
}
