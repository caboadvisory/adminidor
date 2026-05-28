import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import { listClients } from "@/modules/clients/queries";
import { getTimesheet } from "@/modules/reports/queries";
import { minutesToHours } from "@/modules/time/display";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function TimesheetReportPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("reports");

  const clientId = typeof sp.clientId === "string" ? sp.clientId : "";
  const from = typeof sp.from === "string" ? sp.from : "";
  const to = typeof sp.to === "string" ? sp.to : "";
  const hasFilter = Boolean(clientId && from && to);

  const clients = await listClients();
  const result = hasFilter
    ? await getTimesheet({ clientId, from, to })
    : null;

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const numFmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const money = (amount: number, currency: string | null) =>
    `${numFmt.format(amount)}${currency ? ` ${currency}` : ""}`;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/reports"
          className="text-sm text-foreground/60 hover:underline"
        >
          ← {t("backToReports")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{t("timesheet.title")}</h1>
      </div>

      <Card>
        <form method="get" className="grid gap-4 sm:grid-cols-4 sm:items-end">
          <div className="space-y-1.5">
            <label htmlFor="clientId" className="text-sm font-medium">
              {t("timesheet.client")}
            </label>
            <Select id="clientId" name="clientId" required defaultValue={clientId}>
              <option value="" disabled>
                —
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="from" className="text-sm font-medium">
              {t("timesheet.from")}
            </label>
            <Input id="from" name="from" type="date" required defaultValue={from} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="to" className="text-sm font-medium">
              {t("timesheet.to")}
            </label>
            <Input id="to" name="to" type="date" required defaultValue={to} />
          </div>
          <Button type="submit">{t("timesheet.generate")}</Button>
        </form>
      </Card>

      {!hasFilter ? (
        <Card className="text-sm text-foreground/60">
          {t("timesheet.selectPrompt")}
        </Card>
      ) : result && result.groups.length === 0 ? (
        <Card className="text-sm text-foreground/60">{t("timesheet.empty")}</Card>
      ) : result ? (
        <div className="space-y-6">
          {result.groups.map((g) => (
            <Card key={g.projectId} className="space-y-3 overflow-x-auto p-0">
              <div className="flex items-center justify-between gap-4 px-4 pt-4">
                <h2 className="font-medium">{g.projectName ?? "—"}</h2>
                <span className="text-sm text-foreground/60">
                  {minutesToHours(g.subtotalMinutes)} h ·{" "}
                  {money(g.subtotalAmount, g.currency)}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead className="border-y border-black/[.08] text-left text-xs uppercase tracking-wide text-foreground/50 dark:border-white/[.12]">
                  <tr>
                    <th className="px-4 py-2 font-medium">
                      {t("timesheet.columns.date")}
                    </th>
                    <th className="px-4 py-2 font-medium">
                      {t("timesheet.columns.hours")}
                    </th>
                    <th className="px-4 py-2 font-medium">
                      {t("timesheet.columns.description")}
                    </th>
                    <th className="px-4 py-2 font-medium">
                      {t("timesheet.columns.cost")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r, i) => (
                    <tr
                      key={`${g.projectId}-${i}`}
                      className="border-b border-black/[.05] last:border-0 dark:border-white/[.06]"
                    >
                      <td className="px-4 py-2 whitespace-nowrap text-foreground/70">
                        {dateFmt.format(new Date(r.date))}
                      </td>
                      <td className="px-4 py-2 text-foreground/70">
                        {minutesToHours(r.minutes)}
                      </td>
                      <td className="px-4 py-2 text-foreground/70">
                        {r.description ?? "—"}
                        {!r.billable ? (
                          <span className="ml-2 text-xs text-foreground/40">
                            ({t("timesheet.nonBillable")})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-foreground/70">
                        {r.billable && r.amount != null
                          ? money(r.amount, g.currency)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-black/[.08] font-medium dark:border-white/[.12]">
                    <td className="px-4 py-2">{t("timesheet.subtotal")}</td>
                    <td className="px-4 py-2">
                      {minutesToHours(g.subtotalMinutes)}
                    </td>
                    <td className="px-4 py-2" />
                    <td className="px-4 py-2 whitespace-nowrap">
                      {money(g.subtotalAmount, g.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </Card>
          ))}

          <Card className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-medium">{t("timesheet.total")}</span>
            <span className="text-sm">
              {minutesToHours(result.totalMinutes)} h
              {Object.entries(result.totalsByCurrency).map(([cur, amt]) => (
                <span key={cur || "none"} className="ml-3">
                  {money(amt, cur || null)}
                </span>
              ))}
            </span>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
