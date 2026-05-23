/**
 * Pipeline ETL principal : raw -> clean -> aggregates -> facts.
 * Expose buildAnalytics() qui est le point d'entrée unique.
 */

import type { OdkSubmissionBase, OdkFetchResult } from "@/lib/types/odk";
import type {
  AggregationLevel,
  AnalyticsBundle,
  CleanSubmission,
  ChildRecord,
  AggregatesOrgUnit,
  PrecomputedKpi,
  PrecomputedTimeline,
  PrecomputedReports,
  PrecomputedReasonsByLevel,
  PrecomputedParentInformedRow,
} from "@/lib/types/domain";
import { parseSubmission } from "./parse-submission";
import { buildFactTable } from "./fact-table";
import {
  aggregateByLevel,
  analyseInformation,
  breakdownReasons,
  computeHotspots,
  orgUnitKey,
} from "./aggregate";
import { performanceByMonitor, geographicCompleteness } from "./performance";
import { CAMPAIGN_PROVINCES } from "@/config/provinces";
import {
  summarize,
  computeReportsCompleteness,
  nonVaccinationReasonsByUnit,
  rrReasonsByUnit,
  polioRefusalReasonsByUnit,
  parentInformedByUnit,
  polioBreakdown,
  polioReasonsSummary,
  rrNonVaxReasonsBreakdown,
  absenceReasonsByUnit,
  channelsByUnit,
  rrCoverageByAgeByUnit,
  rrCoverageBySexByUnit,
} from "@/lib/client/derive";
import { fmtUnit } from "@/lib/client/format";

export interface BuildOptions {
  /** Filtre strict sur les provinces campagne. */
  restrictToCampaignProvinces?: boolean;
  /** Date minimale (inclusive) YYYY-MM-DD. */
  minDate?: string | null;
  /** Date maximale (inclusive) YYYY-MM-DD. */
  maxDate?: string | null;
  /** Cascade géographique. */
  province?: string | null;
  antenne?: string | null;
  zs?: string | null;
  as?: string | null;
  locality?: string | null;
  /** Type de monitoring. */
  monitoringType?: "all" | "InProcess" | "EndProcess";
  /** Profil et nom du moniteur. */
  monitorProfile?: string | null;
  monitor?: string | null;
  /** Contexte (formulaire). */
  context?: "all" | "households" | "outside";
}

interface ParsedHalf {
  submissions: CleanSubmission[];
  children: ChildRecord[];
}

// Cache du parse par référence d'objet OdkFetchResult.
// fetchFormSubmissions retourne le MÊME objet sur cache hit, donc tant que la
// donnée n'a pas changé, parseHalf renvoie son résultat mémoïsé sans rejouer
// le parsing (~5-7s par formulaire sur 80k+ records). Quand l'ODK est
// rafraîchi, fetchFormSubmissions construit un nouvel objet → l'ancienne
// entrée WeakMap devient inatteignable et est GC'd automatiquement.
const parseHalfCache = new WeakMap<OdkFetchResult<OdkSubmissionBase>, ParsedHalf>();

function parseHalf(
  fr: OdkFetchResult<OdkSubmissionBase>,
  kind: "Household" | "Outside"
): ParsedHalf {
  const cached = parseHalfCache.get(fr);
  if (cached) return cached;
  const submissions: CleanSubmission[] = [];
  const children: ChildRecord[] = [];
  for (const s of fr.submissions) {
    const p = parseSubmission(s, kind);
    submissions.push(p.submission);
    children.push(...p.children);
  }
  const result: ParsedHalf = { submissions, children };
  parseHalfCache.set(fr, result);
  return result;
}

