"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { approveTimesheet } from "@/modules/reports/actions";

export function ApproveReportButton({
  clientId,
  from,
  to,
}: {
  clientId: string;
  from: string;
  to: string;
}) {
  const t = useTranslations("reports");
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setState("loading");
    const res = await approveTimesheet({ clientId, from, to });
    if (!res.ok) {
      setState("idle");
      setError(t("timesheet.error"));
      return;
    }
    setState("done");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="secondary"
        onClick={onClick}
        disabled={state !== "idle"}
      >
        {state === "loading" ? t("timesheet.approving") : t("timesheet.approve")}
      </Button>
      {state === "done" ? (
        <span className="text-sm text-emerald-700">
          {t("timesheet.approved")}
        </span>
      ) : null}
      {error ? (
        <span className="text-sm text-red-700">{error}</span>
      ) : null}
    </div>
  );
}
