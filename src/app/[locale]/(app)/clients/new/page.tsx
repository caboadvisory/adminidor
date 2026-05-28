import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ClientForm } from "@/modules/clients/components/client-form";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function NewClientPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("clients");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/clients"
          className="text-sm text-foreground/60 hover:underline"
        >
          ← {t("backToList")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{t("createTitle")}</h1>
      </div>
      <ClientForm mode="create" />
    </div>
  );
}
