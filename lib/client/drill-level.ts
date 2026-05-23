/**
 * Niveau d'agrégation adaptatif (pattern inspiré du dashboard PEV routine).
 *
 * Règle : les visuels drilent automatiquement sur le niveau IMMÉDIATEMENT
 * inférieur à la sélection la plus profonde. On évite ainsi d'afficher un
 * graphique avec une seule barre pour l'org-unit sélectionné.
 *
 *   Aucun filtre            → "province"
 *   Province seule          → "antenne"
 *   + Antenne               → "zs"
 *   + ZS                    → "as"
 *   + AS                    → "locality"
 *   + Localité              → "locality" (dernier niveau)
 */
import type { FiltersState } from "@/lib/state/filters";
import type { AggregatesOrgUnit, AnalyticsBundle } from "@/lib/types/domain";
import { fmtUnit } from "./format";

export type DrillLevel = "province" | "antenne" | "zs" | "as" | "locality";

export function resolveDrillLevel(f: FiltersState): { level: DrillLevel; label: string } {
  if (f.locality) return { level: "locality", label: "Localité" };
  if (f.as) return { level: "locality", label: "Localité" };
  if (f.zs) return { level: "as", label: "Aire de Santé" };
  if (f.antenne) return { level: "zs", label: "Zone de Santé" };
  if (f.province) return { level: "antenne", label: "Antenne PEV" };
  return { level: "province", label: "Province" };
}

function keyOfAgg(a: AggregatesOrgUnit, level: DrillLevel): string {
  const u = a.orgUnit;
  switch (level) {
    case "province": return u.province ?? "—";
    case "antenne": return u.antenne ?? u.province ?? "—";
    case "zs": return u.zs ?? "—";
    case "as": return u.as ?? "—";
    case "locality": return u.locality ?? "—";
  }
}

/** Renvoie les lignes d'agrégats filtrées par la sélection, au bon niveau. */
export function pickAggregatesForLevel(
  bundle: AnalyticsBundle | undefined,
  f: FiltersState,
  level: DrillLevel
): AggregatesOrgUnit[] {
  if (!bundle) return [];
  const src =
    level === "province" ? bundle.aggregates.byProvince :
    level === "antenne" ? bundle.aggregates.byAntenne :
    level === "zs" ? bundle.aggregates.byZs :
    level === "as" ? bundle.aggregates.byAs :
    bundle.aggregates.byLocality;

  return src.filter((a) => {
    if (f.province && a.orgUnit.province !== f.province) return false;
    if (f.antenne && a.orgUnit.antenne !== f.antenne) return false;
    if (f.zs && a.orgUnit.zs !== f.zs) return false;
    if (f.as && a.orgUnit.as !== f.as) return false;
    if (f.locality && a.orgUnit.locality !== f.locality) return false;
    return true;
  });
}

/** Label court pour chaque row, typé selon le niveau. */
export function labelOf(a: AggregatesOrgUnit, level: DrillLevel): string {
  return fmtUnit(keyOfAgg(a, level));
}
