"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { setUserActive } from "@/modules/admin/actions";

export function UserActiveToggle({
  userId,
  active,
}: {
  userId: string;
  active: boolean;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    const res = await setUserActive(userId, !active);
    setLoading(false);
    if (!res.ok) {
      window.alert(
        res.error === "self_deactivate"
          ? t("errors.selfDeactivate")
          : t("errors.generic"),
      );
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="text-xs hover:underline disabled:opacity-50"
    >
      {active ? t("actions.deactivate") : t("actions.activate")}
    </button>
  );
}
