"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", key: "dashboard" },
  { href: "/clients", key: "clients" },
  { href: "/projects", key: "projects" },
  { href: "/time", key: "time" },
  { href: "/reports", key: "reports" },
] as const;

export function Sidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3">
      {items.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition",
              active
                ? "bg-foreground text-background"
                : "text-foreground/70 hover:bg-black/[.04] hover:text-foreground dark:hover:bg-white/[.06]",
            )}
          >
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}
