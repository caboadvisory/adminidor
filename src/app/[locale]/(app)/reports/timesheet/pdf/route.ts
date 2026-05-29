import { FIRM_LOGO_URL, FIRM_NAME } from "@/lib/firm";
import { getCurrentUser } from "@/lib/supabase/auth";
import { listClients } from "@/modules/clients/queries";
import { buildTimesheetLabels } from "@/modules/reports/labels";
import { renderTimesheetPdf } from "@/modules/reports/pdf";
import { getTimesheet } from "@/modules/reports/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;

  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId") ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!clientId || !from || !to) {
    return new Response("Missing clientId, from or to", { status: 400 });
  }

  const [result, clients, labels] = await Promise.all([
    getTimesheet({ clientId, from, to }),
    listClients(),
    buildTimesheetLabels(locale),
  ]);
  const clientName = clients.find((c) => c.id === clientId)?.name ?? "";

  const pdf = await renderTimesheetPdf(result, {
    firmName: FIRM_NAME,
    logoUrl: FIRM_LOGO_URL || undefined,
    clientName,
    from,
    to,
    locale,
    labels,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="timesheet-${from}_${to}.pdf"`,
    },
  });
}
