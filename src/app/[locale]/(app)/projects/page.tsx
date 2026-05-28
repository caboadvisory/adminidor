import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { projectStatusTone } from "@/modules/projects/display";
import { listProjects } from "@/modules/projects/queries";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ProjectsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("projects");

  const projects = await listProjects();
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-foreground/60">
            {t("count", { count: projects.length })}
          </p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          {t("new")}
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card className="text-sm text-foreground/60">{t("empty")}</Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-black/[.08] text-left text-xs uppercase tracking-wide text-foreground/50 dark:border-white/[.12]">
              <tr>
                <th className="px-4 py-3 font-medium">{t("fields.name")}</th>
                <th className="px-4 py-3 font-medium">{t("fields.client")}</th>
                <th className="px-4 py-3 font-medium">{t("fields.status")}</th>
                <th className="px-4 py-3 font-medium">{t("fields.hourlyRate")}</th>
                <th className="px-4 py-3 font-medium">{t("fields.startDate")}</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-black/[.05] last:border-0 dark:border-white/[.06]"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${p.id}`}
                      className="font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                    {p.code ? (
                      <span className="ml-2 text-foreground/40">{p.code}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-foreground/70">
                    {p.clientName ? (
                      <Link
                        href={`/clients/${p.clientId}`}
                        className="hover:underline"
                      >
                        {p.clientName}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={projectStatusTone(p.status)}>
                      {t(`status.${p.status}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-foreground/70">
                    {p.hourlyRate != null
                      ? `${p.hourlyRate} ${p.currency}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground/70">
                    {p.startDate ? dateFmt.format(new Date(p.startDate)) : "—"}
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
