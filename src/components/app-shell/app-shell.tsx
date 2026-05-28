import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "./locale-switcher";
import { Sidebar } from "./sidebar";
import { UserMenu } from "./user-menu";

type Props = {
  userEmail: string;
  children: React.ReactNode;
};

export function AppShell({ userEmail, children }: Props) {
  const t = useTranslations("app");

  return (
    <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[16rem_1fr]">
      <aside className="hidden border-r border-black/[.08] md:flex md:flex-col dark:border-white/[.12]">
        <div className="px-6 py-5 text-lg font-semibold">{t("name")}</div>
        <Sidebar />
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="flex h-14 items-center gap-4 border-b border-black/[.08] px-4 md:px-8 dark:border-white/[.12]">
          <div className="font-semibold md:hidden">{t("name")}</div>
          <div className="ml-auto flex items-center gap-3">
            <LocaleSwitcher />
            <UserMenu email={userEmail} />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
