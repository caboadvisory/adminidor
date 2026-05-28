import { createClient } from "@/lib/supabase/server";
import type { Project } from "./types";

// Reference query for the Projects module. Full CRUD lands in a later milestone.
export async function listProjects(): Promise<Project[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, client_id, name, code, status, hourly_rate, currency, start_date, end_date, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    code: row.code,
    status: row.status,
    hourlyRate: row.hourly_rate,
    currency: row.currency,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
  }));
}
