import { createClient } from "@/lib/supabase/server";
import type { TimeEntry } from "./types";

// Reference query for the Time reporting module. Full CRUD lands in a later milestone.
export async function listTimeEntries(): Promise<TimeEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_entries")
    .select(
      "id, project_id, user_id, work_date, minutes, description, billable, created_at",
    )
    .order("work_date", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    workDate: row.work_date,
    minutes: row.minutes,
    description: row.description,
    billable: row.billable,
    createdAt: row.created_at,
  }));
}