function parseAll(
  households: OdkFetchResult<OdkSubmissionBase>,
  outside: OdkFetchResult<OdkSubmissionBase>
): { submissions: CleanSubmission[]; children: ChildRecord[] } {
  const hh = parseHalf(households, "Household");
  const os = parseHalf(outside, "Outside");
  // Concatène en deux nouveaux tableaux sans muter les caches mémoïsés.
  return {
    submissions: hh.submissions.concat(os.submissions),
    children: hh.children.concat(os.children),
  };
}

function applyFilters(
  subs: CleanSubmission[],
  children: ChildRecord[],
  opts: BuildOptions
): { submissions: CleanSubmission[]; children: ChildRecord[] } {
  // Filtrage en UNE seule passe avec un prédicat composite : avant on
  // chaînait jusqu'à 12 .filter() qui allouaient autant de tableaux
  // intermédiaires (~25 MB de churn sur 200k records) et parcouraient le
  // dataset 12 fois. Une passe + une allocation finale = ~1-2s économisées.
  const restrict = opts.restrictToCampaignProvinces
    ? new Set(CAMPAIGN_PROVINCES as readonly string[])
    : null;
  const minDate = opts.minDate || null;
  const maxDate = opts.maxDate || null;
  const wantProvince = opts.province || null;
  const wantAntenne = opts.antenne || null;
  const wantZs = opts.zs || null;
  const wantAs = opts.as || null;
  const wantLocality = opts.locality || null;
  const wantType = opts.monitoringType && opts.monitoringType !== "all"
    ? opts.monitoringType
    : null;
  const wantProfile = opts.monitorProfile || null;
  const wantMonitor = opts.monitor || null;
  const wantContext = opts.context && opts.context !== "all"
    ? (opts.context === "households" ? "households" : "outside")
    : null;

  const filteredSubs: CleanSubmission[] = [];
  const ids = new Set<string>();
  for (const s of subs) {
    if (restrict) {
      const p = s.orgUnit.province;
      if (!p || !restrict.has(p)) continue;
    }
    if (minDate || maxDate) {
      const d = s.monitoringDate ?? s.submissionTime.slice(0, 10);
      if (minDate && d < minDate) continue;
      if (maxDate && d > maxDate) continue;
    }
    if (wantProvince && s.orgUnit.province !== wantProvince) continue;
    if (wantAntenne && s.orgUnit.antenne !== wantAntenne) continue;
    if (wantZs && s.orgUnit.zs !== wantZs) continue;
    if (wantAs && s.orgUnit.as !== wantAs) continue;
    if (wantLocality && s.orgUnit.locality !== wantLocality) continue;
    if (wantType && s.monitoringType !== wantType) continue;
    if (wantProfile && s.monitorProfile !== wantProfile) continue;
    if (wantMonitor && s.monitorName !== wantMonitor) continue;
    if (wantContext && s.form !== wantContext) continue;
    filteredSubs.push(s);
    ids.add(s.id);
  }
  const filteredChildren = children.filter((c) => ids.has(c.submissionId));
  return { submissions: filteredSubs, children: filteredChildren };
}

function bounds(subs: CleanSubmission[]): { min: string | null; max: string | null } {
  let min: string | null = null;
  let max: string | null = null;
  for (const s of subs) {
    const d = s.monitoringDate ?? s.submissionTime.slice(0, 10);
    if (!d) continue;
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
  }
  return { min, max };
}

function subKeyFor(level: AggregationLevel): (s: CleanSubmission) => string | null {
  return (s) => orgUnitKey(s.orgUnit, level);
}

function childKeyFor(level: AggregationLevel): (c: ChildRecord) => string | null {
  return (c) => orgUnitKey(c.orgUnit, level);
}

function timelineByDay(subs: CleanSubmission[]): PrecomputedTimeline {
  const map = new Map<string, { hh: number; osh: number }>();
  for (const s of subs) {
    const d = s.monitoringDate ?? s.submissionTime.slice(0, 10);
    if (!d) continue;
    const cur = map.get(d) ?? { hh: 0, osh: 0 };
    if (s.form === "households") cur.hh += 1;
    else cur.osh += 1;
    map.set(d, cur);
  }
  const sorted = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  return {
    categories: sorted.map(([d]) => d),
    households: sorted.map(([, v]) => v.hh),
    outside: sorted.map(([, v]) => v.osh),
  };
}

