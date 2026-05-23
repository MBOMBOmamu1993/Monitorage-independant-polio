/**
 * MOTEUR DE CALCUL CLIENT-SIDE (Fast-Filtering via Fact Table).
 * Recalcule tout le dashboard instantanément à partir du cube de données.
 */
"use client";

import type {
  AggregatesOrgUnit,
  AggregationLevel,
  AnalyticsBundle,
  CoverageRiskClass,
  PrecomputedByUnitSeries,
  PrecomputedCoverageByGroupRow,
  PrecomputedKpi,
  PrecomputedMapPoint,
  PrecomputedParentInformedRow,
  PrecomputedPolioBreakdown,
  PrecomputedPolioReasonsSummary,
  PrecomputedReasonsByLevel,
  PrecomputedRrEvidenceSource,
  PrecomputedRrNonVaxReasonsBreakdown,
  PrecomputedRrReasonDetail,
  PrecomputedSurveillanceRow,
  FactRow,
} from "@/lib/types/domain";
import type { FiltersState } from "@/lib/state/filters";
import { RR_NON_VAX_REASONS, RR_REASON_COLORS } from "@/config/reasons";

import { fmtUnit } from "./format";

const ALL_LEVELS: AggregationLevel[] = ["province", "antenne", "zs", "as", "locality"];

const RR_REASON_BY_CODE = new Map(RR_NON_VAX_REASONS.map((r) => [r.code, r] as const));

