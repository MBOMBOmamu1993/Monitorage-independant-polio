"use client";

import { useMemo, useState } from "react";
import { useAnalytics } from "@/lib/client/api";
import { useFilters, type FiltersState } from "@/lib/state/filters";
import {
  pickAggregatesForLevel,
  resolveDrillLevel,
  labelOf,
  type DrillLevel,
} from "@/lib/client/drill-level";
import { fmtInt, fmtPct, fmtUnit } from "@/lib/client/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { exportToExcel, excelFromSeries, excelFromKpis, excelFromAggregates, excelFromPerformance, excelFromMonitorGeoPoints } from "@/lib/client/export-excel";
import type { AnalyticsBundle, PerformanceRow, PrecomputedMonitorGeoPoint } from "@/lib/types/domain";
import type { ReportInput, SynthASGroup, HBarSeries, SlideSeriesData } from "@/lib/client/export-pptx";

type MonitorGeoPoint = PrecomputedMonitorGeoPoint;

/** Legacy series shape used by the Excel export + QuickExport cards (per-section UI). */
interface LegacyBundle {
  topNonVaxPolio: SlideSeriesData;
  kpisPolio: { label: string; value: string; tone?: "good" | "warn" | "bad" | "neutral" | "brand" }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildReportInput(
  data: AnalyticsBundle,
  level: DrillLevel,
  levelLabel: string,
  levelName: string,
  aggs: ReturnType<typeof pickAggregatesForLevel>,
  orgUnitLabel: string,
  period: string,
  f: FiltersState
): { input: ReportInput; legacy: LegacyBundle } {
  // Pré-calculs serveur — voir lib/etl/pipeline.ts (réponse Vercel <4.5 MB).
  // Le rapport utilise désormais les agrégats calculés sur l'ensemble de la
  // campagne (pas de filtre date/monitor/profile spécifique côté client) ;
  // les filtres orgUnit drill-down s'appliquent via `aggs`.
  const kpi = data.precomputed.kpi;
  const b = data.precomputed.polioBreakdown;
  const reasonsLvl = data.precomputed.reasonsByLevel[level];
  const polioReasons = reasonsLvl.nonVaxPolio;
  const polioRefusals = reasonsLvl.polioRefusals;

  // Non-vax polio — Top 12 AS/unit (desc)
  const polioNonVaxUnits = [...aggs]
    .map((a) => ({
      label: labelOf(a, level),
      value: a.polioNotVaccinatedHousehold + a.polioNotVaccinatedOutside,
    }))
    .sort((x, y) => y.value - x.value)
    .slice(0, 12);

  const topNonVaxPolioHBars: HBarSeries[] = polioNonVaxUnits;
  const topNonVaxPolioLegacy: SlideSeriesData = {
    units: polioNonVaxUnits.map((u) => u.label),
    series: [{ name: "Non vaccinés Polio", color: "#e23636", data: polioNonVaxUnits.map((u) => u.value) }],
  };

  const globalEval = b.householdEval + b.outsideEval;
  const globalVac = b.householdVac + b.outsideVac;
  const globalPct = globalEval ? (globalVac / globalEval) * 100 : null;

  // Build nested AS → Localités tree when drill level is "as" (i.e. filtered by ZS)
  let synthTableNested: SynthASGroup[] | undefined;
  if (level === "as" && f.zs) {
    const byAs = data.aggregates.byAs.filter((a) => {
      if (f.province && a.orgUnit.province !== f.province) return false;
      if (f.antenne && a.orgUnit.antenne !== f.antenne) return false;
      if (a.orgUnit.zs !== f.zs) return false;
      return true;
    });
    const locsByAs = new Map<string, typeof data.aggregates.byLocality>();
    data.aggregates.byLocality.forEach((l) => {
      if (f.province && l.orgUnit.province !== f.province) return;
      if (f.antenne && l.orgUnit.antenne !== f.antenne) return;
      if (l.orgUnit.zs !== f.zs) return;
      const key = l.orgUnit.as ?? "—";
      if (!locsByAs.has(key)) locsByAs.set(key, []);
      locsByAs.get(key)!.push(l);
    });
    synthTableNested = byAs.map((a) => {
      const asName = a.orgUnit.as ?? "—";
      const locs = (locsByAs.get(asName) ?? []).map((l) => ({
        locality: fmtUnit(l.orgUnit.locality ?? "—"),
        evaluatedPolio: l.childrenPolioHousehold + l.childrenPolioOutside,
        polioNotVax: l.polioNotVaccinatedHousehold + l.polioNotVaccinatedOutside,
      })).sort((x, y) => y.polioNotVax - x.polioNotVax);
      return {
        as: fmtUnit(asName),
        evaluatedPolio: a.childrenPolioHousehold + a.childrenPolioOutside,
        polioNotVax: a.polioNotVaccinatedHousehold + a.polioNotVaccinatedOutside,
        localities: locs,
      };
    }).sort((x, y) => y.polioNotVax - x.polioNotVax);
  }

  // Determine drillLevel string for synth table selection: the pptx uses nested table when drillLevel === "zs"
  // (interpretation: user has selected a Zone de Santé, which means aggregates come at AS level).
  const drillLevelForReport: ReportInput["drillLevel"] = synthTableNested ? "zs" : level;

  // ── KPIs Polio (uniquement legacy Excel) ──────────────────────────────────
  const kpisPolio: LegacyBundle["kpisPolio"] = [
    { label: "Enfants Polio évalués", value: fmtInt(kpi.childrenPolio), tone: "neutral" },
    { label: "Vaccinés Polio", value: fmtInt(kpi.polioVaccinated), tone: "good" },
    { label: "Non vaccinés Polio", value: fmtInt(kpi.childrenPolio - kpi.polioVaccinated), tone: "bad" },
    { label: "Couverture Polio", value: fmtPct(kpi.polioCoverage) ?? "—", tone: kpi.polioRisk === "GREEN_GE_95" ? "good" : kpi.polioRisk === "YELLOW_90_94" ? "warn" : "bad" },
    { label: "Évalués (ménage)", value: fmtInt(b.householdEval), tone: "neutral" },
    { label: "Vaccinés (ménage)", value: fmtInt(b.householdVac), tone: "good" },
    { label: "Évalués (hors-ménage)", value: fmtInt(b.outsideEval), tone: "neutral" },
    { label: "Couverture globale", value: fmtPct(globalPct) ?? "—", tone: "brand" },
  ];

  // ── Défis & recommandations auto-générés ──────────────────────────────────
  const defis: string[] = [];
  const recommandations: string[] = [];
  if (kpi.polioCoverage !== null && kpi.polioCoverage < 95) {
    defis.push(`Couverture Polio sous 95 % (${fmtPct(kpi.polioCoverage) ?? "—"}) — zones à risque à identifier.`);
    recommandations.push("Cibler les AS en retard via des passages supplémentaires et un suivi rapproché.");
  }
  if (kpi.refusals > 0) {
    defis.push(`${fmtInt(kpi.refusals)} refus enregistrés — travail de sensibilisation à intensifier.`);
    recommandations.push("Mobiliser les leaders communautaires et religieux pour lever les réticences.");
  }
  if (kpi.absences > 0) {
    defis.push(`${fmtInt(kpi.absences)} absences documentées — couverture incomplète des ménages.`);
    recommandations.push("Planifier des passages de rattrapage en soirée / week-end pour capter les absents.");
  }
  if (defis.length === 0) {
    defis.push("Aucun défi majeur identifié sur la période et le périmètre sélectionnés.");
  }
  if (recommandations.length === 0) {
    recommandations.push("Maintenir le niveau actuel de supervision et documenter les bonnes pratiques.");
  }
  recommandations.push("Partager le rapport avec les équipes de la ZS concernée pour action et suivi.");

  const input: ReportInput = {
    title: "Rapport de monitorage indépendant",
    period,
    orgUnit: orgUnitLabel,
    levelLabel,
    levelName,
    drillLevel: drillLevelForReport,
    synthTableNested,
    kpisOverview: [
      { label: "Soumissions totales", value: fmtInt(kpi.submissions), tone: "brand", icon: "📋" },
      { label: "Enfants Polio évalués", value: fmtInt(kpi.childrenPolio), tone: "neutral", icon: "👶" },
      { label: "Vaccinés Polio", value: fmtInt(kpi.polioVaccinated), tone: "good", icon: "✓" },
      { label: "Couverture Polio", value: fmtPct(kpi.polioCoverage) ?? "—", tone: kpi.polioRisk === "GREEN_GE_95" ? "good" : kpi.polioRisk === "YELLOW_90_94" ? "warn" : "bad", icon: "💧" },
      { label: "Refus Polio", value: fmtInt(kpi.refusalsPolio), tone: kpi.refusalsPolio ? "bad" : "neutral", icon: "🚫" },
      { label: "Absents", value: fmtInt(kpi.absences), tone: kpi.absences ? "warn" : "neutral", icon: "⌛" },
      { label: "Moniteurs actifs", value: fmtInt(kpi.monitorsActive), tone: "neutral", icon: "👥" },
      { label: "Jours couverts", value: fmtInt(kpi.daysCovered), tone: "neutral", icon: "📅" },
    ],
    polioSplit: {
      householdEval: b.householdEval,
      householdVac: b.householdVac,
      outsideEval: b.outsideEval,
      outsideVac: b.outsideVac,
    },
    topNonVaxPolio: topNonVaxPolioHBars,
    polioReasons,
    polioRefusals,
    synthTable: aggs.slice(0, 30).map((a) => ({
      orgUnit: labelOf(a, level),
      evaluatedPolio: a.childrenPolioHousehold + a.childrenPolioOutside,
      polioNotVax: a.polioNotVaccinatedHousehold + a.polioNotVaccinatedOutside,
    })),
    defis,
    recommandations,
    drillUnitSingular: drillUnitLabels(level).singular,
    drillUnitPlural: drillUnitLabels(level).plural,
  };

  const legacy: LegacyBundle = {
    topNonVaxPolio: topNonVaxPolioLegacy,
    kpisPolio,
  };

  return { input, legacy };
}

function buildPeriodLabel(minDate: string | null, maxDate: string | null): string {
  if (!minDate && !maxDate) return "Toute la campagne";
  const fmt = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  if (minDate && maxDate) return `${fmt(minDate)} → ${fmt(maxDate)}`;
  if (minDate) return `Depuis le ${fmt(minDate)}`;
  return `Jusqu'au ${fmt(maxDate!)}`;
}

function buildOrgUnitLabel(f: FiltersState): string {
  if (f.locality) return `Localité : ${f.locality}`;
  if (f.as) return `Aire de Santé : ${f.as}`;
  if (f.zs) return `Zone de Santé : ${f.zs}`;
  if (f.antenne) return `Antenne PEV : ${f.antenne}`;
  if (f.province) return `Province : ${f.province}`;
  return "Toutes les provinces";
}

/** Returns the org-unit NAME of the deepest selection (used for filename + page de garde). */
function buildLevelName(f: FiltersState): string {
  return f.locality ?? f.as ?? f.zs ?? f.antenne ?? f.province ?? "Toutes provinces";
}

/** Returns a human label for the CURRENT selection level (not drill level).
 * Province selected → "Province"; AS selected → "Aire de Santé"; etc. */
function buildSelectionLevelLabel(f: FiltersState): string {
  if (f.locality) return "Localité";
  if (f.as) return "Aire de Santé";
  if (f.zs) return "Zone de Santé";
  if (f.antenne) return "Antenne PEV";
  if (f.province) return "Province";
  return "National";
}

/** Étiquettes singulier/pluriel pour le niveau des unités agrégées (hbars, raisons, tableau flat). */
function drillUnitLabels(level: DrillLevel): { singular: string; plural: string } {
  switch (level) {
    case "province": return { singular: "Province", plural: "Provinces" };
    case "antenne": return { singular: "Antenne PEV", plural: "Antennes PEV" };
    case "zs": return { singular: "Zone de Santé", plural: "Zones de Santé" };
    case "as": return { singular: "Aire de Santé", plural: "Aires de Santé" };
    case "locality": return { singular: "Localité", plural: "Localités" };
  }
}



// ─── Section component ────────────────────────────────────────────────────────

function SectionCard({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded border border-surface-200 bg-surface-50">
      <span className="text-sm text-oms-800 font-medium">{title}</span>
      <span className="text-xs text-surface-500">{count} lignes</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RapportPage() {
  const { data, isLoading, error } = useAnalytics();
  const f = useFilters();
  const [generatingPPT, setGeneratingPPT] = useState(false);
  const [generatingXLS, setGeneratingXLS] = useState(false);
  const [done, setDone] = useState<"ppt" | "xls" | null>(null);

  const { level, label: levelLabel } = useMemo(() => resolveDrillLevel(f), [f]);
  const aggs = useMemo(() => pickAggregatesForLevel(data, f, level), [data, f, level]);

  const period = useMemo(
    () => buildPeriodLabel(
      f.minDate ?? data?.meta.minDate ?? null,
      f.maxDate ?? data?.meta.maxDate ?? null
    ),
    [f.minDate, f.maxDate, data?.meta.minDate, data?.meta.maxDate]
  );
  const orgUnitLabel = useMemo(() => buildOrgUnitLabel(f), [f]);
  const selectionLevelLabel = useMemo(() => buildSelectionLevelLabel(f), [f]);
  const levelName = useMemo(() => buildLevelName(f), [f]);

  const built = useMemo(() => {
    if (!data) return null;
    return buildReportInput(data, level, selectionLevelLabel, levelName, aggs, orgUnitLabel, period, f);
  }, [data, level, selectionLevelLabel, levelName, aggs, orgUnitLabel, period, f]);
  const reportInput = built?.input ?? null;
  const legacy = built?.legacy ?? null;

  // Performance des moniteurs — pré-calculée côté serveur dans data.performance.
  const performanceRows: PerformanceRow[] = useMemo(
    () => (data ? data.performance : []),
    [data],
  );

  /** Points géo par moniteur et localité — pré-calculés côté serveur. */
  const monitorGeoPoints: MonitorGeoPoint[] = useMemo(
    () => (data?.precomputed.monitorGeoPoints ?? []).map((p) => ({
      monitor: p.monitor,
      locality: p.locality,
      lat: p.lat,
      lng: p.lng,
      submissions: p.submissions,
    })),
    [data],
  );

  if (isLoading) return <LoadingState />;
  if (!data) return <EmptyState />;

  const kpi = data.precomputed.kpi;

  async function handleDownloadPPT() {
    if (!reportInput) return;
    setGeneratingPPT(true);
    setDone(null);
    try {
      const { exportFullReportPPT } = await import("@/lib/client/export-pptx");
      await exportFullReportPPT(reportInput);
      setDone("ppt");
    } finally {
      setGeneratingPPT(false);
    }
  }

  async function handleDownloadXLS() {
    if (!reportInput || !legacy) return;
    setGeneratingXLS(true);
    setDone(null);
    try {
      const sheets = [
        excelFromKpis("Vue d'ensemble", reportInput.kpisOverview),
        excelFromKpis("Indicateurs Polio", legacy.kpisPolio),
        excelFromSeries("Top non-vax Polio", legacy.topNonVaxPolio.units, legacy.topNonVaxPolio.series),
        excelFromSeries("Raisons Polio", reportInput.polioReasons.units, reportInput.polioReasons.series),
        excelFromSeries("Refus Polio", reportInput.polioRefusals.units, reportInput.polioRefusals.series),
        excelFromAggregates(
          "Tableau synthétique",
          reportInput.synthTable.map((r) => ({
            orgUnit: r.orgUnit,
            evaluatedPolio: r.evaluatedPolio,
            evaluatedRR: 0,
            polioNotVax: r.polioNotVax,
            rrNotVax: 0,
            rrCovPct: null,
            polioCovPct: null,
          }))
        ),
        excelFromPerformance("Performance moniteurs", performanceRows),
        excelFromMonitorGeoPoints("Points geo moniteurs", monitorGeoPoints),
      ];
      await exportToExcel("Rapport_Polio_Complet", sheets);
      setDone("xls");
    } finally {
      setGeneratingXLS(false);
    }
  }

  const sections = [
    { title: "Vue d'ensemble (KPIs)", count: reportInput?.kpisOverview.length ?? 0 },
    { title: "Indicateurs Polio", count: legacy?.kpisPolio.length ?? 0 },
    { title: `Top non-vaccinés Polio (${levelLabel})`, count: reportInput?.topNonVaxPolio.length ?? 0 },
    { title: `Raisons non-vaccination Polio (${levelLabel})`, count: reportInput?.polioReasons.units.length ?? 0 },
    { title: `Refus et absences Polio (${levelLabel})`, count: reportInput?.polioRefusals.units.length ?? 0 },
    { title: "Tableau synthétique multi-niveaux", count: reportInput?.synthTable.length ?? 0 },
    { title: "Points géo par moniteur", count: monitorGeoPoints.length },
    { title: "Performance moniteurs (période sélectionnée)", count: performanceRows.length },
    { title: "Défis identifiés (auto-générés)", count: reportInput?.defis?.length ?? 0 },
    { title: "Points d'action (recommandations)", count: reportInput?.recommandations?.length ?? 0 },
  ];

  return (
    <>
      {!!error && (
        <div className="mx-4 md:mx-6 mt-4 p-2 rounded border border-amber-500/30 bg-amber-500/10 text-amber-200 text-[12px] flex items-center gap-2">
          <span>⚠️</span>
          <span>Données du cache affichées — actualisation échouée</span>
        </div>
      )}

      <PageHeader
        title="Télécharger le rapport"
        subtitle={`${period} · ${orgUnitLabel} · Drill : ${levelLabel}`}
      />

      {/* ── Résumé filtres ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { icon: "📍", label: "Niveau", value: orgUnitLabel },
          { icon: "📅", label: "Période", value: period },
          { icon: "🎯", label: "Drill-down", value: levelLabel },
          { icon: "📋", label: "Soumissions", value: fmtInt(kpi.submissions) },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-lg border border-surface-200 p-3 flex items-start gap-2.5">
            <span className="text-lg mt-0.5">{item.icon}</span>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-surface-400 font-medium">{item.label}</div>
              <div className="text-sm font-semibold text-oms-800 mt-0.5 leading-tight">{item.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* ── PPT download ── */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="📊 Rapport PowerPoint complet"
              subtitle={`${sections.length} slides auto-générées — design professionnel`}
            />
            <div className="px-4 pb-2 space-y-1.5">
              {sections.map((s) => (
                <SectionCard key={s.title} title={s.title} count={s.count} />
              ))}
            </div>
            <div className="px-4 pb-4 pt-2 flex flex-col gap-2">
              <button
                onClick={handleDownloadPPT}
                disabled={generatingPPT}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold text-sm text-white bg-oms-500 hover:bg-oms-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingPPT ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Génération du rapport en cours…
                  </>
                ) : (
                  <>
                    <span className="text-base">📊</span>
                    Télécharger le rapport PowerPoint
                  </>
                )}
              </button>
              {done === "ppt" && (
                <p className="text-xs text-emerald-600 text-center font-medium">
                  ✅ Rapport généré avec succès !
                </p>
              )}
              <p className="text-[11px] text-surface-400 text-center">
                Indicateurs · Graphiques · Défis · Recommandations
              </p>
            </div>
          </Card>
        </div>

        {/* ── XLS download ── */}
        <div>
          <Card>
            <CardHeader
              title="📥 Export Excel complet"
              subtitle="Toutes les données en un fichier"
            />
            <div className="px-4 pb-2 space-y-1.5">
              {sections.slice(0, 7).map((s) => (
                <SectionCard key={s.title} title={s.title} count={s.count} />
              ))}
              <div className="text-[11px] text-surface-400 px-1">+ {sections.length - 7} autres onglets…</div>
            </div>
            <div className="px-4 pb-4 pt-2 flex flex-col gap-2">
              <button
                onClick={handleDownloadXLS}
                disabled={generatingXLS}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold text-sm text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingXLS ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Export en cours…
                  </>
                ) : (
                  <>
                    <span className="text-base">📥</span>
                    Télécharger en Excel
                  </>
                )}
              </button>
              {done === "xls" && (
                <p className="text-xs text-emerald-600 text-center font-medium">
                  ✅ Export généré avec succès !
                </p>
              )}
              <p className="text-[11px] text-surface-400 text-center">
                {sections.length} onglets · Données brutes structurées
              </p>
            </div>
          </Card>

          {/* Quick tips */}
          <div className="mt-3 p-3 rounded-lg bg-oms-50 border border-oms-100 text-[11px] text-oms-700 space-y-1.5">
            <p className="font-semibold text-oms-800">💡 Conseils</p>
            <p>Utilisez les filtres (zone, période) pour cibler le rapport sur une province ou ZS spécifique.</p>
            <p>Les rapports reflètent exactement les données filtrées affichées dans le dashboard.</p>
          </div>
        </div>
      </div>

      {/* ── Per-chart quick exports ── */}
      <Card>
        <CardHeader
          title="Exports rapides par section"
          subtitle="Télécharger individuellement chaque section en Excel ou PPT"
        />
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              label: "Raisons non-vaccination Polio",
              data: reportInput?.polioReasons,
              icon: "💧",
            },
            {
              label: "Refus Polio",
              data: reportInput?.polioRefusals,
              icon: "🚫",
            },
            {
              label: "Top non-vaccinés Polio",
              data: legacy?.topNonVaxPolio,
              icon: "📍",
            },
          ].map(({ label, data, icon }) => (
            <QuickExportCard
              key={label}
              title={label}
              icon={icon}
              data={data ?? { units: [], series: [] }}
            />
          ))}
          <QuickPerformanceCard rows={performanceRows} />
          <QuickMonitorGeoCard rows={monitorGeoPoints} />
        </div>
      </Card>
    </>
  );
}

