/**
 * Recalcule la performance par moniteur à partir de la FactTable filtrée.
 *
 * Avantages vs `data.performance` (pré-calculé serveur sur toute la campagne) :
 *  - Le filtre période (minDate/maxDate) s'applique vraiment aux soumissions
 *    comptées, pas seulement au filtre des moniteurs actifs sur la fenêtre.
 *  - L'agrégation par nom canonique élimine les doublons issus de variantes
 *    orthographiques résolues vers le même alias.
 */
"use client";

import type { FactRow, PerformanceRow } from "@/lib/types/domain";
import type { FiltersState } from "@/lib/state/filters";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { expectedFormsPerDay, type MonitorProfile } from "@/config/completeness-rules";

function matchesForPerformance(r: FactRow, f: FiltersState): boolean {
  if (f.minDate && r.d < f.minDate) return false;
  if (f.maxDate && r.d > f.maxDate) return false;
  if (f.province && r.p !== f.province) return false;
  if (f.antenne && r.a !== f.antenne) return false;
  if (f.zs && r.z !== f.zs) return false;
  if (f.as && r.as !== f.as) return false;
  if (f.locality && r.l !== f.locality) return false;
  if (f.monitoringType !== "all" && r.t !== f.monitoringType) return false;
  if (f.context !== "all") {
    const ctx = f.context === "households" ? "Household" : "Outside";
    if (r.c !== ctx) return false;
  }
  if (f.monitorProfile && f.monitorProfile !== "all" && r.pr !== f.monitorProfile) return false;
  if (f.monitor && r.m !== f.monitor) return false;
  return true;
}

type Bucket = {
  monitor: string;
  profile: string | null;
  province: string | null;
  antenne: string | null;
  zs: string | null;
  hh: number;
  oh: number;
  total: number;
  days: Set<string>;
  firstDate: string | null;
  lastDate: string | null;
};

export function derivePerformance(
  factTable: FactRow[] | undefined,
  filters: FiltersState,
): PerformanceRow[] {
  if (!factTable || factTable.length === 0) return [];

  const buckets = new Map<string, Bucket>();

  for (const r of factTable) {
    if (!matchesForPerformance(r, filters)) continue;
    const monitor = r.m ?? "Inconnu";
    let b = buckets.get(monitor);
    if (!b) {
      b = {
        monitor,
        profile: r.pr,
        province: r.p,
        antenne: r.a,
        zs: r.z,
        hh: 0,
        oh: 0,
        total: 0,
        days: new Set<string>(),
        firstDate: null,
        lastDate: null,
      };
      buckets.set(monitor, b);
    }
    b.total += r.subs;
    if (r.c === "Household") b.hh += r.subs;
    else b.oh += r.subs;
    b.days.add(r.d);
    if (!b.firstDate || r.d < b.firstDate) b.firstDate = r.d;
    if (!b.lastDate || r.d > b.lastDate) b.lastDate = r.d;
  }

  const out: PerformanceRow[] = [];
  for (const b of buckets.values()) {
    const span =
      b.firstDate && b.lastDate
        ? Math.max(1, differenceInCalendarDays(parseISO(b.lastDate), parseISO(b.firstDate)) + 1)
        : 1;
    const profile = (b.profile as MonitorProfile) ?? "Other";

    // Cibles journalières en FORMULAIRES (1 form. ménage = 10 ménages),
    // cohérentes avec le comptage des soumissions (b.hh / b.oh comptent
    // des formulaires). Voir expectedFormsPerDay pour les règles.
    const { household: dtHH, outside: dtOH } = expectedFormsPerDay(
      profile,
      filters.monitoringType,
    );

    const expectedPerDay = (dtHH ?? 0) + (dtOH ?? 0) || null;

    const completenessHouseholdPct =
      dtHH && span > 0 ? Math.min(100, (b.hh * 100) / (dtHH * span)) : null;
    const completenessOutsidePct =
      dtOH && span > 0 ? Math.min(100, (b.oh * 100) / (dtOH * span)) : null;
    const expectedTotal = ((dtHH ?? 0) + (dtOH ?? 0)) * span;
    const completenessPct =
      expectedTotal > 0 ? Math.min(100, (b.total * 100) / expectedTotal) : null;

    out.push({
      monitor: b.monitor,
      monitorNormKey: b.monitor,
      profile: b.profile,
      province: b.province,
      antenne: b.antenne,
      zs: b.zs,
      submissionsTotal: b.total,
      submissionsHousehold: b.hh,
      submissionsOutside: b.oh,
      daysActive: b.days.size,
      firstDate: b.firstDate,
      lastDate: b.lastDate,
      expectedPerDay,
      expectedHouseholdPerDay: dtHH,
      expectedOutsidePerDay: dtOH,
      averagePerDay: b.total / Math.max(1, span),
      averageHouseholdPerDay: b.hh / Math.max(1, span),
      averageOutsidePerDay: b.oh / Math.max(1, span),
      completenessPct,
      completenessHouseholdPct,
      completenessOutsidePct,
    });
  }

  out.sort((a, b) => b.submissionsTotal - a.submissionsTotal);
  return out;
}