const ALL_LEVELS: AggregationLevel[] = ["province", "antenne", "zs", "as", "locality"];

function precomputeReasonsByLevel(
  submissions: CleanSubmission[],
  children: ChildRecord[]
) {
  const out: Record<AggregationLevel, ReturnType<typeof reasonsForLevel>> = {} as never;
  for (const lvl of ALL_LEVELS) {
    out[lvl] = reasonsForLevel(submissions, children, lvl);
  }
  return out;
}

function reasonsForLevel(
  submissions: CleanSubmission[],
  children: ChildRecord[],
  lvl: AggregationLevel
) {
  const subKey = subKeyFor(lvl);
  const childKey = childKeyFor(lvl);
  // topN désactivé (Number.MAX_SAFE_INTEGER) : on renvoie TOUTES les unités
  // au client. Le filtrage géo client-side se fait via les agrégats (byProvince,
  // byAntenne, etc.) qui sont déjà filtrés par le serveur selon la sélection.
  const noLimit = Number.MAX_SAFE_INTEGER;
  return {
    nonVaxPolio: nonVaccinationReasonsByUnit(submissions, subKey, noLimit),
    rrReasons: rrReasonsByUnit(children, childKey, { topN: noLimit }),
    polioRefusals: polioRefusalReasonsByUnit(submissions, subKey, noLimit),
    rrRefusals: rrReasonsByUnit(children, childKey, {
      categoryFilter: "DEMANDE",
      topN: noLimit,
    }),
    absences: absenceReasonsByUnit(submissions, subKey, noLimit),
    channels: channelsByUnit(submissions, subKey, noLimit),
  };
}

function precomputeParentInformedByLevel(
  submissions: CleanSubmission[]
): Record<AggregationLevel, PrecomputedParentInformedRow[]> {
  const out = {} as Record<AggregationLevel, PrecomputedParentInformedRow[]>;
  for (const lvl of ALL_LEVELS) {
    out[lvl] = parentInformedByUnit(submissions, subKeyFor(lvl));
  }
  return out;
}

function precomputeRrCoverageByAgeByLevel(children: ChildRecord[]) {
  const out = {} as Record<AggregationLevel, ReturnType<typeof rrCoverageByAgeByUnit>>;
  for (const lvl of ALL_LEVELS) {
    out[lvl] = rrCoverageByAgeByUnit(children, childKeyFor(lvl), 50);
  }
  return out;
}

function precomputeRrCoverageBySexByLevel(children: ChildRecord[]) {
  const out = {} as Record<AggregationLevel, ReturnType<typeof rrCoverageBySexByUnit>>;
  for (const lvl of ALL_LEVELS) {
    out[lvl] = rrCoverageBySexByUnit(children, childKeyFor(lvl), 50);
  }
  return out;
}

function precomputeSurveillanceByLevel(submissions: CleanSubmission[]) {
  const out = {} as Record<AggregationLevel, { unit: string; submissions: number; numberAFP: number; numberMeasles: number }[]>;
  // Surveillance se calcule sur formulaires Household uniquement.
  const hh = submissions.filter((s) => s.form === "households");
  for (const lvl of ALL_LEVELS) {
    const key = subKeyFor(lvl);
    const map = new Map<string, { submissions: number; numberAFP: number; numberMeasles: number }>();
    for (const s of hh) {
      const k = key(s);
      if (!k) continue;
      const slot = map.get(k) ?? { submissions: 0, numberAFP: 0, numberMeasles: 0 };
      slot.submissions += 1;
      slot.numberAFP += s.stats.numberAFP;
      slot.numberMeasles += s.stats.numberMeasles;
      map.set(k, slot);
    }
    out[lvl] = Array.from(map.entries())
      .map(([unit, v]) => ({ unit: fmtUnit(unit), ...v }))
      .sort((a, b) => b.submissions - a.submissions);
  }
  return out;
}

