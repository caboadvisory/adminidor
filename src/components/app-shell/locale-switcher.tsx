"use client";

import { useTransition, type ChangeEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

const labels: Record<Locale, string> = {
  en: "English",
  sv: "Svenska",
  es: "Español",
};

export function LocaleSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function onChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value as Locale;
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  }

  return (
    <select
      aria-label={t("language")}
      value={locale}
      onChange={onChange}
      disabled={isPending}
      className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25"
    >
      {routing.locales.map((value) => (
        <option key={value} value={value}>
          {labels[value]}
        </option>
      ))}
    </select>
  );
}
