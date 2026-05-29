import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { isCurrentUserAdmin } from "@/lib/supabase/auth";
import { UserForm } from "@/modules/admin/components/user-form";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function NewUserPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await isCurrentUserAdmin())) {
    redirect({ href: "/", locale });
  }
  const t = await getTranslations("admin");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-foreground/60 hover:underline">
          ← {t("backToUsers")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{t("createTitle")}</h1>
      </div>
      <UserForm mode="create" />
    </div>
  );
}