function precomputeFilterOptions(subs: CleanSubmission[]): AnalyticsBundle["filterOptions"] {
  const provinces = new Set<string>();
  const antennesByProvince = new Map<string, Set<string>>();
  const zsByAntenne = new Map<string, Set<string>>();
  const asByZs = new Map<string, Set<string>>();
  const localitiesByAs = new Map<string, Set<string>>();
  const profiles = new Set<string>();
  const monitorsByProfile = new Map<string, Set<string>>();
  const allMonitors = new Set<string>();
  let hasInProcess = false;
  let hasEndProcess = false;
  let hasHouseholds = false;
  let hasOutside = false;
  // Cascade Type ↔ Profil ↔ Moniteur
  const monitorsByType = new Map<string, Set<string>>();
  const profilesByType = new Map<string, Set<string>>();
  const typesByProfile = new Map<string, Set<string>>();

  const add = (m: Map<string, Set<string>>, k: string | null, v: string | null) => {
    if (!k || !v) return;
    let s = m.get(k);
    if (!s) m.set(k, (s = new Set()));
    s.add(v);
  };

  for (const s of subs) {
    const o = s.orgUnit;
    if (o.province) provinces.add(o.province);
    add(antennesByProvince, o.province, o.antenne);
    add(zsByAntenne, o.antenne, o.zs);
    add(asByZs, o.zs, o.as);
    add(localitiesByAs, o.as, o.locality);
    if (s.monitorProfile) profiles.add(s.monitorProfile);
    if (s.monitorName) allMonitors.add(s.monitorName);
    add(monitorsByProfile, s.monitorProfile, s.monitorName);
    if (s.monitoringType === "InProcess") hasInProcess = true;
    if (s.monitoringType === "EndProcess") hasEndProcess = true;
    if (s.form === "households") hasHouseholds = true;
    if (s.form === "outside") hasOutside = true;
    // Cross-dimension: type ↔ monitor ↔ profile
    const t = s.monitoringType;
    if (t && t !== "UNKNOWN") {
      add(monitorsByType, t, s.monitorName);
      add(profilesByType, t, s.monitorProfile);
      add(typesByProfile, s.monitorProfile, t);
    }
  }

  const sortedArr = (s: Set<string>) => Array.from(s).sort((a, b) => a.localeCompare(b));
  const mapToObj = (m: Map<string, Set<string>>) => {
    const out: Record<string, string[]> = {};
    for (const [k, v] of m) out[k] = sortedArr(v);
    return out;
  };

  return {
    provinces: sortedArr(provinces),
    antennesByProvince: mapToObj(antennesByProvince),
    zsByAntenne: mapToObj(zsByAntenne),
    asByZs: mapToObj(asByZs),
    localitiesByAs: mapToObj(localitiesByAs),
    profiles: sortedArr(profiles),
    monitorsByProfile: mapToObj(monitorsByProfile),
    allMonitors: sortedArr(allMonitors),
    hasInProcess,
    hasEndProcess,
    hasHouseholds,
    hasOutside,
    monitorsByType: mapToObj(monitorsByType),
    profilesByType: mapToObj(profilesByType),
    typesByProfile: mapToObj(typesByProfile),
  };
}

/**
 * Précalcule les centroïdes GPS par localité avec leurs non-vaccinés Polio/RR.
 * Une seule entrée par localité (moyenne lat/lng des soumissions GPS valides).
 * Filtre celles sans GPS et celles sans aucun non-vacciné.
 */