// ─── QuickPerformanceCard ─────────────────────────────────────────────────────
// Carte d'export dédiée à la performance des moniteurs.
// Excel : tableau complet (toutes colonnes). PPT : graphique top 25 par
// complétude (%) afin de rester lisible sur un slide.
function QuickPerformanceCard({ rows }: { rows: PerformanceRow[] }) {
  const [loadingXls, setLoadingXls] = useState(false);
  const [loadingPpt, setLoadingPpt] = useState(false);
  const title = "Performance moniteurs";

  async function handleExcel() {
    setLoadingXls(true);
    try {
      const sheet = excelFromPerformance(title, rows);
      await exportToExcel("Performance_moniteurs", [sheet]);
    } finally {
      setLoadingXls(false);
    }
  }

  async function handlePPT() {
    setLoadingPpt(true);
    try {
      const { exportSingleChartPPT } = await import("@/lib/client/export-pptx");
      const top = [...rows]
        .filter((r) => r.completenessPct !== null)
        .sort((a, b) => (b.completenessPct ?? 0) - (a.completenessPct ?? 0))
        .slice(0, 25);
      const data = {
        units: top.map((r) => r.monitor),
        series: [
          {
            name: "Complétude (%)",
            color: "#0093d5",
            data: top.map((r) => +(r.completenessPct ?? 0).toFixed(1)),
          },
        ],
      };
      await exportSingleChartPPT(title, data);
    } finally {
      setLoadingPpt(false);
    }
  }

  const empty = rows.length === 0;

  return (
    <div className="p-3 rounded-lg border border-surface-200 bg-surface-50 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-base">📈</span>
        <span className="text-sm font-medium text-oms-800">{title}</span>
      </div>
      <p className="text-[11px] text-surface-500">
        {empty ? "Aucune donnée" : `${rows.length} moniteurs · période sélectionnée`}
      </p>
      <div className="flex gap-2 mt-auto">
        <button
          onClick={handleExcel}
          disabled={loadingXls || empty}
          className="flex-1 text-xs py-1.5 px-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loadingXls ? "…" : "📥 Excel"}
        </button>
        <button
          onClick={handlePPT}
          disabled={loadingPpt || empty}
          className="flex-1 text-xs py-1.5 px-2 rounded bg-oms-500 text-white hover:bg-oms-600 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loadingPpt ? "…" : "📊 PPT"}
        </button>
      </div>
    </div>
  );
}

