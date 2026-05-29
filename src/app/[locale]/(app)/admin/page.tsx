import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Link, redirect } from "@/i18n/navigation";
import { isCurrentUserAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { UserActiveToggle } from "@/modules/admin/components/user-active-toggle";
import { listUsers } from "@/modules/admin/queries";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await isCurrentUserAdmin())) {
    redirect({ href: "/", locale });
  }
  const t = await getTranslations("admin");

  const users = await listUsers();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meId = user?.id ?? "";

  const exportHref = `/${locale}/admin/export/time-entries`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-foreground/60">{t("subtitle")}</p>
        </div>
        <a
          href={exportHref}
          className="inline-flex h-10 items-center justify-center rounded-md border border-black/10 px-4 text-sm font-medium transition hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06]"
        >
          {t("exportCsv")}
        </a>
      </div>

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
          {t("users.title")}
        </h2>
        <Link
          href="/admin/users/new"
          className="inline-flex h-9 items-center justify-center rounded-md bg-foreground px-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          {t("users.add")}
        </Link>
      </div>

      {users.length === 0 ? (
        <Card className="text-sm text-foreground/60">{t("users.empty")}</Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-black/[.08] text-left text-xs uppercase tracking-wide text-foreground/50 dark:border-white/[.12]">
              <tr>
                <th className="px-4 py-3 font-medium">{t("fields.email")}</th>
                <th className="px-4 py-3 font-medium">{t("fields.fullName")}</th>
                <th className="px-4 py-3 font-medium">{t("fields.role")}</th>
                <th className="px-4 py-3 font-medium">{t("fields.status")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-black/[.05] last:border-0 dark:border-white/[.06]"
                >
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3 text-foreground/70">
                    {u.fullName ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.role === "admin" ? "blue" : "neutral"}>
                      {t(`roles.${u.role}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.active ? "green" : "neutral"}>
                      {u.active ? t("status.active") : t("status.inactive")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link
                      href={`/admin/users/${u.id}/edit`}
                      className="mr-3 text-xs hover:underline"
                    >
                      {t("actions.edit")}
                    </Link>
                    {u.id !== meId ? (
                      <UserActiveToggle userId={u.id} active={u.active} />
                    ) : null}
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
