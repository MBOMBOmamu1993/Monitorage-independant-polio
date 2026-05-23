/**
 * Dérivations à la volée côté client à partir d'une vue filtrée.
 *
 * Les totaux Polio / refus / absences sont lus via `submission.stats`
 * (pré-calculé côté serveur dans parseSubmission).
 * Les RR sont lus via la table `children` (repeat personnes_rr).
 */
import type { CleanSubmission, ChildRecord, CoverageRiskClass } from "@/lib/types/domain";
import { classifyCoverage, RR_NON_VAX_REASONS, RR_REASON_COLORS, POLIO_REFUSAL_REASONS } from "@/config/reasons";
import { fmtUnit } from "./format";

export interface KpiSummary {
  submissions: number;
  householdSubs: number;
  outsideSubs: number;
  childrenRR: number;
  childrenPolio: number;
  rrVaccinated: number;
  polioVaccinated: number;
  rrCoverage: number | null;
  polioCoverage: number | null;
  rrRisk: CoverageRiskClass;
  polioRisk: CoverageRiskClass;
  refusals: number;
  refusalsPolio: number;
  refusalsRR: number;
  absences: number;
  monitorsActive: number;
  daysCovered: number;
}

export interface PolioBreakdown {
  householdEval: number;
  householdVac: number;
  outsideEval: number;
  outsideVac: number;
  refusals: number;
  absences: number;
}

export function polioBreakdown(subs: CleanSubmission[]): PolioBreakdown {
  const out: PolioBreakdown = {
    householdEval: 0,
    householdVac: 0,
    outsideEval: 0,
    outsideVac: 0,
    refusals: 0,
    absences: 0,
  };
  for (const s of subs) {
    const st = s.stats;
    if (s.context === "Household") {
      out.householdEval += st.totU5;
      out.householdVac += st.vacU5;
    } else {
      out.outsideEval += st.totU5;
      out.outsideVac += st.vacU5;
    }
    out.refusals += st.refusals;
    out.absences += st.absences;
  }
  return out;
}

export function summarize(subs: CleanSubmission[], children: ChildRecord[]): KpiSummary {
  const householdSubs = subs.filter((s) => s.form === "households").length;
  const outsideSubs = subs.filter((s) => s.form === "outside").length;

  let childrenRR = 0;
  let rrVac = 0;
  let rrRefus = 0;
  let rrAbs = 0;
  for (const c of children) {
    if (c.rrReceived === undefined) continue;
    childrenRR += 1;
    if (c.rrReceived === "Oui") {
      rrVac += 1;
    } else {
      // Déduction du refus RR par le motif (DEMANDE)
      // C'est la logique standard du monitorage indépendant
      if (c.rrReasonGroup === "DEMANDE") {
        rrRefus += 1;
      }
      
      if (c.rrReceived === "Absent") {
        rrAbs += 1;
      }
    }
  }

  const polio = polioBreakdown(subs);
  const childrenPolio = polio.householdEval + polio.outsideEval;
  const polioVac = polio.householdVac + polio.outsideVac;

  const rrCoverage = childrenRR > 0 ? (rrVac / childrenRR) * 100 : null;
  const polioCoverage = childrenPolio > 0 ? (polioVac / childrenPolio) * 100 : null;

  const monitors = new Set(subs.map((s) => s.monitorName).filter(Boolean));
  const days = new Set(
    subs.map((s) => s.monitoringDate ?? s.submissionTime.slice(0, 10)).filter(Boolean)
  );

  return {
    submissions: subs.length,
    householdSubs,
    outsideSubs,
    childrenRR,
    childrenPolio,
    rrVaccinated: rrVac,
    polioVaccinated: polioVac,
    rrCoverage,
    polioCoverage,
    rrRisk: classifyCoverage(rrCoverage),
    polioRisk: classifyCoverage(polioCoverage),
    refusals: polio.refusals + rrRefus,
    refusalsPolio: polio.refusals,
    refusalsRR: rrRefus,
    absences: polio.absences + rrAbs,
    monitorsActive: monitors.size,
    daysCovered: days.size,
  };
}

