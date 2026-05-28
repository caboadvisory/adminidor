"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { isR2Configured } from "@/lib/r2/config";
import { createDownloadUrl } from "@/lib/r2/presign";
import { deleteObject } from "@/lib/r2/storage";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { documentMetaSchema } from "./schema";
import type { DocumentOwnerType } from "./types";

type Result = { ok: true } | { ok: false; error: string };

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

  const { error } = await supabase.from("documents").insert({
    owner_type: parsed.data.ownerType,
    owner_id: parsed.data.ownerId,
    file_name: parsed.data.fileName,
    r2_key: parsed.data.r2Key,
    content_type: parsed.data.contentType,
    size_bytes: parsed.data.sizeBytes ?? null,
    uploaded_by: user.id,
  });
  if (error) return { ok: false, error: error.message };

  await revalidateOwner(parsed.data.ownerType, parsed.data.ownerId);
  return { ok: true };
}

export async function deleteDocument(input: {
  id: string;
  ownerType: DocumentOwnerType;
  ownerId: string;
}): Promise<Result> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "forbidden" };

  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("r2_key")
    .eq("id", input.id)
    .maybeSingle();
  if (fetchError) return { ok: false, error: fetchError.message };

  const { error } = await supabase.from("documents").delete().eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  if (doc?.r2_key && isR2Configured()) {
    try {
      await deleteObject(doc.r2_key);
    } catch {
      // DB row removed; an orphaned R2 object is acceptable and can be swept later.
    }
  }

  await revalidateOwner(input.ownerType, input.ownerId);
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
    .select("r2_key")
    .eq("id", id)
    .maybeSingle();
  if (error || !doc) return { ok: false, error: "not_found" };

  const url = await createDownloadUrl(doc.r2_key);
  return { ok: true, url };
}
