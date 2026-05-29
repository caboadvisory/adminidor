import { cn } from "@/lib/utils";

/**
 * Cabo Advisory wordmark — the real brand lockup (slate + gray), transparent
 * background so it sits on cream or white. Size with a height class
 * (e.g. h-5 in the sidebar, h-7 on login); width scales automatically.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/wordmark.svg"
      alt="Cabo Advisory"
      className={cn("w-auto select-none", className)}
    />
  );
}

/** The "C" symbol alone — for compact/space-constrained spots. */
export function BrandIcon({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/icon.svg"
      alt="Cabo Advisory"
      className={cn("select-none", className)}
    />
  );
}
