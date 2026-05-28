import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/supabase/auth";
import { listProjectsForPicker } from "@/modules/projects/queries";
import { DeleteTimeEntryButton } from "@/modules/time/components/delete-time-entry-button";
import { TimeEntryForm } from "@/modules/time/components/time-entry-form";
import { minutesToHours } from "@/modules/time/display";
import { listTimeEntriesByUser } from "@/modules/time/queries";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function TimePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("time");
  const tc = await getTranslations("common");

  const user = await getCurrentUser();
  const [projects, entries] = await Promise.all([
    listProjectsForPicker(),
    user ? listTimeEntriesByUser(user.id) : Promise.resolve([]),
  ]);
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-foreground/60">
          {t("count", { count: entries.length })}
        </p>
      </div>

      {projects.length === 0 ? (
        <Card className="text-sm text-foreground/60">{t("noProjects")}</Card>
      ) : (
        <TimeEntryForm mode="create" projects={projects} />
      )}

      {entries.length === 0 ? (
        <Card className="text-sm text-foreground/60">{t("empty")}</Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-black/[.08] text-left text-xs uppercase tracking-wide text-foreground/50 dark:border-white/[.12]">
              <tr>
                <th className="px-4 py-3 font-medium">{t("fields.date")}</th>
                <th className="px-4 py-3 font-medium">{t("fields.project")}</th>
                <th className="px-4 py-3 font-medium">{t("fields.hours")}</th>
                <th className="px-4 py-3 font-medium">{t("fields.description")}</th>
                <th className="px-4 py-3 font-medium">{t("fields.amount")}</th>
                <th className="px-4 py-3 font-medium">{t("fields.billable")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-black/[.05] last:border-0 dark:border-white/[.06]"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-foreground/70">
                    {dateFmt.format(new Date(e.workDate))}
                  </td>
                  <td className="px-4 py-3">
                    {e.projectName ? (
                      <Link
                        href={`/projects/${e.projectId}`}
                        className="hover:underline"
                      >
                        {e.projectName}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground/70">
                    {minutesToHours(e.minutes)}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-foreground/70">
                    {e.description ?? "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-foreground/70">
                    {e.amount != null
                      ? `${e.amount}${e.currency ? ` ${e.currency}` : ""}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground/70">
                    {e.billable ? "✓" : "—"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link
                      href={`/time/${e.id}/edit`}
                      className="mr-3 text-xs hover:underline"
                    >
                      {tc("edit")}
                    </Link>
                    <DeleteTimeEntryButton id={e.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
