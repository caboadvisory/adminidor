import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Best-effort write to the append-only `audit_log` (migration 0008) via the
 * SECURITY DEFINER `log_audit_event()` RPC. Call it with the request's
 * RLS-scoped Supabase client so `auth.uid()` attributes the actor correctly.
 *
 * Never throws: an audit-write failure (e.g. the migration not yet applied)
 * must not break the user's action. Once structured logging exists (Phase 1),
 * surface these failures instead of swallowing them.
 */
export async function logAuditEvent(
  supabase: SupabaseClient,
  action: string,
  entityId?: string | null,
  summary?: string | null,
): Promise<void> {
  // The entity type is the action's prefix, e.g. "document.download" -> "document".
  const entityType = action.split(".")[0] || "unknown";
  try {
    await supabase.rpc("log_audit_event", {
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId ?? null,
      p_summary: summary ?? null,
    });
  } catch {
    // best-effort; do not block the caller on audit failure
  }
}
