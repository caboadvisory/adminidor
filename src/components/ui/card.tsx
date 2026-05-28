import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-black/[.08] bg-background p-6 dark:border-white/[.12]",
        className,
      )}
      {...props}
    />
  );
}
