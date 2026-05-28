import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-20 w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-foreground/40 dark:border-white/15",
        className,
      )}
      {...props}
    />
  );
}
