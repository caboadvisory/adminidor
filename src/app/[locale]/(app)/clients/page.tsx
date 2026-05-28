import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/card";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ClientsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("clients");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <Card className="text-sm text-foreground/60">{t("empty")}</Card>
    </div>
  );
}
