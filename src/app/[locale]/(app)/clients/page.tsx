import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { kycStatusTone, riskTone } from "@/modules/clients/display";
import { listClients } from "@/modules/clients/queries";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ClientsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("clients");

  const clients = await listClients();
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-foreground/60">
            {t("count", { count: clients.length })}
          </p>
        </div>
        <Link
          href="/clients/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          {t("new")}
        </Link>
      </div>

      {clients.length === 0 ? (
        <Card className="text-sm text-foreground/60">{t("empty")}</Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-foreground/50">
              <tr>
                <th className="px-4 py-3 font-medium">{t("fields.name")}</th>
                <th className="px-4 py-3 font-medium">{t("fields.clientType")}</th>
                <th className="px-4 py-3 font-medium">{t("kyc.status")}</th>
                <th className="px-4 py-3 font-medium">{t("kyc.riskLevel")}</th>
                <th className="px-4 py-3 font-medium">{t("kyc.reviewDue")}</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/clients/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground/70">
                    {t(`type.${c.clientType}`)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={kycStatusTone(c.kycStatus)}>
                      {t(`kycStatus.${c.kycStatus}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={riskTone(c.riskLevel)}>
                      {c.riskLevel ? t(`risk.${c.riskLevel}`) : t("risk.none")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-foreground/70">
                    {c.kycReviewDue
                      ? dateFmt.format(new Date(c.kycReviewDue))
                      : "—"}
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
