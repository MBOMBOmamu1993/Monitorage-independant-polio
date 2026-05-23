import { cn } from "@/lib/client/cn";

export type KpiTone = "neutral" | "good" | "warn" | "bad" | "brand";

// Chaque tone définit l'accent latéral (bordure gauche) et la couleur du chiffre.
// Fini les gros backgrounds colorés ; l'accent est plus discret, institutionnel.
const TONE: Record<KpiTone, { accent: string; value: string }> = {
  neutral: { accent: "border-l-surface-300",  value: "text-surface-900" },
  good:    { accent: "border-l-good-500",     value: "text-good-600" },
  warn:    { accent: "border-l-warn-500",     value: "text-warn-600" },
  bad:     { accent: "border-l-danger-500",   value: "text-danger-600" },
  brand:   { accent: "border-l-oms-500",      value: "text-oms-700" },
};

export function KpiCard({
  label,
  value,
  sub,
  tone = "neutral",
  icon: _icon, // volontairement ignoré — on retire les emojis du KPI
  hint,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: KpiTone;
  icon?: React.ReactNode;
  hint?: string;
}) {
  const t = TONE[tone];
  return (
    <div
      title={hint}
      className={cn(
        "relative rounded-md border border-surface-200 bg-white px-4 py-3 border-l-[3px] transition hover:border-surface-300",
        t.accent
      )}
    >
      <div className="kpi-label truncate">{label}</div>
      <div className={cn("kpi-value mt-1.5", t.value)}>{value}</div>
      {sub ? <div className="kpi-sub mt-1">{sub}</div> : null}
    </div>
  );
}
