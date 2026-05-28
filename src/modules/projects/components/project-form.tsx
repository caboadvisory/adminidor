"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Link, useRouter } from "@/i18n/navigation";
import { createProject, updateProject } from "@/modules/projects/actions";
import type { Project } from "@/modules/projects/types";

const STATUSES = ["active", "on_hold", "completed", "archived"] as const;
const CURRENCIES = ["SEK", "EUR", "USD", "GBP", "NOK", "DKK"];

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
  projectId?: string;
  initial?: Project | null;
  clients: { id: string; name: string }[];
};

export function ProjectForm({ mode, projectId, initial, clients }: Props) {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const currentCurrency = initial?.currency ?? "SEK";
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
      clientId: get("clientId"),
      name: get("name"),
      code: get("code"),
      status: get("status"),
      hourlyRate: get("hourlyRate"),
      currency: get("currency"),
      startDate: get("startDate"),
      endDate: get("endDate"),
    };

    setLoading(true);
    if (mode === "create") {
      const result = await createProject(input);
      setLoading(false);
      if (!result.ok) {
        setError(mapError(result.error));
        return;
      }
      router.push(`/projects/${result.id}`);
      router.refresh();
    } else {
      const result = await updateProject(projectId as string, input);
      setLoading(false);
      if (!result.ok) {
        setError(mapError(result.error));
        return;
      }
      router.push(`/projects/${projectId}`);
      router.refresh();
    }
  }

  const cancelHref = mode === "edit" ? `/projects/${projectId}` : "/projects";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
          {t("sections.details")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fields.client")} htmlFor="clientId">
            <Select
              id="clientId"
              name="clientId"
              required
              defaultValue={initial?.clientId ?? ""}
            >
              <option value="" disabled>
                —
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("fields.name")} htmlFor="name">
            <Input id="name" name="name" required defaultValue={initial?.name ?? ""} />
          </Field>
          <Field label={t("fields.code")} htmlFor="code">
            <Input id="code" name="code" defaultValue={initial?.code ?? ""} />
          </Field>
          <Field label={t("fields.status")} htmlFor="status">
            <Select
              id="status"
              name="status"
              defaultValue={initial?.status ?? "active"}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("fields.hourlyRate")} htmlFor="hourlyRate">
            <Input
              id="hourlyRate"
              name="hourlyRate"
              type="number"
              step="0.01"
              min="0"
              defaultValue={initial?.hourlyRate ?? ""}
            />
          </Field>
          <Field label={t("fields.currency")} htmlFor="currency">
            <Select id="currency" name="currency" defaultValue={currentCurrency}>
              {currencyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("fields.startDate")} htmlFor="startDate">
            <Input
              id="startDate"
              name="startDate"
              type="date"
              defaultValue={initial?.startDate ?? ""}
            />
          </Field>
          <Field label={t("fields.endDate")} htmlFor="endDate">
            <Input
              id="endDate"
              name="endDate"
              type="date"
              defaultValue={initial?.endDate ?? ""}
            />
          </Field>
        </div>
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
