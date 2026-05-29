import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "green" | "amber" | "red" | "blue";

const tones: Record<BadgeTone, string> = {
  // neutral + blue sit in the brand slate family; green/amber/red stay
  // semantic (verified / medium / high-risk etc.) but kept muted.
  neutral: "bg-black/[.05] text-foreground/70",
  blue: "bg-primary/15 text-[#46627a]",
  green: "bg-emerald-600/15 text-emerald-800",
  amber: "bg-amber-500/20 text-amber-800",
  red: "bg-red-500/15 text-red-800",
};

type Props = HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone };

export function Badge({ tone = "neutral", className, ...props }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
