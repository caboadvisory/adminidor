import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-md border border-black/10 bg-transparent px-3 text-sm outline-none transition focus:border-foreground/40 dark:border-white/15",
        className,
      )}
      {...props}
    />
  );
}