// ─── QuickMonitorGeoCard ─────────────────────────────────────────────────────────

function QuickMonitorGeoCard({ rows }: { rows: MonitorGeoPoint[] }) {
  const [loadingXls, setLoadingXls] = useState(false);
  const title = "Points géo par moniteur";

  async function handleExcel() {
    setLoadingXls(true);
    try {
      const sheet = excelFromMonitorGeoPoints(title, rows);
      await exportToExcel("Points_geo_moniteurs", [sheet]);
    } finally {
      setLoadingXls(false);
    }
  }

  const empty = rows.length === 0;
  const distinctMonitors = new Set(rows.map((r) => r.monitor)).size;

  return (
    <div className="p-3 rounded-lg border border-surface-200 bg-surface-50 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-base">📍</span>
        <span className="text-sm font-medium text-oms-800">{title}</span>
      </div>
      <p className="text-[11px] text-surface-500">
        {empty ? "Aucune donnée" : `${rows.length} points · ${distinctMonitors} moniteurs`}
      </p>
      <div className="flex gap-2 mt-auto">
        <button
          onClick={handleExcel}
          disabled={loadingXls || empty}
          className="flex-1 text-xs py-1.5 px-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loadingXls ? "…" : "📥 Excel"}
        </button>
      </div>
    </div>
  );
}

