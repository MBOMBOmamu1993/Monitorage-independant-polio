import { cn } from "@/lib/client/cn";

export function Grid({
  cols = 4,
  className,
  children,
}: {
  cols?: 2 | 3 | 4 | 6;
  className?: string;
  children: React.ReactNode;
}) {
  const map: Record<number, string> = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-4",
    6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
  };
  return <div className={cn("grid gap-3", map[cols], className)}>{children}</div>;
}

export function Row({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-3 grid-cols-1 lg:grid-cols-2", className)}>
      {children}
    </div>
  );
}
