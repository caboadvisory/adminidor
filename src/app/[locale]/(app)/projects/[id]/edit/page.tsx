import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { listClients } from "@/modules/clients/queries";
import { ProjectForm } from "@/modules/projects/components/project-form";
import { getProject } from "@/modules/projects/queries";

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function EditProjectPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("projects");

  const [project, clients] = await Promise.all([getProject(id), listClients()]);
  if (!project) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/projects/${id}`}
          className="text-sm text-foreground/60 hover:underline"
        >
          ← {t("backToList")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{t("editTitle")}</h1>
      </div>
      <ProjectForm
        mode="edit"
        projectId={id}
        initial={project}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
