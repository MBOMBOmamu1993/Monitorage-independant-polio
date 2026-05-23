/**
 * Indicateurs de performance par soumissionnaire + complétude géographique.
 */

import { differenceInCalendarDays, parseISO } from "date-fns";
import type { CleanSubmission, CompletenessDayRow, PerformanceRow } from "@/lib/types/domain";
import { dailyTargetFor, MonitorProfile, GEOGRAPHIC_COMPLETENESS } from "@/config/completeness-rules";

function dayStr(d: string | null): string | null {
  if (!d) return null;
  return d.slice(0, 10);
}

/**
 * Calcule la performance par moniteur.
 * @param subs - Soumissions filtrées
 * @param monitoringType - Type de monitoring pour appliquer les cibles journalières correctes
 */
export function performanceByMonitor(
  subs: CleanSubmission[],
  monitoringType: "all" | "InProcess" | "EndProcess" = "all"
): PerformanceRow[] {
  const bucket = new Map<string, PerformanceRow>();

  for (const s of subs) {
    // Bucketing par nom canonique (monitorName) — pas par monitorNormKey :
    // les variantes orthographiques d'un même moniteur (résolues vers le
    // même alias canonique) doivent être agrégées en une seule ligne.
    const key = s.monitorName ?? "__UNKNOWN__";
    if (!bucket.has(key)) {
      bucket.set(key, {
        monitor: s.monitorName ?? "Inconnu",
        monitorNormKey: key,
        profile: s.monitorProfile,
        province: s.orgUnit.province,
        antenne: s.orgUnit.antenne,
        zs: s.orgUnit.zs,
        submissionsTotal: 0,
        submissionsHousehold: 0,
        submissionsOutside: 0,
        daysActive: 0,
        firstDate: null,
        lastDate: null,
        expectedPerDay: null,
        expectedHouseholdPerDay: null,
        expectedOutsidePerDay: null,
        averagePerDay: 0,
        averageHouseholdPerDay: 0,
        averageOutsidePerDay: 0,
        completenessPct: null,
        completenessHouseholdPct: null,
        completenessOutsidePct: null,
      });
    }
    const r = bucket.get(key)!;
    r.submissionsTotal += 1;
    if (s.context === "Household") {
      r.submissionsHousehold += 1;
    } else {
      r.submissionsOutside += 1;
    }
    const d = dayStr(s.monitoringDate ?? s.submissionTime);
    if (d) {
      if (!r.firstDate || d < r.firstDate) r.firstDate = d;
      if (!r.lastDate || d > r.lastDate) r.lastDate = d;
    }
  }

  const out: PerformanceRow[] = [];
  for (const r of bucket.values()) {
    const days = new Set(
      subs
        .filter((s) => (s.monitorName ?? "__UNKNOWN__") === r.monitorNormKey)
        .map((s) => dayStr(s.monitoringDate ?? s.submissionTime))
        .filter(Boolean)
    ).size;
    r.daysActive = days;
    const span =
      r.firstDate && r.lastDate
        ? Math.max(1, differenceInCalendarDays(parseISO(r.lastDate), parseISO(r.firstDate)) + 1)
        : 1;
    r.averagePerDay = r.submissionsTotal / Math.max(1, span);
    r.averageHouseholdPerDay = r.submissionsHousehold / Math.max(1, span);
    r.averageOutsidePerDay = r.submissionsOutside / Math.max(1, span);

    const profile = (r.profile as MonitorProfile) ?? "Other";
    // Cibles type-aware : InProcess vs EndProcess ont des objectifs différents
    // InProcess : IM = 120 ménages + 2 HM/jour ; Autres = 20 + 2
    // EndProcess : IM = 60 ménages + 3 HM/jour ; Autres = 10 + 2
    let dtHH: number | null = null;
    let dtOH: number | null = null;
    if (monitoringType === "EndProcess") {
      // EndProcess : cibles réduites (fin de campagne)
      if (profile === "Indp_Monitor") {
        dtHH = 60; dtOH = 3;
      } else {
        dtHH = 10; dtOH = 2;
      }
    } else if (monitoringType === "InProcess") {
      // InProcess : cibles normales
      if (profile === "Indp_Monitor") {
        dtHH = 120; dtOH = 2;
      } else {
        dtHH = 20; dtOH = 2;
      }
    } else {
      // "all" : on utilise les cibles par défaut du profil
      dtHH = dailyTargetFor(profile, "Household");
      dtOH = dailyTargetFor(profile, "Outside");
    }
    r.expectedHouseholdPerDay = dtHH;
    r.expectedOutsidePerDay = dtOH;
    r.expectedPerDay = (dtHH ?? 0) + (dtOH ?? 0) || null;

    if (dtHH && span > 0) {
      const expectedHH = dtHH * span;
      r.completenessHouseholdPct = Math.min(100, (r.submissionsHousehold * 100) / expectedHH);
    }
    if (dtOH && span > 0) {
      const expectedOH = dtOH * span;
      r.completenessOutsidePct = Math.min(100, (r.submissionsOutside * 100) / expectedOH);
    }
    const expectedTotal = ((dtHH ?? 0) + (dtOH ?? 0)) * span;
    if (expectedTotal > 0) {
      r.completenessPct = Math.min(100, (r.submissionsTotal * 100) / expectedTotal);
    }
    out.push(r);
  }
  out.sort((a, b) => b.submissionsTotal - a.submissionsTotal);
  return out;
}

/**
 * Complétude géographique : pour chaque (niveau, unité, jour), est-ce couvert ?
 */
export function geographicCompleteness(subs: CleanSubmission[]): CompletenessDayRow[] {
  const out: CompletenessDayRow[] = [];
  const levels: Array<{ level: "province" | "antenne" | "zs"; extract: (s: CleanSubmission) => string | null }> = [
    { level: "province", extract: (s) => s.orgUnit.province },
    { level: "antenne", extract: (s) => s.orgUnit.antenne },
    { level: "zs", extract: (s) => s.orgUnit.zs },
  ];

  for (const L of levels) {
    const bucket = new Map<string, { date: string; unit: string; received: number }>();
    for (const s of subs) {
      const date = dayStr(s.monitoringDate ?? s.submissionTime);
      const unit = L.extract(s);
      if (!date || !unit) continue;
      const k = `${unit}||${date}`;
      if (!bucket.has(k)) bucket.set(k, { date, unit, received: 0 });
      bucket.get(k)!.received += 1;
    }
    const req = GEOGRAPHIC_COMPLETENESS.minSubmissionsPerDay[L.level];
    for (const v of bucket.values()) {
      out.push({
        level: L.level,
        unit: v.unit,
        date: v.date,
        submissionsRequired: req,
        submissionsReceived: v.received,
        completenessPct: v.received >= req ? 100 : (v.received * 100) / req,
      });
    }
  }
  out.sort((a, b) => (a.level + a.unit + a.date).localeCompare(b.level + b.unit + b.date));
  return out;
}
