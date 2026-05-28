"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/navigation";
import type { ProjectPickerOption } from "@/modules/projects/types";
import { createTimeEntry, updateTimeEntry } from "@/modules/time/actions";
import { minutesToHours } from "@/modules/time/display";
import type { TimeEntry } from "@/modules/time/types";

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

function computeAmount(project: ProjectPickerOption | null, hoursStr: string) {
  const hours = Number(hoursStr);
  if (!project || project.effectiveRate == null || !(hours > 0)) return "";
  return String(Math.round(project.effectiveRate * hours * 100) / 100);
}

type Props = {
  mode: "create" | "edit";
  entryId?: string;
  initial?: TimeEntry | null;
  projects: ProjectPickerOption[];
};

export function TimeEntryForm({ mode, entryId, initial, projects }: Props) {
  const t = useTranslations("time");
  const tc = useTranslations("common");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  // Unique clients derived from the available projects.
  const clients = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) {
      if (p.clientId) map.set(p.clientId, p.clientName ?? p.clientId);
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [projects]);

  const initialProject = initial
    ? (projects.find((p) => p.id === initial.projectId) ?? null)
    : null;
  const initialClientId = initialProject?.clientId ?? clients[0]?.id ?? "";

  const [clientId, setClientId] = useState(initialClientId);
  const [projectId, setProjectId] = useState(
    initial?.projectId ??
      projects.find((p) => p.clientId === initialClientId)?.id ??
      "",
  );
  const [hours, setHours] = useState(
    initial ? String(minutesToHours(initial.minutes)) : "",
  );
  const [amount, setAmount] = useState(
    initial?.amount != null ? String(initial.amount) : "",
  );
  const [amountEdited, setAmountEdited] = useState(mode === "edit");

  const clientProjects = projects.filter((p) => p.clientId === clientId);
  const selected = projects.find((p) => p.id === projectId) ?? null;

  function onClientChange(value: string) {
    setClientId(value);
    const firstProject = projects.find((p) => p.clientId === value) ?? null;
    setProjectId(firstProject?.id ?? "");
    if (!amountEdited) setAmount(computeAmount(firstProject, hours));
  }

  function onProjectChange(value: string) {
    setProjectId(value);
    if (!amountEdited) {
      setAmount(computeAmount(projects.find((p) => p.id === value) ?? null, hours));
    }
  }

  function onHoursChange(value: string) {
    setHours(value);
    if (!amountEdited) setAmount(computeAmount(selected, value));
  }

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
      projectId: get("projectId"),
      workDate: get("workDate"),
      hours: get("hours"),
      description: get("description"),
      amount: get("amount"),
      billable: fd.get("billable") === "on",
    };

    setLoading(true);
    const result =
      mode === "create"
        ? await createTimeEntry(input)
        : await updateTimeEntry(entryId as string, input);
    setLoading(false);

    if (!result.ok) {
      setError(mapError(result.error));
      return;
    }
    router.push("/time");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fields.client")} htmlFor="clientId">
            <Select
              id="clientId"
              value={clientId}
              onChange={(e) => onClientChange(e.target.value)}
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
          <Field label={t("fields.project")} htmlFor="projectId">
            <Select
              id="projectId"
              name="projectId"
              required
              value={projectId}
              onChange={(e) => onProjectChange(e.target.value)}
            >
              <option value="" disabled>
                —
              </option>
              {clientProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("fields.date")} htmlFor="workDate">
            <Input
              id="workDate"
              name="workDate"
              type="date"
              required
              defaultValue={initial?.workDate ?? today}
            />
          </Field>
          <Field label={t("fields.hours")} htmlFor="hours">
            <Input
              id="hours"
              name="hours"
              type="number"
              step="0.25"
              min="0"
              required
              value={hours}
              onChange={(e) => onHoursChange(e.target.value)}
            />
          </Field>
          <Field
            label={`${t("fields.amount")}${selected?.currency ? ` (${selected.currency})` : ""}`}
            htmlFor="amount"
          >
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setAmountEdited(true);
              }}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("fields.description")} htmlFor="description">
              <Textarea
                id="description"
                name="description"
                defaultValue={initial?.description ?? ""}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="billable"
              defaultChecked={initial ? initial.billable : true}
              className="size-4"
            />
            {t("fields.billable")}
          </label>
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
          href="/time"
          className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-foreground/70 transition hover:bg-black/[.04] dark:hover:bg-white/[.06]"
        >
          {tc("cancel")}
        </Link>
      </div>
    </form>
  );
}
