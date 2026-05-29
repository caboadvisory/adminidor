import { Wordmark } from "@/components/brand/wordmark";
import { LocaleSwitcher } from "./locale-switcher";
import { Sidebar } from "./sidebar";
import { UserMenu } from "./user-menu";

type Props = {
  userEmail: string;
  isAdmin: boolean;
  children: React.ReactNode;
};

export function AppShell({ userEmail, isAdmin, children }: Props) {
  return (
    <div className="grid min-h-dvh grid-cols-1 bg-background md:grid-cols-[16rem_1fr]">
      <aside className="hidden border-r border-border bg-surface md:flex md:flex-col">
        <div className="flex h-16 items-center border-b border-border px-6">
          <Wordmark className="h-5" />
        </div>
        <div className="py-4">
          <Sidebar isAdmin={isAdmin} />
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="flex h-16 items-center gap-4 border-b border-border bg-surface px-4 md:px-8">
          <div className="md:hidden">
            <Wordmark className="h-4" />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <LocaleSwitcher />
            <UserMenu email={userEmail} />
          </div>
        </header>

        <main className="flex-1 px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
