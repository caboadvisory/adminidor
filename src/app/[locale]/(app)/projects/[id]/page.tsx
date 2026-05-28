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

  const project = await getProject(id);
  if (!project) notFound();

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
          <Row label={t("fields.startDate")} value={fmtDate(project.startDate)} />
          <Row label={t("fields.endDate")} value={fmtDate(project.endDate)} />
        </dl>
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
