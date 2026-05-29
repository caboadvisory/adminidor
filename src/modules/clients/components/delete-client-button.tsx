"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { deleteClient } from "@/modules/clients/actions";

export function DeleteClientButton({ id }: { id: string }) {
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    if (!window.confirm(t("deleteConfirm"))) return;
    setLoading(true);
    const res = await deleteClient(id);
    if (!res.ok) {
      setLoading(false);
      window.alert(t("errors.generic"));
      return;
    }
    router.push("/clients");
    router.refresh();
  }

  return (
    <Button
      variant="secondary"
      onClick={onClick}
      disabled={loading}
      className="h-9 px-3 text-red-700"
    >
      {loading ? tc("deleting") : tc("delete")}
    </Button>
  );
}
