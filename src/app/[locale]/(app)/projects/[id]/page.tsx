import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { isR2Configured } from "@/lib/r2/config";
import { DocumentsSection } from "@/modules/documents/components/documents-section";
import { DeleteProjectButton } from "@/modules/projects/components/delete-project-button";
import { projectStatusTone } from "@/modules/projects/display";
import { getProject } from "@/modules/projects/queries";
import { minutesToHours } from "@/modules/time/display";
import { listTimeEntriesByProject } from "@/modules/time/queries";

const sectionTitle =
  "text-sm font-semibold uppercase tracking-wide text-foreground/50";
const dtClass = "text-xs uppercase tracking-wide text-foreground/40";

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className={dtClass}>{label}</dt>
      <dd className="text-sm">{value && value.trim() !== "" ? value : "—"}</dd>
    </div>
  );
}

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function ProjectDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("projects");
  const tc = await getTranslations("common");
  const tTime = await getTranslations("time");

  const project = await getProject(id);
  if (!project) notFound();

  const entries = await listTimeEntriesByProject(id);
  const loggedMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);
  const billableTotal =
    project.billingType === "fixed"
      ? project.fixedPrice
      : entries.reduce(
          (sum, e) => sum + (e.billable && e.amount != null ? e.amount : 0),
          0,
        );

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const fmtDate = (v: string | null) => (v ? dateFmt.format(new Date(v)) : null);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-3">
        <Link
          href="/projects"
          className="text-sm text-foreground/60 hover:underline"
        >
          ← {t("backToList")}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">
              {project.name}
              {project.code ? (
                <span className="ml-2 text-base font-normal text-foreground/40">
                  {project.code}
                </span>
              ) : null}
            </h1>
            <Badge tone={projectStatusTone(project.status)}>
              {t(`status.${project.status}`)}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/projects/${id}/edit`}
              className="inline-flex h-9 items-center rounded-md border border-black/10 px-3 text-sm font-medium transition hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06]"
            >
              {tc("edit")}
            </Link>
            <DeleteProjectButton id={id} />
          </div>
        </div>
      </div>

      <Card className="space-y-4">
        <h2 className={sectionTitle}>{t("sections.details")}</h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className={dtClass}>{t("fields.client")}</dt>
            <dd className="text-sm">
              {project.clientName ? (
                <Link
                  href={`/clients/${project.clientId}`}
                  className="hover:underline"
                >
                  {project.clientName}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <Row label={t("fields.code")} value={project.code} />
          <Row
            label={t("fields.hourlyRate")}
            value={
              project.hourlyRate != null
                ? `${project.hourlyRate} ${project.currency}`
                : null
            }
          />
          <Row
            label={t("fields.billingType")}
            value={t(`billing.${project.billingType}`)}
          />
          {project.billingType === "fixed" ? (
            <Row
              label={t("fields.fixedPrice")}
              value={
                project.fixedPrice != null
                  ? `${project.fixedPrice} ${project.currency}`
                  : null
              }
            />
          ) : null}
          <Row label={t("fields.startDate")} value={fmtDate(project.startDate)} />
          <Row label={t("fields.endDate")} value={fmtDate(project.endDate)} />
        </dl>
      </Card>

      <Card className="space-y-4">
        <h2 className={sectionTitle}>{t("sections.time")}</h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Row
            label={tTime("summary.loggedHours")}
            value={String(minutesToHours(loggedMinutes))}
          />
          <Row
            label={
              project.billingType === "fixed"
                ? tTime("summary.fixedPrice")
                : tTime("summary.billable")
            }
            value={
              billableTotal != null
                ? `${billableTotal} ${project.currency}`
                : "—"
            }
          />
        </dl>
        {entries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-black/[.08] text-left text-xs uppercase tracking-wide text-foreground/50 dark:border-white/[.12]">
                <tr>
                  <th className="py-2 pr-4 font-medium">{tTime("fields.date")}</th>
                  <th className="py-2 pr-4 font-medium">{tTime("fields.user")}</th>
                  <th className="py-2 pr-4 font-medium">{tTime("fields.hours")}</th>
                  <th className="py-2 pr-4 font-medium">{tTime("fields.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-black/[.05] last:border-0 dark:border-white/[.06]"
                  >
                    <td className="py-2 pr-4 whitespace-nowrap text-foreground/70">
                      {dateFmt.format(new Date(e.workDate))}
                    </td>
                    <td className="py-2 pr-4 text-foreground/70">
                      {e.userName ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-foreground/70">
                      {minutesToHours(e.minutes)}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap text-foreground/70">
                      {e.amount != null
                        ? `${e.amount}${e.currency ? ` ${e.currency}` : ""}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-foreground/60">{tTime("empty")}</p>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className={sectionTitle}>{t("sections.documents")}</h2>
        <DocumentsSection
          ownerType="project"
          ownerId={id}
          documents={project.documents}
          r2Configured={isR2Configured()}
        />
      </Card>
    </div>
  );
}
