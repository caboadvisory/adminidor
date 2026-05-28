import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { ClientForm } from "@/modules/clients/components/client-form";
import { getClient } from "@/modules/clients/queries";

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function EditClientPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("clients");

  const client = await getClient(id);
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/clients/${id}`}
          className="text-sm text-foreground/60 hover:underline"
        >
          ← {t("backToList")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{t("editTitle")}</h1>
      </div>
      <ClientForm mode="edit" clientId={id} initial={client} />
    </div>
  );
}