// ─── QuickExportCard ──────────────────────────────────────────────────────────

function QuickExportCard({
  title,
  icon,
  data,
}: {
  title: string;
  icon: string;
  data: { units: string[]; series: { name: string; data: number[]; color?: string }[] };
}) {
  const [loadingXls, setLoadingXls] = useState(false);
  const [loadingPpt, setLoadingPpt] = useState(false);

  async function handleExcel() {
    setLoadingXls(true);
    try {
      const sheet = excelFromSeries(title, data.units, data.series);
      await exportToExcel(title.replace(/[^a-zA-Z0-9]/g, "_"), [sheet]);
    } finally {
      setLoadingXls(false);
    }
  }

  async function handlePPT() {
    setLoadingPpt(true);
    try {
      const { exportSingleChartPPT } = await import("@/lib/client/export-pptx");
      await exportSingleChartPPT(title, data);
    } finally {
      setLoadingPpt(false);
    }
  }

  const empty = data.units.length === 0;

  return (
    <div className="p-3 rounded-lg border border-surface-200 bg-surface-50 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <span className="text-[12px] font-medium text-oms-800 flex-1 leading-tight">{title}</span>
        <span className="text-[10px] text-surface-400">{data.units.length} unités</span>
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={handleExcel}
          disabled={loadingXls || empty}
          className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded text-[11px] font-medium border border-emerald-600/40 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loadingXls ? <span className="w-3 h-3 border border-emerald-600 border-t-transparent rounded-full animate-spin" /> : <span>📥</span>}
          Excel
        </button>
        <button
          onClick={handlePPT}
          disabled={loadingPpt || empty}
          className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded text-[11px] font-medium border border-orange-500/40 text-orange-700 bg-orange-50 hover:bg-orange-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loadingPpt ? <span className="w-3 h-3 border border-orange-600 border-t-transparent rounded-full animate-spin" /> : <span>📊</span>}
          PPT
        </button>
      </div>
    </div>
  );
}
