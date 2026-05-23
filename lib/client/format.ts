/**
 * Formatters côté client (nombres, pourcentages, dates courtes).
 * Centralisés pour garantir l'uniformité des unités dans l'UI.
 */
export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("fr-FR").format(Math.round(n));
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

/**
 * Nettoie les noms d'unités concaténés pour l'affichage (ne garde que le dernier segment).
 * Supporte "Prov/Ant/ZS", "Prov / Ant / ZS", etc.
 */
export function fmtUnit(name: string): string {
  if (!name || typeof name !== "string") return name;
  const parts = name.split("/");
  return parts[parts.length - 1].trim();
}

export function riskColor(risk: string): string {
  switch (risk) {
    case "GREEN_GE_95":
      return "bg-good-500";
    case "YELLOW_90_94":
      return "bg-warn-500";
    case "RED_LT_90":
      return "bg-danger-500";
    default:
      return "bg-surface-300";
  }
}

export function riskChip(risk: string): string {
  switch (risk) {
    case "GREEN_GE_95":
      return "chip-good";
    case "YELLOW_90_94":
      return "chip-warn";
    case "RED_LT_90":
      return "chip-bad";
    default:
      return "chip-info";
  }
}

export function riskLabel(risk: string): string {
  switch (risk) {
    case "GREEN_GE_95":
      return "≥ 95%";
    case "YELLOW_90_94":
      return "90–94%";
    case "RED_LT_90":
      return "< 90%";
    default:
      return "N/A";
  }
}
