import { createClient } from "@/lib/supabase/server";
import type {
  TimesheetGroup,
  TimesheetParams,
  TimesheetResult,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Time sheet: all logged time for a client within a period, grouped by project.
export async function getTimesheet(
  params: TimesheetParams,
): Promise<TimesheetResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_entries")
    .select(
      "work_date, minutes, description, amount, project_id, projects!inner(name, currency, client_id)",
    )
    .eq("projects.client_id", params.clientId)
    .gte("work_date", params.from)
    .lte("work_date", params.to)
    .order("work_date", { ascending: true });

  if (error) throw error;

  const groupsMap = new Map<string, TimesheetGroup>();
  for (const row of (data ?? []) as any[]) {
    const projectId = row.project_id as string;
    let group = groupsMap.get(projectId);
    if (!group) {
      group = {
        projectId,
        projectName: row.projects?.name ?? null,
        currency: row.projects?.currency ?? null,
        rows: [],
        subtotalMinutes: 0,
        subtotalAmount: 0,
      };
      groupsMap.set(projectId, group);
    }
    const amount = row.amount == null ? null : Number(row.amount);
    group.rows.push({
      date: row.work_date,
      minutes: row.minutes,
      description: row.description,
      amount,
    });
    group.subtotalMinutes += row.minutes;
    group.subtotalAmount += amount ?? 0;
  }

  const groups = Array.from(groupsMap.values()).sort((a, b) =>
    (a.projectName ?? "").localeCompare(b.projectName ?? ""),
  );

  const totalMinutes = groups.reduce((sum, g) => sum + g.subtotalMinutes, 0);
  const totalsByCurrency: Record<string, number> = {};
  for (const g of groups) {
    const key = g.currency ?? "";
    totalsByCurrency[key] = (totalsByCurrency[key] ?? 0) + g.subtotalAmount;
  }

  return { groups, totalMinutes, totalsByCurrency };
}
