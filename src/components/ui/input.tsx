import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border border-black/10 bg-transparent px-3 text-sm outline-none transition focus:border-foreground/40 dark:border-white/15",
        className,
      )}
      {...props}
    />
  );
}
