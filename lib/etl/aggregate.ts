/**
 * Agrégations par unité organisationnelle et calculs d'indicateurs.
 */

import type {
  AggregatesOrgUnit,
  ChildRecord,
  CleanSubmission,
  HotspotRow,
  OrgUnitRef,
  ReasonBreakdown,
} from "@/lib/types/domain";
import { classifyCoverage } from "@/config/reasons";
import { pickNum } from "@/config/field-map";
import { HOUSEHOLD_FIELD_MAP, OUTSIDE_FIELD_MAP } from "@/config/field-map";
import { NON_VAX_BREAKDOWN, ABSENCE_LABELS, humanChannel } from "@/config/reasons";

type Level = "province" | "antenne" | "zs" | "as" | "locality";

export function orgUnitKey(u: OrgUnitRef, level: Level): string {
  switch (level) {
    case "province": return u.province ?? "Inconnue";
    case "antenne": return [u.province, u.antenne].filter(Boolean).join(" / ") || "Inconnue";
    case "zs": return [u.province, u.antenne, u.zs].filter(Boolean).join(" / ") || "Inconnue";
    case "as": return [u.province, u.antenne, u.zs, u.as].filter(Boolean).join(" / ") || "Inconnue";
    case "locality": return [u.province, u.antenne, u.zs, u.as, u.locality].filter(Boolean).join(" / ") || "Inconnue";
  }
}

function emptyAgg(u: OrgUnitRef): AggregatesOrgUnit {
  return {
    orgUnit: u,
    submissions: 0,
    childrenRR: 0,
    childrenPolioHousehold: 0,
    childrenPolioOutside: 0,
    rrVaccinated: 0,
    rrNotVaccinated: 0,
    polioVaccinatedHousehold: 0,
    polioNotVaccinatedHousehold: 0,
    polioVaccinatedOutside: 0,
    polioNotVaccinatedOutside: 0,
    refusals: 0,
    absences: 0,
    numberAFP: 0,
    numberMeasles: 0,
    rrCoveragePct: null,
    polioCoverageHouseholdPct: null,
    polioCoverageOutsidePct: null,
    coverageRiskRR: "UNKNOWN",
    coverageRiskPolioHousehold: "UNKNOWN",
    coverageRiskPolioOutside: "UNKNOWN",
  };
}

function pct(num: number, den: number): number | null {
  if (!den) return null;
  return (num * 100) / den;
}

/** Agrège les statistiques par niveau hiérarchique. */
export function aggregateByLevel(
  submissions: CleanSubmission[],
  children: ChildRecord[],
  level: Level
): AggregatesOrgUnit[] {
  const bucket = new Map<string, { agg: AggregatesOrgUnit; u: OrgUnitRef }>();

  for (const s of submissions) {
    const k = orgUnitKey(s.orgUnit, level);
    if (!bucket.has(k)) bucket.set(k, { agg: emptyAgg(s.orgUnit), u: s.orgUnit });
    const entry = bucket.get(k)!;
    entry.agg.submissions += 1;

    // Agrégats POLIO depuis les stats déjà parsées (inclut la logique OHH)
    const totU5 = s.stats.totU5;
    const vacU5 = s.stats.vacU5;
    const nonVac = s.stats.nonVacU5;

    if (s.context === "Household") {
      entry.agg.childrenPolioHousehold += totU5;
      entry.agg.polioVaccinatedHousehold += vacU5;
      entry.agg.polioNotVaccinatedHousehold += nonVac;
    } else {
      entry.agg.childrenPolioOutside += totU5;
      entry.agg.polioVaccinatedOutside += vacU5;
      entry.agg.polioNotVaccinatedOutside += nonVac;
    }

    // Refus / Absents (depuis les stats parsées)
    entry.agg.refusals += s.stats.refusals;
    entry.agg.absences += s.stats.absences;
    entry.agg.numberAFP += s.stats.numberAFP;
    entry.agg.numberMeasles += s.stats.numberMeasles;
  }

  // Enfants RR depuis la table enfants (repeat)
  for (const c of children) {
    const k = orgUnitKey(c.orgUnit, level);
    if (!bucket.has(k)) bucket.set(k, { agg: emptyAgg(c.orgUnit), u: c.orgUnit });
    const entry = bucket.get(k)!;
    entry.agg.childrenRR += 1;
    if (c.rrReceived === "Oui") entry.agg.rrVaccinated += 1;
    else {
      // Logique des Refus RR : raison de type DEMANDE
      if (c.rrReasonGroup === "DEMANDE") {
        entry.agg.refusals += 1;
      }
      if (c.rrReceived === "Absent") {
        entry.agg.absences += 1;
      }
    }
  }

  // Non vaccinés RR = évalués - vaccinés (calcul différé pour garantir l'exactitude)
  for (const { agg } of bucket.values()) {
    agg.rrNotVaccinated = Math.max(0, agg.childrenRR - agg.rrVaccinated);
  }

  // Couvertures & classification risque
  for (const { agg } of bucket.values()) {
    agg.rrCoveragePct = pct(agg.rrVaccinated, agg.childrenRR);
    agg.polioCoverageHouseholdPct = pct(agg.polioVaccinatedHousehold, agg.childrenPolioHousehold);
    agg.polioCoverageOutsidePct = pct(agg.polioVaccinatedOutside, agg.childrenPolioOutside);
    agg.coverageRiskRR = classifyCoverage(agg.rrCoveragePct);
    agg.coverageRiskPolioHousehold = classifyCoverage(agg.polioCoverageHouseholdPct);
    agg.coverageRiskPolioOutside = classifyCoverage(agg.polioCoverageOutsidePct);
  }

  return Array.from(bucket.values()).map((v) => v.agg);
}

