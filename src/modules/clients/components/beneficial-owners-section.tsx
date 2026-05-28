"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import {
  addBeneficialOwner,
  deleteBeneficialOwner,
} from "@/modules/clients/actions";
import type { BeneficialOwner } from "@/modules/clients/types";

export function BeneficialOwnersSection({
  clientId,
  owners,
}: {
  clientId: string;
  owners: BeneficialOwner[];
}) {
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const fd = new FormData(form);
    const input = {
      fullName: String(fd.get("fullName") ?? ""),
      dateOfBirth: String(fd.get("dateOfBirth") ?? ""),
      nationality: String(fd.get("nationality") ?? ""),
      ownershipPercentage: String(fd.get("ownershipPercentage") ?? ""),
      isPep: fd.get("isPep") === "on",
      notes: String(fd.get("notes") ?? ""),
    };

    setLoading(true);
    const res = await addBeneficialOwner(clientId, input);
    setLoading(false);
    if (!res.ok) {
      setError(res.error === "validation" ? t("errors.validation") : t("errors.generic"));
      return;
    }
    form.reset();
    router.refresh();
  }

  async function onDelete(id: string) {
    const res = await deleteBeneficialOwner(id, clientId);
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      {owners.length === 0 ? (
        <p className="text-sm text-foreground/60">{t("ubo.empty")}</p>
      ) : (
        <ul className="divide-y divide-black/[.06] dark:divide-white/[.08]">
          {owners.map((o) => (
            <li
              key={o.id}
              className="flex items-center justify-between gap-4 py-3 text-sm"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{o.fullName}</span>
                  {o.isPep ? <Badge tone="amber">{t("ubo.pep")}</Badge> : null}
                </div>
                <div className="text-foreground/60">
                  {o.ownershipPercentage != null
                    ? `${o.ownershipPercentage}%`
                    : tc("none")}
                  {o.nationality ? ` · ${o.nationality}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDelete(o.id)}
                className="text-xs text-red-600 hover:underline dark:text-red-400"
              >
                {tc("delete")}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={onSubmit}
        className="grid gap-3 border-t border-black/[.06] pt-4 sm:grid-cols-2 dark:border-white/[.08]"
      >
        <Input name="fullName" required placeholder={t("ubo.fullName")} />
        <Input
          name="ownershipPercentage"
          type="number"
          step="0.01"
          min="0"
          max="100"
          placeholder={t("ubo.ownership")}
        />
        <Input name="nationality" placeholder={t("fields.nationality")} />
        <Input name="dateOfBirth" type="date" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isPep" className="size-4" />
          {t("ubo.isPep")}
        </label>
        <div className="sm:col-span-2">
          <Input name="notes" placeholder={t("aml.notes")} />
        </div>
        {error ? (
          <p className="text-sm text-red-600 sm:col-span-2 dark:text-red-400">
            {error}
          </p>
        ) : null}
        <div>
          <Button type="submit" variant="secondary" disabled={loading}>
            {loading ? tc("adding") : t("ubo.add")}
          </Button>
        </div>
      </form>
    </div>
  );
}
