"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Link, useRouter } from "@/i18n/navigation";
import { createUser, updateUser } from "@/modules/admin/actions";
import type { AdminUser } from "@/modules/admin/types";

const ROLES = ["member", "admin"] as const;
const LOCALES: { value: string; label: string }[] = [
  { value: "en", label: "English" },
  { value: "sv", label: "Svenska" },
  { value: "es", label: "Español" },
];

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
  userId?: string;
  initial?: AdminUser | null;
};

export function UserForm({ mode, userId, initial }: Props) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function mapError(code: string) {
    const known: Record<string, string> = {
      validation: t("errors.validation"),
      forbidden: t("errors.forbidden"),
      self_role: t("errors.selfRole"),
      not_configured: t("errors.notConfigured"),
    };
    return known[code] ?? code; // fall back to the raw (e.g. "email already registered")
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const fd = new FormData(event.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "");

    setLoading(true);
    if (mode === "create") {
      const res = await createUser({
        email: get("email"),
        password: get("password"),
        fullName: get("fullName"),
        role: get("role"),
        locale: get("locale"),
      });
      setLoading(false);
      if (!res.ok) {
        setError(mapError(res.error));
        return;
      }
    } else {
      const res = await updateUser(userId as string, {
        fullName: get("fullName"),
        role: get("role"),
        locale: get("locale"),
        password: get("password"),
      });
      setLoading(false);
      if (!res.ok) {
        setError(mapError(res.error));
        return;
      }
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fields.email")} htmlFor="email">
            {mode === "create" ? (
              <Input id="email" name="email" type="email" required />
            ) : (
              <Input
                id="email"
                type="email"
                defaultValue={initial?.email ?? ""}
                disabled
              />
            )}
          </Field>
          <Field
            label={mode === "create" ? t("fields.password") : t("fields.passwordOptional")}
            htmlFor="password"
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required={mode === "create"}
              minLength={8}
            />
          </Field>
          <Field label={t("fields.fullName")} htmlFor="fullName">
            <Input
              id="fullName"
              name="fullName"
              defaultValue={initial?.fullName ?? ""}
            />
          </Field>
          <Field label={t("fields.role")} htmlFor="role">
            <Select id="role" name="role" defaultValue={initial?.role ?? "member"}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`roles.${r}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("fields.language")} htmlFor="locale">
            <Select
              id="locale"
              name="locale"
              defaultValue={initial?.locale ?? "en"}
            >
              {LOCALES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? tc("saving") : tc("save")}
        </Button>
        <Link
          href="/admin"
          className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-foreground/70 transition hover:bg-surface-2"
        >
          {tc("cancel")}
        </Link>
      </div>
    </form>
  );
}
