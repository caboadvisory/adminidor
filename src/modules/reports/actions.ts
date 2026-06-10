"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit";
import { FIRM_NAME } from "@/lib/firm";
import { isR2Configured } from "@/lib/r2/config";
import { putObject } from "@/lib/r2/storage";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { buildTimesheetLabels } from "./labels";
import { getPdfLogoDataUri } from "./pdf-logo";
import { renderTimesheetPdf } from "./pdf";
import { getTimesheet } from "./queries";

export type ApproveResult = { ok: true } | { ok: false; error: string };

const approveSchema = z.object({
  clientId: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// Generates the time sheet PDF and stores it on the client as a 'report'
// document. Admin only.
export async function approveTimesheet(input: unknown): Promise<ApproveResult> {
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const { clientId, from, to } = parsed.data;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "forbidden" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return { ok: false, error: "forbidden" };

  if (!isR2Configured()) return { ok: false, error: "r2_not_configured" };

  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .maybeSingle();
  const clientName = client?.name ?? "";

  const locale = await getLocale();
  const [result, labels, logoUrl] = await Promise.all([
    getTimesheet({ clientId, from, to }),
    buildTimesheetLabels(locale),
    getPdfLogoDataUri(),
  ]);

  const pdf = await renderTimesheetPdf(result, {
    firmName: FIRM_NAME,
    logoUrl,
    clientName,
    from,
    to,
    locale,
    labels,
  });

  const key = `client/${clientId}/reports/timesheet-${from}_${to}-${randomUUID()}.pdf`;
  await putObject(key, pdf, "application/pdf");

  const { error } = await supabase.from("documents").insert({
    owner_type: "client",
    owner_id: clientId,
    file_name: `${labels.title} ${from} – ${to}.pdf`,
    r2_key: key,
    content_type: "application/pdf",
    size_bytes: pdf.length,
    uploaded_by: user.id,
    kind: "report",
  });
  if (error) return { ok: false, error: "generic" };

  await logAuditEvent(supabase, "report.approve", clientId, `${from}..${to}`);
  revalidatePath(`/${locale}/clients/${clientId}`);
  return { ok: true };
}