/**
 * Décomposition des raisons (non-vaccination, refus, absences).
 */
export function breakdownReasons(submissions: CleanSubmission[]): {
  nonVaccination: ReasonBreakdown[];
  refusals: ReasonBreakdown[];
  absences: ReasonBreakdown[];
} {
  const total = { nonVax: 0, refus: 0, abs: 0 };
  const counts = {
    nonVax: new Map<string, { count: number; category: ReasonBreakdown["category"] }>(),
    abs: new Map<string, { count: number; category: ReasonBreakdown["category"] }>(),
  };

  for (const s of submissions) {
    const map = s.context === "Household" ? HOUSEHOLD_FIELD_MAP : OUTSIDE_FIELD_MAP;
    const r = s.raw as Record<string, unknown>;

    for (const nv of NON_VAX_BREAKDOWN) {
      const n = pickNum(r, (map as unknown as Record<string, string[]>)[nv.field] ?? []) ?? 0;
      if (n <= 0) continue;
      total.nonVax += n;
      if (nv.category === "REFUS") total.refus += n;
      const slot = counts.nonVax.get(nv.label) ?? { count: 0, category: nv.category };
      slot.count += n;
      counts.nonVax.set(nv.label, slot);
    }
    for (const ab of ABSENCE_LABELS) {
      const n = pickNum(r, (map as unknown as Record<string, string[]>)[ab.field] ?? []) ?? 0;
      if (n <= 0) continue;
      total.abs += n;
      const slot = counts.abs.get(ab.label) ?? { count: 0, category: ab.category };
      slot.count += n;
      counts.abs.set(ab.label, slot);
    }
  }

  function asRows(m: Map<string, { count: number; category: ReasonBreakdown["category"] }>, t: number): ReasonBreakdown[] {
    return Array.from(m.entries())
      .map(([label, v]) => ({
        reason: label,
        category: v.category,
        count: v.count,
        pct: t ? (v.count * 100) / t : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  return {
    nonVaccination: asRows(counts.nonVax, total.nonVax),
    refusals: asRows(counts.nonVax, total.nonVax).filter((r) => r.category === "REFUS"),
    absences: asRows(counts.abs, total.abs),
  };
}

/** Analyses d'information : % parents informés + canaux. */
export function analyseInformation(submissions: CleanSubmission[]): {
  parentInformedPct: number | null;
  channels: ReasonBreakdown[];
} {
  let yes = 0;
  let tot = 0;
  const chan = new Map<string, number>();
  let totChan = 0;

  for (const s of submissions) {
    const map = s.context === "Household" ? HOUSEHOLD_FIELD_MAP : OUTSIDE_FIELD_MAP;
    const r = s.raw as Record<string, unknown>;
    const inf = pickNum(r, map.parentInformed);
    if (inf !== null) {
      tot += 1;
      if (inf >= 1) yes += 1;
    }
    const src = (r[map.infoChannels[0]] ?? r[map.infoChannels[1] ?? ""]) as unknown;
    if (typeof src === "string" && src.trim()) {
      for (const c of src.split(/\s+/)) {
        const human = humanChannel(c);
        chan.set(human, (chan.get(human) ?? 0) + 1);
        totChan += 1;
      }
    }
  }

  const channels = Array.from(chan.entries())
    .map(([reason, count]) => ({
      reason,
      category: "AUTRE" as const,
      count,
      pct: totChan ? (count * 100) / totChan : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    parentInformedPct: tot ? (yes * 100) / tot : null,
    channels,
  };
}

/**
 * Calcule les hotspots : localités avec le plus d'enfants non vaccinés.
 * Score = 0.6 * nonVax + 0.3 * refusals + 0.1 * absences, normalisé.
 */
export function computeHotspots(aggs: AggregatesOrgUnit[], topN = 30): HotspotRow[] {
  const rows = aggs.map((a) => {
    const nonVax =
      a.polioNotVaccinatedHousehold + a.polioNotVaccinatedOutside + a.rrNotVaccinated;
    const score = 0.6 * nonVax + 0.3 * a.refusals + 0.1 * a.absences;
    return {
      orgUnit: a.orgUnit,
      score,
      notVaccinated: nonVax,
      refusals: a.refusals,
      absences: a.absences,
      reasonsTop: [],
    } as HotspotRow;
  });
  rows.sort((a, b) => b.score - a.score);
  return rows.slice(0, topN);
}