function precomputeMapPoints(
  submissions: CleanSubmission[],
  children: ChildRecord[]
): AnalyticsBundle["precomputed"]["mapPoints"] {
  type Slot = {
    sumLat: number;
    sumLng: number;
    countGeo: number;
    locality: string;
    nonVaxPolio: number;
    nonVaxRR: number;
  };
  const byLoc = new Map<string, Slot>();

  for (const s of submissions) {
    const k = s.orgUnit.localityNormKey ?? s.orgUnit.locality ?? null;
    if (!k) continue;
    let slot = byLoc.get(k);
    if (!slot) {
      slot = {
        sumLat: 0,
        sumLng: 0,
        countGeo: 0,
        locality: s.orgUnit.locality ?? "Localité",
        nonVaxPolio: 0,
        nonVaxRR: 0,
      };
      byLoc.set(k, slot);
    }
    if (
      s.geo &&
      Number.isFinite(s.geo.lat) &&
      Number.isFinite(s.geo.lng)
    ) {
      slot.sumLat += s.geo.lat;
      slot.sumLng += s.geo.lng;
      slot.countGeo += 1;
    }
    slot.nonVaxPolio += s.stats.nonVacU5;
  }

  for (const c of children) {
    const k = c.orgUnit.localityNormKey ?? c.orgUnit.locality ?? null;
    if (!k) continue;
    const slot = byLoc.get(k);
    if (!slot) continue;
    if (c.rrReceived && c.rrReceived !== "Oui") slot.nonVaxRR += 1;
  }

  const out: AnalyticsBundle["precomputed"]["mapPoints"] = [];
  for (const slot of byLoc.values()) {
    if (slot.countGeo === 0) continue;
    if (slot.nonVaxPolio + slot.nonVaxRR === 0) continue;
    out.push({
      lat: slot.sumLat / slot.countGeo,
      lng: slot.sumLng / slot.countGeo,
      locality: slot.locality,
      nonVaxPolio: slot.nonVaxPolio,
      nonVaxRR: slot.nonVaxRR,
    });
  }
  return out;
}

