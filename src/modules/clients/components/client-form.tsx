"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient, updateClient } from "@/modules/clients/actions";
import type { Client, ClientType } from "@/modules/clients/types";

const KYC_STATUSES = [
  "not_started",
  "in_progress",
  "verified",
  "rejected",
  "expired",
] as const;
const RISK_LEVELS = ["low", "medium", "high"] as const;
const CURRENCIES = ["EUR", "SEK", "USD", "GBP", "NOK", "DKK"];

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

type Props = {
  mode: "create" | "edit";
  clientId?: string;
  initial?: Client | null;
};

export function ClientForm({ mode, clientId, initial }: Props) {
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  const router = useRouter();

  const [clientType, setClientType] = useState<ClientType>(
    initial?.clientType ?? "entity",
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const currentCurrency = initial?.defaultCurrency ?? "EUR";
  const currencyOptions = CURRENCIES.includes(currentCurrency)
    ? CURRENCIES
    : [currentCurrency, ...CURRENCIES];

  function mapError(code: string) {
    if (code === "forbidden") return t("errors.forbidden");
    if (code === "validation") return t("errors.validation");
    return t("errors.generic");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const fd = new FormData(event.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "");

    const input = {
      clientType,
      name: get("name"),
      registrationNumber: get("registrationNumber"),
      jurisdiction: get("jurisdiction"),
      legalForm: get("legalForm"),
      dateOfBirth: get("dateOfBirth"),
      nationality: get("nationality"),
      nationalId: get("nationalId"),
      contactEmail: get("contactEmail"),
      contactPhone: get("contactPhone"),
      addressLine1: get("addressLine1"),
      addressLine2: get("addressLine2"),
      postalCode: get("postalCode"),
      city: get("city"),
      country: get("country"),
      notes: get("notes"),
      defaultHourlyRate: get("defaultHourlyRate"),
      defaultCurrency: get("defaultCurrency"),
      kycStatus: get("kycStatus"),
      riskLevel: get("riskLevel"),
      kycReviewDue: get("kycReviewDue"),
    };

    setLoading(true);
    if (mode === "create") {
      const result = await createClient(input);
      setLoading(false);
      if (!result.ok) {
        setError(mapError(result.error));
        return;
      }
      router.push(`/clients/${result.id}`);
      router.refresh();
    } else {
      const result = await updateClient(clientId as string, input);
      setLoading(false);
      if (!result.ok) {
        setError(mapError(result.error));
        return;
      }
      router.push(`/clients/${clientId}`);
      router.refresh();
    }
  }

  const cancelHref = mode === "edit" ? `/clients/${clientId}` : "/clients";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
          {t("sections.details")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fields.clientType")} htmlFor="clientType">
            <Select
              id="clientType"
              value={clientType}
              onChange={(e) => setClientType(e.target.value as ClientType)}
            >
              <option value="entity">{t("type.entity")}</option>
              <option value="individual">{t("type.individual")}</option>
            </Select>
          </Field>
          <Field
            label={
              clientType === "entity"
                ? t("fields.nameEntity")
                : t("fields.nameIndividual")
            }
            htmlFor="name"
          >
            <Input id="name" name="name" required defaultValue={initial?.name ?? ""} />
          </Field>

          {clientType === "entity" ? (
            <>
              <Field label={t("fields.registrationNumber")} htmlFor="registrationNumber">
                <Input
                  id="registrationNumber"
                  name="registrationNumber"
                  defaultValue={initial?.registrationNumber ?? ""}
                />
              </Field>
              <Field label={t("fields.jurisdiction")} htmlFor="jurisdiction">
                <Input
                  id="jurisdiction"
                  name="jurisdiction"
                  defaultValue={initial?.jurisdiction ?? ""}
                />
              </Field>
              <Field label={t("fields.legalForm")} htmlFor="legalForm">
                <Input
                  id="legalForm"
                  name="legalForm"
                  defaultValue={initial?.legalForm ?? ""}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label={t("fields.dateOfBirth")} htmlFor="dateOfBirth">
                <Input
                  id="dateOfBirth"
                  name="dateOfBirth"
                  type="date"
                  defaultValue={initial?.dateOfBirth ?? ""}
                />
              </Field>
              <Field label={t("fields.nationality")} htmlFor="nationality">
                <Input
                  id="nationality"
                  name="nationality"
                  defaultValue={initial?.nationality ?? ""}
                />
              </Field>
              <Field label={t("fields.nationalId")} htmlFor="nationalId">
                <Input
                  id="nationalId"
                  name="nationalId"
                  defaultValue={initial?.nationalId ?? ""}
                />
              </Field>
            </>
          )}
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
          {t("sections.contact")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fields.contactEmail")} htmlFor="contactEmail">
            <Input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={initial?.contactEmail ?? ""}
            />
          </Field>
          <Field label={t("fields.contactPhone")} htmlFor="contactPhone">
            <Input
              id="contactPhone"
              name="contactPhone"
              defaultValue={initial?.contactPhone ?? ""}
            />
          </Field>
          <Field label={t("fields.addressLine1")} htmlFor="addressLine1">
            <Input
              id="addressLine1"
              name="addressLine1"
              defaultValue={initial?.addressLine1 ?? ""}
            />
          </Field>
          <Field label={t("fields.addressLine2")} htmlFor="addressLine2">
            <Input
              id="addressLine2"
              name="addressLine2"
              defaultValue={initial?.addressLine2 ?? ""}
            />
          </Field>
          <Field label={t("fields.postalCode")} htmlFor="postalCode">
            <Input
              id="postalCode"
              name="postalCode"
              defaultValue={initial?.postalCode ?? ""}
            />
          </Field>
          <Field label={t("fields.city")} htmlFor="city">
            <Input id="city" name="city" defaultValue={initial?.city ?? ""} />
          </Field>
          <Field label={t("fields.country")} htmlFor="country">
            <Input id="country" name="country" defaultValue={initial?.country ?? ""} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
          {t("sections.billing")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("fields.defaultHourlyRate")}
            htmlFor="defaultHourlyRate"
          >
            <Input
              id="defaultHourlyRate"
              name="defaultHourlyRate"
              type="number"
              step="0.01"
              min="0"
              defaultValue={initial?.defaultHourlyRate ?? ""}
            />
          </Field>
          <Field label={t("fields.currency")} htmlFor="defaultCurrency">
            <Select
              id="defaultCurrency"
              name="defaultCurrency"
              defaultValue={currentCurrency}
            >
              {currencyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
          {t("sections.kyc")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("kyc.status")} htmlFor="kycStatus">
            <Select
              id="kycStatus"
              name="kycStatus"
              defaultValue={initial?.kycStatus ?? "not_started"}
            >
              {KYC_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`kycStatus.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("kyc.riskLevel")} htmlFor="riskLevel">
            <Select
              id="riskLevel"
              name="riskLevel"
              defaultValue={initial?.riskLevel ?? ""}
            >
              <option value="">{t("risk.none")}</option>
              {RISK_LEVELS.map((r) => (
                <option key={r} value={r}>
                  {t(`risk.${r}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("kyc.reviewDue")} htmlFor="kycReviewDue">
            <Input
              id="kycReviewDue"
              name="kycReviewDue"
              type="date"
              defaultValue={initial?.kycReviewDue ?? ""}
            />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
          {t("fields.notes")}
        </h2>
        <Textarea name="notes" defaultValue={initial?.notes ?? ""} />
      </Card>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? tc("saving") : tc("save")}
        </Button>
        <Link
          href={cancelHref}
          className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-foreground/70 transition hover:bg-black/[.04] dark:hover:bg-white/[.06]"
        >
          {tc("cancel")}
        </Link>
      </div>
    </form>
  );
}
