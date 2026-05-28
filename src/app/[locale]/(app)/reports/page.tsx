import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ReportsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("reports");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-foreground/60">{t("subtitle")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/reports/timesheet" className="block">
          <Card className="h-full transition hover:border-foreground/20">
            <h2 className="font-medium">{t("timesheet.title")}</h2>
            <p className="mt-1 text-sm text-foreground/60">
              {t("timesheet.description")}
            </p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
