import { setRequestLocale } from "next-intl/server";
import { AppShell } from "@/components/app-shell/app-shell";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/supabase/auth";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function AppLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/login", locale });
    return null;
  }

  const isAdmin = await isCurrentUserAdmin();

  return (
    <AppShell userEmail={user.email ?? ""} isAdmin={isAdmin}>
      {children}
    </AppShell>
  );
}
