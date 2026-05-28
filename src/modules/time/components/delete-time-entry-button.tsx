"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { deleteTimeEntry } from "@/modules/time/actions";

export function DeleteTimeEntryButton({ id }: { id: string }) {
  const t = useTranslations("time");
  const tc = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    if (!window.confirm(t("deleteConfirm"))) return;
    setLoading(true);
    const res = await deleteTimeEntry(id);
    if (!res.ok) {
      setLoading(false);
      window.alert(t("errors.generic"));
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="text-xs text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
    >
      {loading ? tc("deleting") : tc("delete")}
    </button>
  );
}
