"use client";

import { useMemo } from "react";
import { useAnalytics } from "@/lib/client/api";
import { useFilters } from "@/lib/state/filters";
import PercentStackedBar from "@/components/charts/PercentStackedBar";
import { fmtInt, fmtPct, riskChip, riskLabel } from "@/lib/client/format";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Grid, Row } from "@/components/ui/Grid";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import BarStacked from "@/components/charts/BarStacked";
import Lollipop from "@/components/charts/Lollipop";
import LineTrend from "@/components/charts/LineTrend";
import ThresholdBar from "@/components/charts/ThresholdBar";
import {
  labelOf,
  pickAggregatesForLevel,
  resolveDrillLevel,
} from "@/lib/client/drill-level";

export default function OverviewPage() {
  const { data, isLoading, error } = useAnalytics();
  const f = useFilters();
  const { level, label: levelLabel } = useMemo(() => resolveDrillLevel(f), [f]);
  const aggs = useMemo(() => pickAggregatesForLevel(data, f, level), [data, f, level]);

  // Afficher LoadingState pendant le chargement initial
  if (isLoading) return <LoadingState />;
  // Afficher EmptyState si pas de données (premier chargement ou données vides)
  if (!data) return <EmptyState />;
  // En cas d'erreur, on continue d'afficher les données en cache avec un badge discret
  const hasError = !!error;

  // KPI / timeline / reports / reasons / parent informed sont pré-calculés
  // côté serveur (bundle.precomputed) car les ~160k submissions ne tiennent
  // pas dans la limite de réponse Vercel (4.5 MB). Les filtres orgUnit
  // drill-down restent appliqués côté client via les aggregates.
  const kpi = data.precomputed.kpi;
  const reports = data.precomputed.reports;
  const trendDays = data.precomputed.timeline;
  const polioReasonsUnit = data.precomputed.reasonsByLevel[level].nonVaxPolio;
  const polioRefusUnit = data.precomputed.reasonsByLevel[level].polioRefusals;

  const unitsPolio = aggs
    .filter((a) => a.polioCoverageHouseholdPct !== null)
    .map((a) => ({ label: labelOf(a, level), value: a.polioCoverageHouseholdPct ?? 0 }))
    .sort((a, b) => a.value - b.value)
    .slice(0, 20);

  const topByVolume = [...aggs]
    .filter((r) => r.childrenPolioHousehold + r.childrenPolioOutside > 0)
    .sort(
      (a, b) =>
        b.childrenPolioHousehold +
        b.childrenPolioOutside -
        (a.childrenPolioHousehold + a.childrenPolioOutside)
    )
    .slice(0, 12);

  return (
    <>
      {hasError && (
        <div className="mx-4 md:mx-6 mt-4 p-2 rounded border border-amber-500/30 bg-amber-500/10 text-amber-200 text-[12px] flex items-center gap-2">
          <span>⚠️</span>
          <span>Données du cache affichées — actualisation échouée</span>
          <button onClick={() => window.location.reload()} className="ml-auto text-amber-300 hover:text-amber-200 underline">
            Recharger la page
          </button>
        </div>
      )}
      <PageHeader
        title="Vue d'ensemble"
        subtitle={`Monitorage 23 mai → 10 juin 2026 · Niveau d'agrégation : ${levelLabel}`}
      />

      <Grid cols={4} className="mb-4">
        <KpiCard
          label="Soumissions totales"
          value={fmtInt(kpi.submissions)}
          sub={`${fmtInt(kpi.householdSubs)} ménage · ${fmtInt(kpi.outsideSubs)} hors-ménage`}
          tone="brand"
          icon="📋"
        />
        <KpiCard
          label="Enfants Polio évalués"
          value={fmtInt(kpi.childrenPolio)}
          sub={`${fmtInt(kpi.polioVaccinated)} vaccinés`}
          tone="neutral"
          icon="💧"
        />
        <KpiCard
          label="Couverture Polio"
          value={fmtPct(kpi.polioCoverage)}
          sub={<span className={riskChip(kpi.polioRisk)}>{riskLabel(kpi.polioRisk)}</span>}
          tone={kpi.polioRisk === "GREEN_GE_95" ? "good" : kpi.polioRisk === "YELLOW_90_94" ? "warn" : "bad"}
          icon="📈"
        />
        <KpiCard
          label="Vaccinés Polio"
          value={fmtInt(kpi.polioVaccinated)}
          sub={`/ ${fmtInt(kpi.childrenPolio)} éval.`}
          tone="good"
          icon="💧"
        />
      </Grid>

      <Grid cols={4} className="mb-4">
        <KpiCard
          label="Refus Polio"
          value={fmtInt(kpi.refusalsPolio)}
          tone={kpi.refusalsPolio ? "bad" : "neutral"}
          icon="🚫"
        />
        <KpiCard label="Absents" value={fmtInt(kpi.absences)} tone={kpi.absences ? "warn" : "neutral"} icon="🕒" />
      </Grid>

      <Grid cols={4} className="mb-4">
        <KpiCard
          label="Rapports attendus"
          value={fmtInt(reports.expected)}
          sub={`${fmtInt(reports.distinctZs)} ZS × ${fmtInt(reports.daysCovered)} jours`}
          tone="neutral"
          icon="📝"
        />
        <KpiCard
          label="Rapports soumis"
          value={fmtInt(reports.submitted)}
          sub={`${fmtInt(kpi.householdSubs)} M · ${fmtInt(kpi.outsideSubs)} HM`}
          tone="brand"
          icon="📥"
        />
        <KpiCard
          label="Complétude rapports"
          value={fmtPct(reports.completenessPct)}
          tone={
            reports.completenessPct === null
              ? "neutral"
              : reports.completenessPct >= 90
              ? "good"
              : reports.completenessPct >= 70
              ? "warn"
              : "bad"
          }
          hint="Attendu : 1 rapport/jour/ZS"
          icon="✅"
        />
        <KpiCard label="Moniteurs actifs" value={fmtInt(kpi.monitorsActive)} icon="👥" />
      </Grid>

      <Row className="mb-4">
        <Card>
          <CardHeader
            title="Évolution quotidienne des soumissions"
            subtitle="Ménage + Hors-ménage"
          />
          {trendDays.categories.length ? (
            <LineTrend
              categories={trendDays.categories}
              series={[
                { name: "Ménage", data: trendDays.households, color: "#0093d5" },
                { name: "Hors-ménage", data: trendDays.outside, color: "#f29e0b" },
              ]}
            />
          ) : (
            <EmptyState />
          )}
        </Card>

        <Card>
          <CardHeader
            title={`Couverture Polio par ${levelLabel.toLowerCase()}`}
            subtitle="Seuil OMS : 95% · triée par ordre croissant"
          />
          {unitsPolio.length ? (
            <Lollipop items={unitsPolio} threshold={95} />
          ) : (
            <EmptyState />
          )}
        </Card>
      </Row>

      <div className="mb-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader
            title={`Raisons de non-vaccination Polio · par ${levelLabel.toLowerCase()}`}
            subtitle="100% empilée — cas non vaccinés issus des formulaires Polio"
          />
          {polioReasonsUnit.units.length ? (
            <PercentStackedBar categories={polioReasonsUnit.units} series={polioReasonsUnit.series} />
          ) : (
            <EmptyState hint="Aucun cas Polio non vacciné dans la vue filtrée." />
          )}
        </Card>
        <Card>
          <CardHeader
            title={`Raisons de refus Polio · par ${levelLabel.toLowerCase()}`}
            subtitle={`100% empilée — ${fmtInt(kpi.refusalsPolio)} refus cumulés`}
          />
          {polioRefusUnit.units.length ? (
            <PercentStackedBar categories={polioRefusUnit.units} series={polioRefusUnit.series} />
          ) : (
            <EmptyState hint="Aucun refus Polio dans la vue filtrée." />
          )}
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader
          title={`Top ${topByVolume.length} ${levelLabel.toLowerCase()} par volume évalué`}
          subtitle="Enfants Polio vaccinés vs non vaccinés"
        />
        {topByVolume.length ? (
          <BarStacked
            horizontal
            categories={topByVolume.map((a) => labelOf(a, level))}
            series={[
              {
                name: "Polio vaccinés",
                data: topByVolume.map((a) => a.polioVaccinatedHousehold + a.polioVaccinatedOutside),
                color: "#22b457",
              },
              {
                name: "Polio non vaccinés",
                data: topByVolume.map((a) => a.polioNotVaccinatedHousehold + a.polioNotVaccinatedOutside),
                color: "#e23636",
              },
            ]}
          />
        ) : (
          <EmptyState />
        )}
      </Card>

      {(() => {
        const rows = data.precomputed.parentInformedByLevel[level].slice(0, 20);
        if (!rows.length) return null;
        return (
          <Card>
            <CardHeader
              title={`Parents informés de la campagne · par ${levelLabel.toLowerCase()}`}
              subtitle={`Seuil opérationnel OMS : 90% · ${rows.length} ${levelLabel.toLowerCase()}(s)`}
            />
            <ThresholdBar
              categories={rows.map((r) => r.label)}
              values={rows.map((r) => +r.pct.toFixed(1))}
              threshold={90}
              thresholdLabel="Seuil 90%"
              higherIsBetter
              height={Math.max(260, rows.length * 22 + 80)}
            />
          </Card>
        );
      })()}
    </>
  );
}
