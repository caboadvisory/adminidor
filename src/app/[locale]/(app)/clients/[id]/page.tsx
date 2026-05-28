import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { isR2Configured } from "@/lib/r2/config";
import { AmlScreeningsSection } from "@/modules/clients/components/aml-screenings-section";
import { BeneficialOwnersSection } from "@/modules/clients/components/beneficial-owners-section";
import { DeleteClientButton } from "@/modules/clients/components/delete-client-button";
import { DocumentsSection } from "@/modules/documents/components/documents-section";
import { kycStatusTone, riskTone } from "@/modules/clients/display";
import { getClient } from "@/modules/clients/queries";

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

export default async function ClientDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("clients");
  const tc = await getTranslations("common");

  const client = await getClient(id);
  if (!client) notFound();

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const fmtDate = (v: string | null) =>
    v ? dateFmt.format(new Date(v)) : null;

  const detailRows: Array<[string, string | null]> =
    client.clientType === "entity"
      ? [
          [t("fields.registrationNumber"), client.registrationNumber],
          [t("fields.jurisdiction"), client.jurisdiction],
          [t("fields.legalForm"), client.legalForm],
        ]
      : [
          [t("fields.dateOfBirth"), fmtDate(client.dateOfBirth)],
          [t("fields.nationality"), client.nationality],
          [t("fields.nationalId"), client.nationalId],
        ];

  const baseRate =
    client.defaultHourlyRate != null
      ? `${client.defaultHourlyRate} ${client.defaultCurrency}`
      : null;

  const contactRows: Array<[string, string | null]> = [
    [t("fields.contactEmail"), client.contactEmail],
    [t("fields.contactPhone"), client.contactPhone],
    [t("fields.addressLine1"), client.addressLine1],
    [t("fields.addressLine2"), client.addressLine2],
    [t("fields.postalCode"), client.postalCode],
    [t("fields.city"), client.city],
    [t("fields.country"), client.country],
  ].filter(([, v]) => v && v.trim() !== "") as Array<[string, string]>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-3">
        <Link
          href="/clients"
          className="text-sm text-foreground/60 hover:underline"
        >
          ← {t("backToList")}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">{client.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{t(`type.${client.clientType}`)}</Badge>
              <Badge tone={kycStatusTone(client.kycStatus)}>
                {t(`kycStatus.${client.kycStatus}`)}
              </Badge>
              <Badge tone={riskTone(client.riskLevel)}>
                {client.riskLevel
                  ? t(`risk.${client.riskLevel}`)
                  : t("risk.none")}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/clients/${id}/edit`}
              className="inline-flex h-9 items-center rounded-md border border-black/10 px-3 text-sm font-medium transition hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06]"
            >
              {tc("edit")}
            </Link>
            <DeleteClientButton id={id} />
          </div>
        </div>
      </div>

      <Card className="space-y-4">
        <h2 className={sectionTitle}>{t("sections.details")}</h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {detailRows.map(([label, value]) => (
            <Row key={label} label={label} value={value} />
          ))}
          <Row label={t("fields.defaultHourlyRate")} value={baseRate} />
        </dl>
      </Card>

      {contactRows.length > 0 ? (
        <Card className="space-y-4">
          <h2 className={sectionTitle}>{t("sections.contact")}</h2>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {contactRows.map(([label, value]) => (
              <Row key={label} label={label} value={value} />
            ))}
          </dl>
        </Card>
      ) : null}

      <Card className="space-y-4">
        <h2 className={sectionTitle}>{t("sections.kyc")}</h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className={dtClass}>{t("kyc.status")}</dt>
            <dd className="mt-0.5">
              <Badge tone={kycStatusTone(client.kycStatus)}>
                {t(`kycStatus.${client.kycStatus}`)}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className={dtClass}>{t("kyc.riskLevel")}</dt>
            <dd className="mt-0.5">
              <Badge tone={riskTone(client.riskLevel)}>
                {client.riskLevel
                  ? t(`risk.${client.riskLevel}`)
                  : t("risk.none")}
              </Badge>
            </dd>
          </div>
          <Row
            label={t("kyc.verifiedAt")}
            value={fmtDate(client.kycVerifiedAt) ?? t("kyc.notVerified")}
          />
          <Row label={t("kyc.reviewDue")} value={fmtDate(client.kycReviewDue)} />
        </dl>
      </Card>

      <Card className="space-y-4">
        <h2 className={sectionTitle}>{t("sections.beneficialOwners")}</h2>
        {client.clientType === "entity" ? (
          <BeneficialOwnersSection
            clientId={id}
            owners={client.beneficialOwners}
          />
        ) : (
          <p className="text-sm text-foreground/60">{t("ubo.onlyEntities")}</p>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className={sectionTitle}>{t("sections.aml")}</h2>
        <AmlScreeningsSection clientId={id} screenings={client.amlScreenings} />
      </Card>

      <Card className="space-y-4">
        <h2 className={sectionTitle}>{t("sections.documents")}</h2>
        <DocumentsSection
          ownerType="client"
          ownerId={id}
          documents={client.documents}
          r2Configured={isR2Configured()}
        />
      </Card>

      {client.notes ? (
        <Card className="space-y-3">
          <h2 className={sectionTitle}>{t("fields.notes")}</h2>
          <p className="whitespace-pre-wrap text-sm text-foreground/80">
            {client.notes}
          </p>
        </Card>
      ) : null}
    </div>
  );
}
