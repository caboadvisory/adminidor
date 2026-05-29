import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface p-5 shadow-sm",
        className,
      )}
    >
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 font-heading text-2xl text-foreground">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}
