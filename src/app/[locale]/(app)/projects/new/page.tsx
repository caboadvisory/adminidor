import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { listClients } from "@/modules/clients/queries";
import { ProjectForm } from "@/modules/projects/components/project-form";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function NewProjectPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("projects");

  const clients = await listClients();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/projects"
          className="text-sm text-foreground/60 hover:underline"
        >
          ← {t("backToList")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{t("createTitle")}</h1>
      </div>
      {clients.length === 0 ? (
        <Card className="text-sm text-foreground/60">{t("noClients")}</Card>
      ) : (
        <ProjectForm
          mode="create"
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        />
      )}
    </div>
  );
}
