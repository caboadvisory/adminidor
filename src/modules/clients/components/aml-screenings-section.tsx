"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import {
  addAmlScreening,
  deleteAmlScreening,
} from "@/modules/clients/actions";
import { amlResultTone } from "@/modules/clients/display";
import type { AmlScreening } from "@/modules/clients/types";

const TYPES = ["pep", "sanctions", "adverse_media"] as const;
const RESULTS = ["clear", "hit", "pending"] as const;

export function AmlScreeningsSection({
  clientId,
  screenings,
}: {
  clientId: string;
  screenings: AmlScreening[];
}) {
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const fd = new FormData(form);
    const input = {
      screeningType: String(fd.get("screeningType") ?? ""),
      result: String(fd.get("result") ?? ""),
      provider: String(fd.get("provider") ?? ""),
      reference: String(fd.get("reference") ?? ""),
      notes: String(fd.get("notes") ?? ""),
    };

    setLoading(true);
    const res = await addAmlScreening(clientId, input);
    setLoading(false);
    if (!res.ok) {
      setError(res.error === "validation" ? t("errors.validation") : t("errors.generic"));
      return;
    }
    form.reset();
    router.refresh();
  }

  async function onDelete(id: string) {
    const res = await deleteAmlScreening(id, clientId);
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      {screenings.length === 0 ? (
        <p className="text-sm text-foreground/60">{t("aml.empty")}</p>
      ) : (
        <ul className="divide-y divide-black/[.06] dark:divide-white/[.08]">
          {screenings.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-4 py-3 text-sm"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {t(`amlType.${s.screeningType}`)}
                  </span>
                  <Badge tone={amlResultTone(s.result)}>
                    {t(`amlResult.${s.result}`)}
                  </Badge>
                </div>
                <div className="text-foreground/60">
                  {dateFmt.format(new Date(s.screenedAt))} · {s.provider}
                  {s.reference ? ` · ${s.reference}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDelete(s.id)}
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
        <Select name="screeningType" defaultValue="pep" aria-label={t("aml.type")}>
          {TYPES.map((ty) => (
            <option key={ty} value={ty}>
              {t(`amlType.${ty}`)}
            </option>
          ))}
        </Select>
        <Select name="result" defaultValue="pending" aria-label={t("aml.result")}>
          {RESULTS.map((r) => (
            <option key={r} value={r}>
              {t(`amlResult.${r}`)}
            </option>
          ))}
        </Select>
        <Input name="provider" placeholder={t("aml.provider")} defaultValue="manual" />
        <Input name="reference" placeholder={t("aml.reference")} />
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
            {loading ? tc("adding") : t("aml.add")}
          </Button>
        </div>
      </form>
    </div>
  );
}