export function uniqueSorted<T>(arr: Array<T | null | undefined>): T[] {
  const map = new Map<string, T>();
  for (const v of arr) {
    if (v !== null && v !== undefined) {
      const key = typeof v === "string" ? v.toUpperCase().trim() : String(v);
      if (!map.has(key)) map.set(key, v);
    }
  }
  return Array.from(map.values()).sort((a, b) => String(a).localeCompare(String(b), "fr"));
}

/**
 * Décomposition côté client des raisons PoLio (refus / absents / autres)
 * à partir des totaux pré-calculés du formulaire (submission.stats) et
 * de la taxonomie dans config/reasons.
 */
export interface ReasonsSummary {
  refusals: number;
  absences: number;
  notReachedTeam: number;
  alreadyRoutine: number;
  otherNonVax: number;
  total: number;
}

export function polioReasonsSummary(subs: CleanSubmission[]): ReasonsSummary {
  let refus = 0,
    abs = 0,
    notTeam = 0,
    routine = 0,
    other = 0;
  for (const s of subs) {
    const st = s.stats;
    refus += st.refusals;
    abs += st.absences;
    notTeam += st.notReachedTeam;
    routine += st.alreadyRoutine;

    const total = st.totU5 - st.vacU5;
    const classified = st.refusals + st.absences + st.notReachedTeam + st.alreadyRoutine;
    other += Math.max(0, total - classified);
  }
  return {
    refusals: refus,
    absences: abs,
    notReachedTeam: notTeam,
    alreadyRoutine: routine,
    otherNonVax: other,
    total: refus + abs + notTeam + routine + other,
  };
}

export interface DetailedReasons {
  label: string;
  value: number;
  color?: string;
}

/**
 * Récapitulatif des raisons de refus Polio — agrégé global.
 * Lit les raisons depuis les enfants (ChildRecord) où refusalReasonCode est renseigné.
 */
