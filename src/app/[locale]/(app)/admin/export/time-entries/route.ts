import { createAdminClient } from "@/lib/supabase/admin";
import { isCurrentUserAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { minutesToHours } from "@/modules/time/display";

/* eslint-disable @typescript-eslint/no-explicit-any */

function csvCell(value: string | number | null | undefined): string {
  let s = value == null ? "" : String(value);
  // Neutralize spreadsheet formula injection: a cell beginning with one of
  // these characters is treated as a formula by Excel/Sheets/LibreOffice and
  // would execute on open. Prefix with a single quote to force it to text.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  if (!(await isCurrentUserAdmin())) {
    return new Response("Forbidden", { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_entries")
    .select(
      "work_date, minutes, description, amount, user_id, projects!inner(name, currency, clients(name)), profiles(full_name)",
    )
    .order("work_date", { ascending: true });
  if (error) return new Response(error.message, { status: 500 });

  // Fall back to email when a user has no full name.
  const admin = createAdminClient();
  const { data: list } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const emailById = new Map(
    (list?.users ?? []).map((u: any) => [u.id, u.email ?? ""]),
  );

  const header = [
    "Client",
    "Project",
    "User",
    "Date",
    "Hours",
    "Description",
    "Cost",
    "Currency",
  ];
  const lines = [header.map(csvCell).join(",")];

  for (const r of (data ?? []) as any[]) {
    lines.push(
      [
        r.projects?.clients?.name ?? "",
        r.projects?.name ?? "",
        r.profiles?.full_name || emailById.get(r.user_id) || "",
        r.work_date,
        minutesToHours(r.minutes),
        r.description ?? "",
        r.amount == null ? "" : Number(r.amount),
        r.projects?.currency ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }

  // Prepend BOM so Excel detects UTF-8.
  const body = "﻿" + lines.join("\r\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="time-entries.csv"',
    },
  });
}
