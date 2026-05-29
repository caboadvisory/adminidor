import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link, redirect } from "@/i18n/navigation";
import { isCurrentUserAdmin } from "@/lib/supabase/auth";
import { UserForm } from "@/modules/admin/components/user-form";
import { getAdminUser } from "@/modules/admin/queries";

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function EditUserPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!(await isCurrentUserAdmin())) {
    redirect({ href: "/", locale });
  }
  const t = await getTranslations("admin");

  const userRec = await getAdminUser(id);
  if (!userRec) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-foreground/60 hover:underline">
          ← {t("backToUsers")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{t("editTitle")}</h1>
      </div>
      <UserForm mode="edit" userId={id} initial={userRec} />
    </div>
  );
}