export function refusalReasonsSummary(children: ChildRecord[]): DetailedReasons[] {
  const counts = new Map<string, number>();
  for (const c of children) {
    // Utiliser refusalReasonCode (code ODK 1-16)
    const code = c.refusalReasonCode;
    if (!code) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  // Mapper vers les libellés FR depuis RR_NON_VAX_REASONS (codes 1-16)
  const result = new Map<string, { value: number; label: string }>();
  for (const [code, count] of counts.entries()) {
    const def = RR_NON_VAX_REASONS.find(r => r.code === code);
    const label = def?.label ?? code;
    result.set(label, {
      value: (result.get(label)?.value ?? 0) + count,
      label,
    });
  }

  return Array.from(result.entries())
    .map(([label, data]) => ({
      label,
      value: data.value,
      color: "#e11d48", // Rouge pour refus
    }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function absenceReasonsSummary(subs: CleanSubmission[]): DetailedReasons[] {
  let travel = 0, school = 0, market = 0, other = 0;
  for (const s of subs) {
    travel += s.stats.absentTravel;
    school += s.stats.absentSchool;
    market += s.stats.absentMarket;
    other += s.stats.absentOther;
  }
  return [
    { label: "Voyage", value: travel, color: "#f59e0b" },
    { label: "École", value: school, color: "#d97706" },
    { label: "Marché / Champ", value: market, color: "#b45309" },
    { label: "Autre", value: other, color: "#fbbf24" },
  ].filter(r => r.value > 0);
}

/**
 * Décomposition RR depuis les enfants (repeat personnes_rr).
 */
export interface RRReasonsSummary {
  vaccinated: number;
  refused: number;
  absent: number;
  notVaccinated: number;
  unknown: number;
  total: number;
}

/**
 * Décomposition des raisons de non-vaccination RR : global (Offre/Demande) +
 * détail pondéré sur 100 %. N'inclut que les enfants non vaccinés pour
 * lesquels une raison a été renseignée (code ODK `raison_non_vacc_rr`).
 *
 * Figure 12 du rapport End-Process : Répartition globale des raisons
 * (normalisée) + détail pondéré sur 100 % par raison.
 */
export interface RrNonVaxReasonDetail {
  code: string;
  label: string;
  category: "OFFRE" | "DEMANDE";
  count: number;
  pct: number; // 0..100
  color: string;
}

export interface RrNonVaxReasonsBreakdown {
  total: number;
  offre: { count: number; pct: number };
  demande: { count: number; pct: number };
  details: RrNonVaxReasonDetail[]; // triées par pct décroissant
}

export function rrNonVaxReasonsBreakdown(children: ChildRecord[]): RrNonVaxReasonsBreakdown {
  const counts = new Map<string, number>();
  let total = 0;
  let offre = 0;
  let demande = 0;

  for (const c of children) {
    if (!c.rrReasonGroup || !c.rrReasonCode) continue;
    if (c.rrReceived === "Oui") continue; // ne compter que les non vaccinés
    total += 1;
    counts.set(c.rrReasonCode, (counts.get(c.rrReasonCode) ?? 0) + 1);
    if (c.rrReasonGroup === "OFFRE") offre += 1;
    else demande += 1;
  }

  const details: RrNonVaxReasonDetail[] = RR_NON_VAX_REASONS.map((def) => {
    const count = counts.get(def.code) ?? 0;
    return {
      code: def.code,
      label: def.label,
      category: def.category,
      count,
      pct: total > 0 ? (count * 100) / total : 0,
      color: RR_REASON_COLORS[def.category],
    };
  })
    .filter((d) => d.count > 0)
    .sort((a, b) => b.pct - a.pct);

  return {
    total,
    offre: { count: offre, pct: total > 0 ? (offre * 100) / total : 0 },
    demande: { count: demande, pct: total > 0 ? (demande * 100) / total : 0 },
    details,
  };
}

/**
 * Raisons de non-vaccination RR par unité organisationnelle — 100 % empilée.
 *
 * Filtre optionnel par catégorie (Offre/Demande). Pour garder la lecture
 * saine, on ne garde que les `maxReasons` raisons les plus fréquentes et on
 * regroupe le reste sous "Autres".
 *
 * Couleurs : rouge pour les facteurs d'offre, bleu pour les facteurs de
 * demande (cohérent avec la Figure 12).
 */
const OFFRE_PALETTE = ["#c81e1e", "#ef4444", "#f87171", "#fca5a5", "#fecaca"];
const DEMANDE_PALETTE = ["#1e3a8a", "#1f6bff", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe"];

export function rrReasonsByUnit(
  children: ChildRecord[],
  keyFn: (c: ChildRecord) => string | null,
  options?: { topN?: number; maxReasons?: number; categoryFilter?: "OFFRE" | "DEMANDE" }
): ByUnitSeries {
  const topN = options?.topN ?? 12;
  const maxReasons = options?.maxReasons ?? 8;
  const filter = options?.categoryFilter;

  // Fréquence globale par raison (dans le périmètre filtré).
  const totalByCode = new Map<string, number>();
  for (const c of children) {
    if (!c.rrReasonCode || !c.rrReasonGroup) continue;
    if (filter && c.rrReasonGroup !== filter) continue;
    if (c.rrReceived === "Oui") continue;
    totalByCode.set(c.rrReasonCode, (totalByCode.get(c.rrReasonCode) ?? 0) + 1);
  }

  // Top raisons globales → conservées nominativement ; le reste va dans "Autres".
  const topCodes = Array.from(totalByCode.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxReasons)
    .map(([code]) => code);
  const topDefs = topCodes
    .map((code) => RR_NON_VAX_REASONS.find((r) => r.code === code))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  // Agrégation par unité.
  const map = new Map<string, Record<string, number>>();
  for (const c of children) {
    if (!c.rrReasonCode || !c.rrReasonGroup) continue;
    if (filter && c.rrReasonGroup !== filter) continue;
    if (c.rrReceived === "Oui") continue;
    const k = keyFn(c);
    if (!k) continue;
    let row = map.get(k);
    if (!row) {
      row = {};
      topDefs.forEach((d) => (row![d.label] = 0));
      row["Autres"] = 0;
      map.set(k, row);
    }
    const def = topDefs.find((d) => d.code === c.rrReasonCode);
    if (def) row[def.label] = (row[def.label] ?? 0) + 1;
    else row["Autres"] = (row["Autres"] ?? 0) + 1;
  }

  const entries = Array.from(map.entries())
    .map(([unit, vals]) => ({
      unit: fmtUnit(unit),
      total: Object.values(vals).reduce((a, b) => a + b, 0),
      vals,
    }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, topN);

  let offreIdx = 0;
  let demandeIdx = 0;
  const series = topDefs.map((d) => {
    const color =
      d.category === "OFFRE"
        ? OFFRE_PALETTE[offreIdx++ % OFFRE_PALETTE.length]
        : DEMANDE_PALETTE[demandeIdx++ % DEMANDE_PALETTE.length];
    return {
      name: d.label,
      color,
      data: entries.map((e) => e.vals[d.label] ?? 0),
    };
  });

  const hasOthers = entries.some((e) => (e.vals["Autres"] ?? 0) > 0);
  if (hasOthers) {
    series.push({
      name: "Autres",
      color: "#94a3b8",
      data: entries.map((e) => e.vals["Autres"] ?? 0),
    });
  }

  return {
    units: entries.map((e) => e.unit),
    series,
  };
}

export function rrReasonsSummary(children: ChildRecord[]): RRReasonsSummary {
  let vac = 0, ref = 0, ab = 0, nv = 0, unk = 0;
  for (const c of children) {
    switch (c.rrReceived) {
      case "Oui": vac += 1; break;
      case "Refus": ref += 1; break;
      case "Absent": ab += 1; break;
      case "Non": nv += 1; break;
      default: unk += 1; break;
    }
  }
  return {
    vaccinated: vac,
    refused: ref,
    absent: ab,
    notVaccinated: nv,
    unknown: unk,
    total: vac + ref + ab + nv + unk,
  };
}

/**
 * % parents informés par unité organisationnelle (depuis submission.stats.parentInformed).
 */
export function parentInformedByUnit(
  subs: CleanSubmission[],
  keyFn: (s: CleanSubmission) => string | null
): { label: string; pct: number; sample: number }[] {
  const bucket = new Map<string, { yes: number; tot: number }>();
  for (const s of subs) {
    const k = keyFn(s);
    if (!k) continue;
    const slot = bucket.get(k) ?? { yes: 0, tot: 0 };
    if (s.stats.parentInformed === true) slot.yes += 1;
    if (s.stats.parentInformed !== null) slot.tot += 1;
    bucket.set(k, slot);
  }
  return Array.from(bucket.entries())
    .filter(([, v]) => v.tot > 0)
    .map(([label, v]) => ({
      label: fmtUnit(label),
      pct: (v.yes * 100) / v.tot,
      sample: v.tot,
    }))
    .sort((a, b) => b.pct - a.pct);
}

/**
 * Décompositions par unité organisationnelle pour les graphiques 100% empilés.
 */
export interface ByUnitSeries {
  units: string[];
  series: { name: string; data: number[]; color?: string }[];
}

function bucketByUnit<S extends string>(
  subs: CleanSubmission[],
  keyFn: (s: CleanSubmission) => string | null,
  schema: Array<{ key: S; color?: string; pick: (s: CleanSubmission) => number }>,
  topN = 12
): ByUnitSeries {
  const map = new Map<string, Record<string, number>>();
  for (const s of subs) {
    const k = keyFn(s);
    if (!k) continue;
    let row = map.get(k);
    if (!row) {
      row = {};
      schema.forEach((d) => (row![d.key] = 0));
      map.set(k, row);
    }
    schema.forEach((d) => (row![d.key] = (row![d.key] ?? 0) + d.pick(s)));
  }

  const entries = Array.from(map.entries())
    .map(([unit, vals]) => ({
      unit: fmtUnit(unit),
      total: schema.reduce((sum, d) => sum + (vals[d.key] ?? 0), 0),
      vals,
    }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, topN);

  return {
    units: entries.map((e) => e.unit),
    series: schema.map((d) => ({
      name: d.key as string,
      color: d.color,
      data: entries.map((e) => e.vals[d.key] ?? 0),
    })),
  };
}

export function nonVaccinationReasonsByUnit(
  subs: CleanSubmission[],
  keyFn: (s: CleanSubmission) => string | null,
  topN = 12
): ByUnitSeries {
  return bucketByUnit(subs, keyFn, [
    { key: "Refus", color: "#c81e1e", pick: (s) => s.stats.refusals },
    { key: "Absent", color: "#f29e0b", pick: (s) => s.stats.absences },
    { key: "Aucun agent santé", color: "#6366f1", pick: (s) => s.stats.notReachedTeam },
    { key: "Endormi", color: "#0ea5e9", pick: (s) => s.stats.childAsleep },
    { key: "HF trop loin", color: "#a855f7", pick: (s) => s.stats.childHfTooFar },
    { key: "Déjà vacciné (routine)", color: "#22b457", pick: (s) => s.stats.alreadyRoutine },
    { key: "Autres", color: "#94a3b8", pick: (s) => s.stats.childOthers },
  ], topN);
}

export function refusalReasonsByUnit(
  children: ChildRecord[],
  keyFn: (c: ChildRecord) => string | null,
  topN = 12
): ByUnitSeries {
  // Cette fonction est désormais principalement utilisée pour le détail RR si besoin,
  // ou conservée pour la compatibilité. Pour Polio, on préfère polioRefusalReasonsByUnit.
  const totalByCode = new Map<string, number>();
  for (const c of children) {
    if (c.rrReceived !== "Refus") continue;
    const code = c.refusalReasonCode || "other";
    totalByCode.set(code, (totalByCode.get(code) ?? 0) + 1);
  }

  const topDefs = POLIO_REFUSAL_REASONS.filter(d => totalByCode.has(d.code) || d.code === "other");

  const map = new Map<string, Record<string, number>>();
  for (const c of children) {
    if (c.rrReceived !== "Refus") continue;
    const k = keyFn(c);
    if (!k) continue;
    let row = map.get(k);
    if (!row) {
      row = {};
      topDefs.forEach((d) => (row![d.label] = 0));
      map.set(k, row);
    }
    const code = c.refusalReasonCode || "other";
    const def = topDefs.find((d) => d.code === code) || topDefs.find(d => d.code === "other");
    if (def) row[def.label] = (row[def.label] ?? 0) + 1;
  }

  const entries = Array.from(map.entries())
    .map(([unit, vals]) => ({
      unit: fmtUnit(unit),
      total: Object.values(vals).reduce((a, b) => a + b, 0),
      vals,
    }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, topN);

  const series = topDefs.map((d, i) => ({
    name: d.label,
    color: ["#e11d48", "#be123c", "#9f1239", "#881337", "#fb7185", "#f43f5e", "#fb7185", "#fda4af"][i % 8],
    data: entries.map((e) => e.vals[d.label] ?? 0),
  }));

  return {
    units: entries.map((e) => e.unit),
    series,
  };
}

export function polioRefusalReasonsByUnit(
  subs: CleanSubmission[],
  keyFn: (s: CleanSubmission) => string | null,
  topN = 12
): ByUnitSeries {
  return bucketByUnit(subs, keyFn, [
    { key: "Religion", color: "#e11d48", pick: (s) => s.stats.refusalReligion },
    { key: "Effets secondaires", color: "#be123c", pick: (s) => s.stats.refusalFearSideEffects },
    { key: "Trop de doses", color: "#9f1239", pick: (s) => s.stats.refusalTooManyDoses },
    { key: "Enfant malade", color: "#881337", pick: (s) => s.stats.refusalChildSick },
    { key: "Pas décideur", color: "#fb7185", pick: (s) => s.stats.refusalNotDecisionMaker },
    { key: "Rumeurs/Méfiance", color: "#f43f5e", pick: (s) => s.stats.refusalNoTrust },
    { key: "Autre", color: "#fda4af", pick: (s) => s.stats.refusalOther },
  ], topN);
}

export function absenceReasonsByUnit(
  subs: CleanSubmission[],
  keyFn: (s: CleanSubmission) => string | null,
  topN = 12
): ByUnitSeries {
  return bucketByUnit(subs, keyFn, [
    { key: "Champ", color: "#84cc16", pick: (s) => s.stats.absentFarm },
    { key: "Marché", color: "#f59e0b", pick: (s) => s.stats.absentMarket },
    { key: "Terrain de jeu", color: "#3b82f6", pick: (s) => s.stats.absentPlayAreas },
    { key: "École", color: "#d97706", pick: (s) => s.stats.absentSchool },
    { key: "Événement social", color: "#ec4899", pick: (s) => s.stats.absentSocialEvent },
    { key: "Voyage", color: "#0ea5e9", pick: (s) => s.stats.absentTravel },
    { key: "Parent absent", color: "#a855f7", pick: (s) => s.stats.absentParentAbsent },
    { key: "Autre", color: "#94a3b8", pick: (s) => s.stats.absentOther },
  ], topN);
}

export function channelsByUnit(
  subs: CleanSubmission[],
  keyFn: (s: CleanSubmission) => string | null,
  topN = 12,
  topChannels = 6
): ByUnitSeries {
  // Compter les fréquences globales pour identifier le top N canaux
  const channelTotals = new Map<string, number>();
  for (const s of subs) {
    s.stats.infoChannels.forEach((c) => {
      const lbl = c.replace(/_/g, " ");
      channelTotals.set(lbl, (channelTotals.get(lbl) ?? 0) + 1);
    });
  }
  const top = Array.from(channelTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topChannels)
    .map(([name]) => name);

  const palette = ["#4f46e5", "#0ea5e9", "#22b457", "#f59e0b", "#ec4899", "#94a3b8", "#a855f7", "#14b8a6"];

  const map = new Map<string, Record<string, number>>();
  for (const s of subs) {
    const k = keyFn(s);
    if (!k) continue;
    let row = map.get(k);
    if (!row) {
      row = {};
      top.forEach((t) => (row![t] = 0));
      row["Autres"] = 0;
      map.set(k, row);
    }
    s.stats.infoChannels.forEach((c) => {
      const lbl = c.replace(/_/g, " ");
      if (top.includes(lbl)) row![lbl] = (row![lbl] ?? 0) + 1;
      else row!["Autres"] = (row!["Autres"] ?? 0) + 1;
    });
  }

  const entries = Array.from(map.entries())
    .map(([unit, vals]) => ({
      unit: fmtUnit(unit),
      total: Object.values(vals).reduce((a, b) => a + b, 0),
      vals,
    }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, topN);

  const seriesNames = [...top, "Autres"];
  return {
    units: entries.map((e) => e.unit),
    series: seriesNames.map((name, i) => ({
      name,
      color: name === "Autres" ? "#cbd5e1" : palette[i % palette.length],
      data: entries.map((e) => e.vals[name] ?? 0),
    })),
  };
}

/**
 * Couverture vaccinale RR par âge (<5 ans / >=5 ans) par unité organisationnelle.
 */
/**
 * Répartition d'enfants par groupe démographique (âge ou sexe), par unité.
 * groupA + groupB = 100% par unité — utile pour visualiser la composition
 * de l'échantillon (vs la couverture par groupe qui peut donner ~99% des
 * deux côtés sans aucune lisibilité).
 */
export interface CoverageByGroupRow {
  unit: string;
  /** % de groupe A (<5 ans ou Masculin) parmi les évalués de l'unité. */
  groupA: number;
  /** % de groupe B (≥5 ans ou Féminin) parmi les évalués de l'unité. */
  groupB: number;
  /** Effectif absolu groupe A. */
  sampleA: number;
  /** Effectif absolu groupe B. */
  sampleB: number;
}

export function rrCoverageByAgeByUnit(
  children: ChildRecord[],
  keyFn: (c: ChildRecord) => string | null,
  topN = 12
): CoverageByGroupRow[] {
  const map = new Map<string, { totU: number; totO: number }>();
  for (const c of children) {
    const k = keyFn(c);
    if (!k) continue;
    if (c.rrReceived === undefined) continue;
    const slot = map.get(k) ?? { totU: 0, totO: 0 };
    const ageMo = c.ageMonths ?? (c.ageYears !== null && c.ageYears !== undefined ? c.ageYears * 12 : null);
    if (ageMo === null) {
      map.set(k, slot);
      continue;
    }
    if (ageMo < 60) slot.totU += 1;
    else slot.totO += 1;
    map.set(k, slot);
  }
  return Array.from(map.entries())
    .map(([unit, v]) => {
      const total = v.totU + v.totO;
      return {
        unit: fmtUnit(unit),
        groupA: total > 0 ? (v.totU * 100) / total : 0,
        groupB: total > 0 ? (v.totO * 100) / total : 0,
        sampleA: v.totU,
        sampleB: v.totO,
      };
    })
    .filter((r) => r.sampleA + r.sampleB > 0)
    .sort((a, b) => (b.sampleA + b.sampleB) - (a.sampleA + a.sampleB))
    .slice(0, topN);
}

export function rrCoverageBySexByUnit(
  children: ChildRecord[],
  keyFn: (c: ChildRecord) => string | null,
  topN = 12
): CoverageByGroupRow[] {
  const map = new Map<string, { totM: number; totF: number }>();
  for (const c of children) {
    const k = keyFn(c);
    if (!k) continue;
    if (c.rrReceived === undefined) continue;
    const slot = map.get(k) ?? { totM: 0, totF: 0 };
    if (c.sex === "M") slot.totM += 1;
    else if (c.sex === "F") slot.totF += 1;
    map.set(k, slot);
  }
  return Array.from(map.entries())
    .map(([unit, v]) => {
      const total = v.totM + v.totF;
      return {
        unit: fmtUnit(unit),
        groupA: total > 0 ? (v.totM * 100) / total : 0,
        groupB: total > 0 ? (v.totF * 100) / total : 0,
        sampleA: v.totM,
        sampleB: v.totF,
      };
    })
    .filter((r) => r.sampleA + r.sampleB > 0)
    .sort((a, b) => (b.sampleA + b.sampleB) - (a.sampleA + a.sampleB))
    .slice(0, topN);
}

/**
 * Complétude rapports (soumissions) — règle :
 *  - Un rapport attendu par ZS et par jour actif.
 *  - Province filtrée  → attendus = (# ZS de la province) × jours couverts
 *  - ZS filtrée        → attendus = 1 × jours couverts
 *  - Aucun filtre géo  → attendus = (# ZS distinctes dans la vue) × jours couverts
 */
export interface ReportsCompleteness {
  expected: number;
  submitted: number;
  completenessPct: number | null;
  daysCovered: number;
  distinctZs: number;
}

export function computeReportsCompleteness(subs: CleanSubmission[]): ReportsCompleteness {
  const days = new Set<string>();
  const zsSet = new Set<string>();
  for (const s of subs) {
    const d = s.monitoringDate ?? s.submissionTime.slice(0, 10);
    if (d) days.add(d);
    if (s.orgUnit.zs) zsSet.add(`${s.orgUnit.province}|${s.orgUnit.zs}`);
  }
  const distinctZs = zsSet.size || 1;
  const daysCovered = days.size || 1;
  const expected = distinctZs * daysCovered;
  const submitted = subs.length;
  const completenessPct = expected > 0 ? Math.min(100, (submitted * 100) / expected) : null;
  return { expected, submitted, completenessPct, daysCovered, distinctZs };
}