function precomputeRrEvidenceSources(children: ChildRecord[]) {
  const counts = new Map<string, number>();
  let total = 0;
  for (const c of children) {
    if (c.rrReceived !== "Oui") continue;
    const src = c.rrEvidence ?? "Inconnu";
    counts.set(src, (counts.get(src) ?? 0) + 1);
    total += 1;
  }
  return Array.from(counts.entries())
    .map(([source, count]) => ({
      source,
      count,
      pct: total > 0 ? (count * 100) / total : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Centroïdes GPS par moniteur × localité — pour l'export Excel des traces.
 * Agrège les coordonnées GPS des soumissions par (monitor, locality).
 */
function precomputeMonitorGeoPoints(
  submissions: CleanSubmission[]
): AnalyticsBundle["precomputed"]["monitorGeoPoints"] {
  type Slot = {
    sumLat: number;
    sumLng: number;
    countGeo: number;
    monitor: string;
    locality: string;
    submissions: number;
  };
  const byMonitorLoc = new Map<string, Slot>();

  for (const s of submissions) {
    const monitor = s.monitorName ?? "Inconnu";
    const locality = s.orgUnit.locality ?? "—";
    const k = `${monitor}|||${locality}`;

    let slot = byMonitorLoc.get(k);
    if (!slot) {
      slot = {
        sumLat: 0,
        sumLng: 0,
        countGeo: 0,
        monitor,
        locality,
        submissions: 0,
      };
      byMonitorLoc.set(k, slot);
    }
    slot.submissions += 1;
    if (s.geo && Number.isFinite(s.geo.lat) && Number.isFinite(s.geo.lng)) {
      slot.sumLat += s.geo.lat;
      slot.sumLng += s.geo.lng;
      slot.countGeo += 1;
    }
  }

  const out: AnalyticsBundle["precomputed"]["monitorGeoPoints"] = [];
  for (const slot of byMonitorLoc.values()) {
    out.push({
      monitor: slot.monitor,
      locality: slot.locality,
      lat: slot.countGeo > 0 ? slot.sumLat / slot.countGeo : null,
      lng: slot.countGeo > 0 ? slot.sumLng / slot.countGeo : null,
      submissions: slot.submissions,
    });
  }
  out.sort((a, b) => a.monitor.localeCompare(b.monitor, "fr") || a.locality.localeCompare(b.locality, "fr"));
  return out;
}

// Cache des filterOptions calculées sur le scope (parsed × restrict).
// filterOptions ne dépend QUE de la donnée brute parsée et du flag restrict
// — il est strictement identique pour tous les filtres dimensionnels
// (province/antenne/date/etc.) sur un même dataset → on évite de
// re-calculer ce gros objet (~1-2s) à chaque changement de filtre.
type FilterOptions = AnalyticsBundle["filterOptions"];
const filterOptionsCacheRestricted = new WeakMap<
  OdkFetchResult<OdkSubmissionBase>,
  WeakMap<OdkFetchResult<OdkSubmissionBase>, FilterOptions>
>();
const filterOptionsCacheUnrestricted = new WeakMap<
  OdkFetchResult<OdkSubmissionBase>,
  WeakMap<OdkFetchResult<OdkSubmissionBase>, FilterOptions>
>();

function getFilterOptions(
  households: OdkFetchResult<OdkSubmissionBase>,
  outside: OdkFetchResult<OdkSubmissionBase>,
  parsedSubs: CleanSubmission[],
  parsedChildren: ChildRecord[],
  restrict: boolean
): FilterOptions {
  const cache = restrict ? filterOptionsCacheRestricted : filterOptionsCacheUnrestricted;
  let inner = cache.get(households);
  if (inner) {
    const hit = inner.get(outside);
    if (hit) return hit;
  } else {
    inner = new WeakMap();
    cache.set(households, inner);
  }
  const scope = applyFilters(parsedSubs, parsedChildren, {
    restrictToCampaignProvinces: restrict,
  });
  const fo = precomputeFilterOptions(scope.submissions);
  inner.set(outside, fo);
  return fo;
}

export function buildAnalytics(
  households: OdkFetchResult<OdkSubmissionBase>,
  outside: OdkFetchResult<OdkSubmissionBase>,
  opts: BuildOptions = {}
): AnalyticsBundle {
  const tStart = Date.now();
  const parsed = parseAll(households, outside);
  const tParsed = Date.now() - tStart;

  // Options du FilterBar : on n'applique QUE le restrict (provinces campagne)
  // pour que les dropdowns ne dépendent pas de la sélection courante.
  // → l'utilisateur peut pivoter de Equateur vers Mongala sans dropdown vide.
  // Mémoïsé par (households, outside, restrict) → réutilisé sur tout
  // changement de filtre dimensionnel.
  const filterOptions = getFilterOptions(
    households,
    outside,
    parsed.submissions,
    parsed.children,
    !!opts.restrictToCampaignProvinces
  );
  const tOptions = Date.now() - tStart - tParsed;

  // Scope principal du dashboard : TOUS les filtres utilisateur sont appliqués
  // ici (province, antenne, ZS, AS, localité, période, contexte, type,
  // profil, moniteur). Les KPI, timelines, rapports, cartes et graphiques
  // doivent donc tous refléter immédiatement la sélection active.
  const { submissions, children } = applyFilters(parsed.submissions, parsed.children, opts);
  const tFilter = Date.now() - tStart - tParsed - tOptions;

  // Agrégats par niveau géographique — filtrés selon la sélection utilisateur
  const tAggStart = Date.now();
  const byProvince = aggregateByLevel(submissions, children, "province");
  const byAntenne = aggregateByLevel(submissions, children, "antenne");
  const byZs = aggregateByLevel(submissions, children, "zs");
  const byAs = aggregateByLevel(submissions, children, "as");
  const byLocality = aggregateByLevel(submissions, children, "locality");

  const reasons = breakdownReasons(submissions);
  const information = analyseInformation(submissions);
  const performance = performanceByMonitor(submissions, opts.monitoringType);
  const completeness = geographicCompleteness(submissions);
  const hotspots = computeHotspots(byLocality, 50);
  const b = bounds(submissions);
  const tAgg = Date.now() - tAggStart;

  // Pré-calculs : tous les indicateurs visibles sont calculés sur le scope
  // filtré. Avant, kpi/timeline/reports utilisaient un scope global campagne,
  // ce qui rendait les cartes KPI statiques malgré les filtres sélectionnés.
  const tPreStart = Date.now();
  const kpi: PrecomputedKpi = summarize(submissions, children);
  const timeline = timelineByDay(submissions);
  const reports: PrecomputedReports = computeReportsCompleteness(submissions);
  const reasonsByLevel = precomputeReasonsByLevel(submissions, children);
  const parentInformedByLevel = precomputeParentInformedByLevel(submissions);
  const polioBd = polioBreakdown(submissions);
  const polioReasonsSum = polioReasonsSummary(submissions);
  const rrNonVax = rrNonVaxReasonsBreakdown(children);
  const rrCoverageByAgeByLevel = precomputeRrCoverageByAgeByLevel(children);
  const rrCoverageBySexByLevel = precomputeRrCoverageBySexByLevel(children);
  const surveillanceByLevel = precomputeSurveillanceByLevel(submissions);
  const rrEvidenceSources = precomputeRrEvidenceSources(children);
  const mapPoints = precomputeMapPoints(submissions, children);
  const monitorGeoPoints = precomputeMonitorGeoPoints(submissions);
  // FactTable agrégée par dimension : pivot léger (~milliers de lignes par
  // province) qui alimente le filtrage client-side instantané.
  const factTable = buildFactTable(submissions, children);
  const tPre = Date.now() - tPreStart;

  console.log(
    `[buildAnalytics] parse=${tParsed}ms options=${tOptions}ms filter=${tFilter}ms ` +
      `agg=${tAgg}ms precompute=${tPre}ms total=${Date.now() - tStart}ms ` +
      `subs=${submissions.length} children=${children.length}`
  );

  const bundle: AnalyticsBundle = {
    meta: {
      generatedAt: new Date().toISOString(),
      // Counts post-filtrage campagne (coherent avec les visuels).
      householdCount: submissions.filter((s) => s.form === "households").length,
      outsideCount: submissions.filter((s) => s.form === "outside").length,
      minDate: b.min,
      maxDate: b.max,
      filteredByProvince: CAMPAIGN_PROVINCES as unknown as string[],
    },
    submissions: [] as CleanSubmission[],
    children: [] as ChildRecord[],
    factTable,
    aggregates: {
      byProvince: (byProvince as AggregatesOrgUnit[]).sort((a, b) => b.submissions - a.submissions),
      byAntenne: (byAntenne as AggregatesOrgUnit[]).sort((a, b) => b.submissions - a.submissions),
      byZs: byZs.sort((a, b) => b.submissions - a.submissions),
      byAs: byAs.sort((a, b) => b.submissions - a.submissions),
      byLocality: byLocality.sort((a, b) => b.submissions - a.submissions),
    },
    reasons,
    information,
    performance,
    completeness,
    hotspots,
    precomputed: {
      kpi,
      timeline,
      reports,
      reasonsByLevel,
      parentInformedByLevel,
      polioBreakdown: polioBd,
      polioReasonsSummary: polioReasonsSum,
      rrNonVaxReasonsBreakdown: rrNonVax,
      rrEvidenceSources,
      rrCoverageByAgeByLevel,
      rrCoverageBySexByLevel,
      surveillanceByLevel,
      mapPoints,
      monitorGeoPoints,
    },
    filterOptions,
  };
  return bundle;
}
