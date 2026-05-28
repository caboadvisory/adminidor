"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-actions";

export function UserMenu({ email }: { email: string }) {
  const t = useTranslations("auth");

  return (
    <form action={signOut} className="flex items-center gap-3">
      {email ? (
        <span className="hidden text-sm text-foreground/60 sm:inline">
          {email}
        </span>
      ) : null}
      <Button type="submit" variant="secondary" className="h-9 px-3">
        {t("signOut")}
      </Button>
    </form>
  );
}
