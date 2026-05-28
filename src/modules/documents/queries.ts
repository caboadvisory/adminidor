import { createClient } from "@/lib/supabase/server";
import type { DocumentOwnerType, StoredDocument } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function mapDocument(row: any): StoredDocument {
  return {
    id: row.id,
    ownerType: row.owner_type,
    ownerId: row.owner_id,
    fileName: row.file_name,
    r2Key: row.r2_key,
    contentType: row.content_type,
    sizeBytes: row.size_bytes == null ? null : Number(row.size_bytes),
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

export async function listDocuments(
  ownerType: DocumentOwnerType,
  ownerId: string,
): Promise<StoredDocument[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapDocument);
}
