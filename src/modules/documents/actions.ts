"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit";
import { isR2Configured } from "@/lib/r2/config";
import { createDownloadUrl } from "@/lib/r2/presign";
import { deleteObject } from "@/lib/r2/storage";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { documentMetaSchema } from "./schema";
import type { DocumentOwnerType } from "./types";

type Result = { ok: true } | { ok: false; error: string };

const deleteDocumentSchema = z.object({
  id: z.string().uuid(),
  ownerType: z.enum(["client", "project"]),
  ownerId: z.string().uuid(),
});

async function getUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function revalidateOwner(ownerType: DocumentOwnerType, ownerId: string) {
  const locale = await getLocale();
  const base = ownerType === "client" ? "clients" : "projects";
  revalidatePath(`/${locale}/${base}/${ownerId}`);
}

export async function attachDocument(input: unknown): Promise<Result> {
  const parsed = documentMetaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "forbidden" };

  // Bind the stored R2 key to its owner: the key must live under this owner's
  // prefix (as minted by requestUploadUrl). Stops a caller from registering a
  // document row that points at an object under a different owner's prefix.
  const expectedPrefix = `${parsed.data.ownerType}/${parsed.data.ownerId}/`;
  if (!parsed.data.r2Key.startsWith(expectedPrefix)) {
    return { ok: false, error: "invalid_key" };
  }

  const { error } = await supabase.from("documents").insert({
    owner_type: parsed.data.ownerType,
    owner_id: parsed.data.ownerId,
    file_name: parsed.data.fileName,
    r2_key: parsed.data.r2Key,
    content_type: parsed.data.contentType,
    size_bytes: parsed.data.sizeBytes ?? null,
    uploaded_by: user.id,
  });
  if (error) return { ok: false, error: "generic" };

  await logAuditEvent(
    supabase,
    "document.upload",
    parsed.data.ownerId,
    parsed.data.fileName,
  );
  await revalidateOwner(parsed.data.ownerType, parsed.data.ownerId);
  return { ok: true };
}

export async function deleteDocument(input: unknown): Promise<Result> {
  const parsed = deleteDocumentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const { id, ownerType, ownerId } = parsed.data;

  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "forbidden" };

  const { data: doc } = await supabase
    .from("documents")
    .select("r2_key")
    .eq("id", id)
    .maybeSingle();

  // .select() so an RLS denial (not uploader/admin) returns zero rows rather
  // than a silent success.
  const { data: deleted, error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: "generic" };
  if (!deleted || deleted.length === 0) return { ok: false, error: "forbidden" };

  if (doc?.r2_key && isR2Configured()) {
    try {
      await deleteObject(doc.r2_key);
    } catch {
      // DB row removed; an orphaned R2 object is acceptable and can be swept later.
    }
  }

  await logAuditEvent(supabase, "document.delete", id);
  await revalidateOwner(ownerType, ownerId);
  return { ok: true };
}

export async function getDocumentDownloadUrl(
  id: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "forbidden" };
  if (!isR2Configured()) return { ok: false, error: "r2_not_configured" };

  const { data: doc, error } = await supabase
    .from("documents")
    .select("r2_key, file_name")
    .eq("id", id)
    .maybeSingle();
  if (error || !doc) return { ok: false, error: "not_found" };

  // Record the access (KYC/AML documents are regulated material).
  await logAuditEvent(supabase, "document.download", id, doc.file_name);

  const url = await createDownloadUrl(doc.r2_key, doc.file_name);
  return { ok: true, url };
}
