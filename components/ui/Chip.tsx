import { cn } from "@/lib/client/cn";

export function Chip({
  children,
  tone = "info",
  className,
}: {
  children: React.ReactNode;
  tone?: "good" | "warn" | "bad" | "info";
  className?: string;
}) {
  const map = {
    good: "chip-good",
    warn: "chip-warn",
    bad: "chip-bad",
    info: "chip-info",
  } as const;
  return <span className={cn(map[tone], className)}>{children}</span>;
}