// Palettes alignées sur lib/client/derive.ts pour cohérence visuelle.
const OFFRE_PALETTE = ["#c81e1e", "#ef4444", "#f87171", "#fca5a5", "#fecaca"];
const DEMANDE_PALETTE = ["#1e3a8a", "#1f6bff", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe"];
const CHAN_PALETTE = ["#4f46e5", "#0ea5e9", "#22b457", "#f59e0b", "#ec4899", "#94a3b8", "#a855f7", "#14b8a6"];

function orgUnitKey(
  u: { province: string; antenne: string | null; zs: string | null; as: string | null; locality: string | null },
  level: AggregationLevel
): string {
  switch (level) {
    case "province": return u.province ?? "Inconnue";
    case "antenne": return [u.province, u.antenne].filter(Boolean).join(" / ") || "Inconnue";
    case "zs": return [u.province, u.antenne, u.zs].filter(Boolean).join(" / ") || "Inconnue";
    case "as": return [u.province, u.antenne, u.zs, u.as].filter(Boolean).join(" / ") || "Inconnue";
    case "locality": return [u.province, u.antenne, u.zs, u.as, u.locality].filter(Boolean).join(" / ") || "Inconnue";
  }
}

function matches(r: FactRow, f: FiltersState): boolean {
  if (f.minDate && r.d < f.minDate) return false;
  if (f.maxDate && r.d > f.maxDate) return false;
  if (f.province && r.p !== f.province) return false;
  if (f.antenne && r.a !== f.antenne) return false;
  if (f.zs && r.z !== f.zs) return false;
  if (f.as && r.as !== f.as) return false;
  if (f.locality && r.l !== f.locality) return false;
  if (f.monitoringType !== "all" && r.t !== f.monitoringType) return false;
  if (f.monitorProfile && r.pr !== f.monitorProfile) return false;
  if (f.monitor && r.m !== f.monitor) return false;
  if (f.context !== "all") {
    const ctx = f.context === "households" ? "Household" : "Outside";
    if (r.c !== ctx) return false;
  }
  return true;
}

function riskFromCoverage(pct: number | null): CoverageRiskClass {
  if (pct === null) return "UNKNOWN";
  if (pct >= 95) return "GREEN_GE_95";
  if (pct >= 90) return "YELLOW_90_94";
  return "RED_LT_90";
}

/** Type interne : accumulateur par unité, pour les charts par niveau. */
type ReasonsBuckets = {
  nonVaxP: Map<string, Record<string, number>>;
  refP: Map<string, Record<string, number>>;
  absP: Map<string, Record<string, number>>;
  rrReas: Map<string, Record<string, number>>;
  rrRefus: Map<string, Record<string, number>>;
  chan: Map<string, Record<string, number>>;
};

type DemoBuckets = {
  age: Map<string, { u: number; o: number }>;
  sex: Map<string, { m: number; f: number }>;
  inf: Map<string, { yes: number; tot: number }>;
  surv: Map<string, { subs: number; afp: number; mea: number }>;
};

function newReasonsBuckets(): ReasonsBuckets {
  return {
    nonVaxP: new Map(),
    refP: new Map(),
    absP: new Map(),
    rrReas: new Map(),
    rrRefus: new Map(),
    chan: new Map(),
  };
}

function newDemoBuckets(): DemoBuckets {
  return { age: new Map(), sex: new Map(), inf: new Map(), surv: new Map() };
}

function addReason(map: Map<string, Record<string, number>>, unit: string, key: string, val: number) {
  if (val <= 0) return;
  const slot = map.get(unit) ?? {};
  slot[key] = (slot[key] ?? 0) + val;
  map.set(unit, slot);
}

/**
 * Construit une série pour graphique 100% empilée à partir d'un schéma figé
 * (clés de série + couleurs). Retient les top-12 unités par total.
 */
function buildSeriesFromSchema(
  map: Map<string, Record<string, number>>,
  schema: { name: string; color?: string }[],
  topN = 12
): PrecomputedByUnitSeries {
  const names = schema.map((s) => s.name);
  const entries = Array.from(map.entries())
    .map(([unit, vals]) => ({
      unit,
      vals,
      total: names.reduce((s, n) => s + (vals[n] ?? 0), 0),
    }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, topN);
  return {
    units: entries.map((e) => e.unit),
    series: schema.map((s) => ({
      name: s.name,
      color: s.color,
      data: entries.map((e) => e.vals[s.name] ?? 0),
    })),
  };
}

/** Schéma figé pour les ruptures de charges polio (libellés et couleurs alignés sur derive.ts). */
const POLIO_NONVAX_SCHEMA = [
  { name: "Refus", color: "#c81e1e" },
  { name: "Absent", color: "#f29e0b" },
  { name: "Aucun agent santé", color: "#6366f1" },
  { name: "Endormi", color: "#0ea5e9" },
  { name: "HF trop loin", color: "#a855f7" },
  { name: "Déjà vacciné (routine)", color: "#22b457" },
  { name: "Autres", color: "#94a3b8" },
];

const POLIO_REFUSAL_SCHEMA = [
  { name: "Religion", color: "#e11d48" },
  { name: "Effets secondaires", color: "#be123c" },
  { name: "Trop de doses", color: "#9f1239" },
  { name: "Enfant malade", color: "#881337" },
  { name: "Pas décideur", color: "#fb7185" },
  { name: "Rumeurs/Méfiance", color: "#f43f5e" },
  { name: "Autre", color: "#fda4af" },
];

const POLIO_ABSENCE_SCHEMA = [
  { name: "Champ", color: "#84cc16" },
  { name: "Marché", color: "#f59e0b" },
  { name: "Terrain de jeu", color: "#3b82f6" },
  { name: "École", color: "#d97706" },
  { name: "Événement social", color: "#ec4899" },
  { name: "Voyage", color: "#0ea5e9" },
  { name: "Parent absent", color: "#a855f7" },
  { name: "Autre", color: "#94a3b8" },
];

/**
 * Recalcule tout le bundle à partir de la Fact Table.
 */
export function deriveFilteredBundle(bundle: AnalyticsBundle, f: FiltersState): AnalyticsBundle {
  try {
    const { factTable } = bundle;
    if (!factTable || factTable.length === 0) return bundle;

    const rows = factTable.filter((r) => matches(r, f));

    // Pass 1 — totaux globaux pour déterminer dynamiquement les top codes
    // RR (parmi tous les non-vax et parmi les refus DEMANDE) ainsi que les
    // top canaux d'information. Sans ce filtrage, la série "Autres" serait
    // soit vide soit dominante selon la sélection courante.
    const rrCodeTotals = new Map<string, number>();
    const rrDemandeCodeTotals = new Map<string, number>();
    const chanTotals = new Map<string, number>();
    let polioRefTotalGlobal = 0;
    let polioAbsTotalGlobal = 0;
    let polioNotReachedGlobal = 0;
    let polioRoutineGlobal = 0;
    let polioOthersGlobal = 0;
    let rrNonVaxTotal = 0;
    let rrOffreCount = 0;
    let rrDemandeCount = 0;
    const rrCodeCountGlobal = new Map<string, number>();
    let polioHhEval = 0, polioHhVac = 0, polioOshEval = 0, polioOshVac = 0;
    let polioRefSum = 0, polioAbsSum = 0;

    for (const r of rows) {
      for (const [code, n] of Object.entries(r.rr_re)) {
        rrCodeTotals.set(code, (rrCodeTotals.get(code) ?? 0) + n);
        rrCodeCountGlobal.set(code, (rrCodeCountGlobal.get(code) ?? 0) + n);
        rrNonVaxTotal += n;
        const def = RR_REASON_BY_CODE.get(code);
        if (def) {
          if (def.category === "OFFRE") rrOffreCount += n;
          else {
            rrDemandeCount += n;
            rrDemandeCodeTotals.set(code, (rrDemandeCodeTotals.get(code) ?? 0) + n);
          }
        }
      }
      for (const [name, n] of Object.entries(r.ch)) {
        chanTotals.set(name, (chanTotals.get(name) ?? 0) + n);
      }
      polioRefTotalGlobal += r.rfP;
      polioAbsTotalGlobal += r.abP;
      polioNotReachedGlobal += r.nv_nr;
      polioRoutineGlobal += r.nv_ro;
      polioOthersGlobal += r.nv_as + r.nv_tf + r.nv_ot;
      polioRefSum += r.rfP;
      polioAbsSum += r.abP;
      if (r.c === "Household") {
        polioHhEval += r.evP;
        polioHhVac += r.vaP;
      } else {
        polioOshEval += r.evP;
        polioOshVac += r.vaP;
      }
    }

    // Top 8 codes RR (toutes catégories) + Top 8 codes DEMANDE
    const pickTopCodes = (totals: Map<string, number>, max = 8) =>
      Array.from(totals.entries())
        .filter(([code]) => RR_REASON_BY_CODE.has(code))
        .sort((a, b) => b[1] - a[1])
        .slice(0, max)
        .map(([code]) => code);
    const topRrCodes = pickTopCodes(rrCodeTotals);
    const topRrDemandeCodes = pickTopCodes(rrDemandeCodeTotals);
    const topRrLabelSet = new Set(topRrCodes.map((c) => RR_REASON_BY_CODE.get(c)!.label));
    const topRrDemandeLabelSet = new Set(topRrDemandeCodes.map((c) => RR_REASON_BY_CODE.get(c)!.label));

    // Schémas RR — ordonnés (Top puis Autres en dernier) avec couleurs par catégorie.
    const buildRrSchema = (codes: string[]) => {
      let offreIdx = 0;
      let demandeIdx = 0;
      const list = codes.map((code) => {
        const def = RR_REASON_BY_CODE.get(code)!;
        const color = def.category === "OFFRE"
          ? OFFRE_PALETTE[offreIdx++ % OFFRE_PALETTE.length]
          : DEMANDE_PALETTE[demandeIdx++ % DEMANDE_PALETTE.length];
        return { name: def.label, color };
      });
      list.push({ name: "Autres", color: "#94a3b8" });
      return list;
    };
    const rrReasonsSchema = buildRrSchema(topRrCodes);
    const rrRefusalsSchema = buildRrSchema(topRrDemandeCodes);

    // Top 6 canaux globaux + "Autres"
    const topChans = Array.from(chanTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);
    const topChanSet = new Set(topChans);
    const channelsSchema = [
      ...topChans.map((name, i) => ({ name, color: CHAN_PALETTE[i % CHAN_PALETTE.length] })),
      { name: "Autres", color: "#cbd5e1" },
    ];

    // Pass 2 — accumulateurs KPI globaux + ventilation par niveau.
    let subs = 0, householdSubs = 0, outsideSubs = 0;
    let evP = 0, vaP = 0, nvP = 0, rfP = 0, abP = 0;
    let evR = 0, vaR = 0, nvR = 0, rfR = 0, abR = 0;
    let inf_y = 0, inf_t = 0;
    const monitors = new Set<string>();
    const dates = new Set<string>();

    const aggMaps = {} as Record<AggregationLevel, Map<string, AggregatesOrgUnit>>;
    const reasonBuckets = {} as Record<AggregationLevel, ReasonsBuckets>;
    const demoBuckets = {} as Record<AggregationLevel, DemoBuckets>;
    for (const lvl of ALL_LEVELS) {
      aggMaps[lvl] = new Map();
      reasonBuckets[lvl] = newReasonsBuckets();
      demoBuckets[lvl] = newDemoBuckets();
    }
    const timelineMap = new Map<string, { hh: number; osh: number }>();

    // Sources de preuve RR — agrégat global (toutes dimensions confondues).
    const evidenceTotals = new Map<string, number>();
    let evidenceTotal = 0;

    // mapPoints — agrégat par locality (dernier niveau orgUnit avec GPS).
    type MapAcc = { sumLat: number; sumLng: number; n: number; nvPolio: number; nvRR: number; locality: string };
    const mapAcc = new Map<string, MapAcc>();

    for (const r of rows) {
      subs += r.subs;
      if (r.c === "Household") householdSubs += r.subs; else outsideSubs += r.subs;
      evP += r.evP; vaP += r.vaP; nvP += r.nvP; rfP += r.rfP; abP += r.abP;
      evR += r.evR; vaR += r.vaR; nvR += r.nvR; rfR += r.rfR; abR += r.abR;
      inf_y += r.inf_y; inf_t += r.inf_t;
      if (r.m) monitors.add(r.m);
      if (r.d) dates.add(r.d);

      const tl = timelineMap.get(r.d) ?? { hh: 0, osh: 0 };
      if (r.c === "Household") tl.hh += r.subs; else tl.osh += r.subs;
      timelineMap.set(r.d, tl);

      // Sources de preuve RR (vaccinés)
      for (const [src, n] of Object.entries(r.rr_ev)) {
        evidenceTotals.set(src, (evidenceTotals.get(src) ?? 0) + n);
        evidenceTotal += n;
      }

      // mapPoints : on regroupe par locality. Si la dimension n'a pas de
      // localité, on saute (pas de point exploitable).
      if (r.l) {
        let slot = mapAcc.get(r.l);
        if (!slot) {
          slot = { sumLat: 0, sumLng: 0, n: 0, nvPolio: 0, nvRR: 0, locality: r.l };
          mapAcc.set(r.l, slot);
        }
        slot.sumLat += r.gLat;
        slot.sumLng += r.gLng;
        slot.n += r.gN;
        slot.nvPolio += r.nvP;
        slot.nvRR += r.nvR;
      }

      const uRef = { province: r.p || "Inconnue", antenne: r.a, zs: r.z, as: r.as, locality: r.l };

      for (const lvl of ALL_LEVELS) {
        const k = orgUnitKey(uRef, lvl);
        if (k.includes("Inconnue")) continue;

        // Agrégat couverture
        let a = aggMaps[lvl].get(k);
        if (!a) {
          a = {
            orgUnit: { ...uRef },
            submissions: 0, childrenRR: 0, childrenPolioHousehold: 0, childrenPolioOutside: 0,
            rrVaccinated: 0, rrNotVaccinated: 0, polioVaccinatedHousehold: 0, polioNotVaccinatedHousehold: 0,
            polioVaccinatedOutside: 0, polioNotVaccinatedOutside: 0, refusals: 0, absences: 0,
            numberAFP: 0, numberMeasles: 0, rrCoveragePct: null, polioCoverageHouseholdPct: null, polioCoverageOutsidePct: null,
            coverageRiskRR: "UNKNOWN", coverageRiskPolioHousehold: "UNKNOWN", coverageRiskPolioOutside: "UNKNOWN",
          };
          aggMaps[lvl].set(k, a);
        }
        a.submissions += r.subs;
        a.childrenRR += r.evR;
        a.rrVaccinated += r.vaR;
        a.rrNotVaccinated += r.nvR;
        if (r.c === "Household") {
          a.childrenPolioHousehold += r.evP;
          a.polioVaccinatedHousehold += r.vaP;
          a.polioNotVaccinatedHousehold += r.nvP;
        } else {
          a.childrenPolioOutside += r.evP;
          a.polioVaccinatedOutside += r.vaP;
          a.polioNotVaccinatedOutside += r.nvP;
        }
        a.refusals += r.rfP;
        a.absences += r.abP;
        a.numberAFP += r.afp;
        a.numberMeasles += r.mea;

        // Raisons polio (schéma figé)
        const rb = reasonBuckets[lvl];
        addReason(rb.nonVaxP, k, "Refus", r.rfP);
        addReason(rb.nonVaxP, k, "Absent", r.abP);
        addReason(rb.nonVaxP, k, "Aucun agent santé", r.nv_nr);
        addReason(rb.nonVaxP, k, "Endormi", r.nv_as);
        addReason(rb.nonVaxP, k, "HF trop loin", r.nv_tf);
        addReason(rb.nonVaxP, k, "Déjà vacciné (routine)", r.nv_ro);
        addReason(rb.nonVaxP, k, "Autres", r.nv_ot);

        addReason(rb.refP, k, "Religion", r.rf_re);
        addReason(rb.refP, k, "Effets secondaires", r.rf_se);
        addReason(rb.refP, k, "Trop de doses", r.rf_tm);
        addReason(rb.refP, k, "Enfant malade", r.rf_si);
        addReason(rb.refP, k, "Pas décideur", r.rf_de);
        addReason(rb.refP, k, "Rumeurs/Méfiance", r.rf_tr);
        addReason(rb.refP, k, "Autre", r.rf_ot);

        addReason(rb.absP, k, "Champ", r.ab_fa);
        addReason(rb.absP, k, "Marché", r.ab_ma);
        addReason(rb.absP, k, "Terrain de jeu", r.ab_pl);
        addReason(rb.absP, k, "École", r.ab_sc);
        addReason(rb.absP, k, "Événement social", r.ab_so);
        addReason(rb.absP, k, "Voyage", r.ab_tv);
        addReason(rb.absP, k, "Parent absent", r.ab_pa);
        addReason(rb.absP, k, "Autre", r.ab_ot);

        // Raisons RR (toutes + DEMANDE only) — bucketées par label, hors-top → "Autres"
        for (const [code, n] of Object.entries(r.rr_re)) {
          const def = RR_REASON_BY_CODE.get(code);
          if (!def) continue;
          const label = def.label;
          if (topRrLabelSet.has(label)) addReason(rb.rrReas, k, label, n);
          else addReason(rb.rrReas, k, "Autres", n);
          if (def.category === "DEMANDE") {
            if (topRrDemandeLabelSet.has(label)) addReason(rb.rrRefus, k, label, n);
            else addReason(rb.rrRefus, k, "Autres", n);
          }
        }

        // Canaux d'information
        for (const [chan, n] of Object.entries(r.ch)) {
          if (topChanSet.has(chan)) addReason(rb.chan, k, chan, n);
          else addReason(rb.chan, k, "Autres", n);
        }

        // Démographie / parents informés / surveillance
        const db = demoBuckets[lvl];
        if (r.rr_u5 + r.rr_o5 > 0) {
          const slot = db.age.get(k) ?? { u: 0, o: 0 };
          slot.u += r.rr_u5; slot.o += r.rr_o5;
          db.age.set(k, slot);
        }
        if (r.rr_m + r.rr_f > 0) {
          const slot = db.sex.get(k) ?? { m: 0, f: 0 };
          slot.m += r.rr_m; slot.f += r.rr_f;
          db.sex.set(k, slot);
        }
        if (r.inf_t > 0) {
          const slot = db.inf.get(k) ?? { yes: 0, tot: 0 };
          slot.yes += r.inf_y; slot.tot += r.inf_t;
          db.inf.set(k, slot);
        }
        // Surveillance épidémio : Household uniquement (cohérent avec le précalc serveur).
        if (r.c === "Household") {
          const slot = db.surv.get(k) ?? { subs: 0, afp: 0, mea: 0 };
          slot.subs += r.subs;
          slot.afp += r.afp;
          slot.mea += r.mea;
          db.surv.set(k, slot);
        }
      }
    }

    // Finalisation des agrégats (couvertures)
    const finalAggs = {} as AnalyticsBundle["aggregates"];
    for (const lvl of ALL_LEVELS) {
      const arr = Array.from(aggMaps[lvl].values()).map((a) => {
        a.rrCoveragePct = a.childrenRR > 0 ? (a.rrVaccinated * 100) / a.childrenRR : null;
        a.polioCoverageHouseholdPct = a.childrenPolioHousehold > 0 ? (a.polioVaccinatedHousehold * 100) / a.childrenPolioHousehold : null;
        a.polioCoverageOutsidePct = a.childrenPolioOutside > 0 ? (a.polioVaccinatedOutside * 100) / a.childrenPolioOutside : null;
        a.coverageRiskRR = riskFromCoverage(a.rrCoveragePct);
        a.coverageRiskPolioHousehold = riskFromCoverage(a.polioCoverageHouseholdPct);
        a.coverageRiskPolioOutside = riskFromCoverage(a.polioCoverageOutsidePct);
        return a;
      });
      const key = `by${lvl.charAt(0).toUpperCase()}${lvl.slice(1)}` as keyof typeof finalAggs;
      finalAggs[key] = arr.sort((a, b) => b.submissions - a.submissions);
    }

    // Reasons by level
    const filteredReasonsByLevel = {} as Record<AggregationLevel, PrecomputedReasonsByLevel>;
    // Coverage by group (age / sex), parent informed, surveillance — par niveau.
    const ageByLevel = {} as Record<AggregationLevel, PrecomputedCoverageByGroupRow[]>;
    const sexByLevel = {} as Record<AggregationLevel, PrecomputedCoverageByGroupRow[]>;
    const informedByLevel = {} as Record<AggregationLevel, PrecomputedParentInformedRow[]>;
    const survByLevel = {} as Record<AggregationLevel, PrecomputedSurveillanceRow[]>;

    for (const lvl of ALL_LEVELS) {
      const rb = reasonBuckets[lvl];
      filteredReasonsByLevel[lvl] = {
        nonVaxPolio: buildSeriesFromSchema(rb.nonVaxP, POLIO_NONVAX_SCHEMA),
        polioRefusals: buildSeriesFromSchema(rb.refP, POLIO_REFUSAL_SCHEMA),
        absences: buildSeriesFromSchema(rb.absP, POLIO_ABSENCE_SCHEMA),
        rrReasons: buildSeriesFromSchema(rb.rrReas, rrReasonsSchema),
        rrRefusals: buildSeriesFromSchema(rb.rrRefus, rrRefusalsSchema),
        channels: buildSeriesFromSchema(rb.chan, channelsSchema),
      };

      const db = demoBuckets[lvl];
      ageByLevel[lvl] = Array.from(db.age.entries())
        .map(([unit, v]) => {
          const total = v.u + v.o;
          return {
            unit: fmtUnit(unit),
            groupA: total > 0 ? (v.u * 100) / total : 0,
            groupB: total > 0 ? (v.o * 100) / total : 0,
            sampleA: v.u,
            sampleB: v.o,
          };
        })
        .filter((r) => r.sampleA + r.sampleB > 0)
        .sort((a, b) => b.sampleA + b.sampleB - (a.sampleA + a.sampleB))
        .slice(0, 50);

      sexByLevel[lvl] = Array.from(db.sex.entries())
        .map(([unit, v]) => {
          const total = v.m + v.f;
          return {
            unit: fmtUnit(unit),
            groupA: total > 0 ? (v.m * 100) / total : 0,
            groupB: total > 0 ? (v.f * 100) / total : 0,
            sampleA: v.m,
            sampleB: v.f,
          };
        })
        .filter((r) => r.sampleA + r.sampleB > 0)
        .sort((a, b) => b.sampleA + b.sampleB - (a.sampleA + a.sampleB))
        .slice(0, 50);

      informedByLevel[lvl] = Array.from(db.inf.entries())
        .filter(([, v]) => v.tot > 0)
        .map(([label, v]) => ({
          label: fmtUnit(label),
          pct: (v.yes * 100) / v.tot,
          sample: v.tot,
        }))
        .sort((a, b) => b.pct - a.pct);

      survByLevel[lvl] = Array.from(db.surv.entries())
        .map(([unit, v]) => ({ unit: fmtUnit(unit), submissions: v.subs, numberAFP: v.afp, numberMeasles: v.mea }))
        .sort((a, b) => b.submissions - a.submissions);
    }

    // KPIs finaux
    const rrCov = evR > 0 ? (vaR * 100) / evR : null;
    const polioCov = evP > 0 ? (vaP * 100) / evP : null;
    const kpi: PrecomputedKpi = {
      submissions: subs, householdSubs, outsideSubs,
      childrenRR: evR, childrenPolio: evP,
      rrVaccinated: vaR, polioVaccinated: vaP,
      rrCoverage: rrCov, polioCoverage: polioCov,
      rrRisk: riskFromCoverage(rrCov), polioRisk: riskFromCoverage(polioCov),
      refusals: rfP + rfR, refusalsPolio: rfP, refusalsRR: rfR,
      absences: abP + abR,
      monitorsActive: monitors.size,
      daysCovered: dates.size,
    };

    const timelineSorted = Array.from(timelineMap.entries()).sort(([a], [b]) => (a || "").localeCompare(b || ""));

    const polioBreakdownF: PrecomputedPolioBreakdown = {
      householdEval: polioHhEval,
      householdVac: polioHhVac,
      outsideEval: polioOshEval,
      outsideVac: polioOshVac,
      refusals: polioRefSum,
      absences: polioAbsSum,
    };

    const polioReasonsTotal = polioRefTotalGlobal + polioAbsTotalGlobal + polioNotReachedGlobal + polioRoutineGlobal + polioOthersGlobal;
    const polioReasonsSummaryF: PrecomputedPolioReasonsSummary = {
      refusals: polioRefTotalGlobal,
      absences: polioAbsTotalGlobal,
      notReachedTeam: polioNotReachedGlobal,
      alreadyRoutine: polioRoutineGlobal,
      otherNonVax: polioOthersGlobal,
      total: polioReasonsTotal,
    };

    const rrDetails: PrecomputedRrReasonDetail[] = RR_NON_VAX_REASONS
      .map((def) => {
        const count = rrCodeCountGlobal.get(def.code) ?? 0;
        return {
          code: def.code,
          label: def.label,
          category: def.category,
          count,
          pct: rrNonVaxTotal > 0 ? (count * 100) / rrNonVaxTotal : 0,
          color: RR_REASON_COLORS[def.category],
        };
      })
      .filter((d) => d.count > 0)
      .sort((a, b) => b.pct - a.pct);

    const rrNonVaxBreakdownF: PrecomputedRrNonVaxReasonsBreakdown = {
      total: rrNonVaxTotal,
      offre: { count: rrOffreCount, pct: rrNonVaxTotal > 0 ? (rrOffreCount * 100) / rrNonVaxTotal : 0 },
      demande: { count: rrDemandeCount, pct: rrNonVaxTotal > 0 ? (rrDemandeCount * 100) / rrNonVaxTotal : 0 },
      details: rrDetails,
    };

    const evidenceSourcesF: PrecomputedRrEvidenceSource[] = Array.from(evidenceTotals.entries())
      .map(([source, count]) => ({
        source,
        count,
        pct: evidenceTotal > 0 ? (count * 100) / evidenceTotal : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const mapPointsF: PrecomputedMapPoint[] = [];
    for (const slot of mapAcc.values()) {
      if (slot.n === 0) continue;
      if (slot.nvPolio + slot.nvRR === 0) continue;
      mapPointsF.push({
        lat: slot.sumLat / slot.n,
        lng: slot.sumLng / slot.n,
        locality: slot.locality,
        nonVaxPolio: slot.nvPolio,
        nonVaxRR: slot.nvRR,
      });
    }

    return {
      ...bundle,
      meta: { ...bundle.meta, householdCount: householdSubs, outsideCount: outsideSubs },
      aggregates: finalAggs,
      precomputed: {
        ...bundle.precomputed,
        kpi,
        timeline: {
          categories: timelineSorted.map(([d]) => d || "Unknown"),
          households: timelineSorted.map(([, v]) => v.hh),
          outside: timelineSorted.map(([, v]) => v.osh),
        },
        reasonsByLevel: filteredReasonsByLevel,
        parentInformedByLevel: informedByLevel,
        rrCoverageByAgeByLevel: ageByLevel,
        rrCoverageBySexByLevel: sexByLevel,
        surveillanceByLevel: survByLevel,
        polioBreakdown: polioBreakdownF,
        polioReasonsSummary: polioReasonsSummaryF,
        rrNonVaxReasonsBreakdown: rrNonVaxBreakdownF,
        rrEvidenceSources: evidenceSourcesF,
        mapPoints: mapPointsF,
      },
    };
  } catch (error) {
    console.error("Erreur critique dans deriveFilteredBundle:", error);
    return bundle;
  }
}
