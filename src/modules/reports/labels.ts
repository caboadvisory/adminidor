import { getTranslations } from "next-intl/server";
import type { TimesheetPdfLabels } from "./pdf";

export async function buildTimesheetLabels(
  locale: string,
): Promise<TimesheetPdfLabels> {
  const t = await getTranslations({ locale, namespace: "reports" });
  return {
    title: t("timesheet.title"),
    supplier: t("timesheet.supplier"),
    client: t("timesheet.client"),
    period: t("timesheet.period"),
    date: t("timesheet.columns.date"),
    hours: t("timesheet.columns.hours"),
    description: t("timesheet.columns.description"),
    cost: t("timesheet.columns.cost"),
    subtotal: t("timesheet.subtotal"),
    total: t("timesheet.total"),
    nonBillable: t("timesheet.nonBillable"),
  };
}
