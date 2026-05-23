"use client";

import { useMemo } from "react";
import { useAnalytics } from "@/lib/client/api";
import { useFilters } from "@/lib/state/filters";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Grid } from "@/components/ui/Grid";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import PercentStackedBar from "@/components/charts/PercentStackedBar";
import ThresholdBar from "@/components/charts/ThresholdBar";
import { fmtInt, fmtPct } from "@/lib/client/format";
import { resolveDrillLevel } from "@/lib/client/drill-level";

export default function RaisonsPage() {
  const { data, isLoading, error, hasData } = useAnalytics();
  const f = useFilters();
  const { level, label: levelLabel } = useMemo(() => resolveDrillLevel(f), [f]);
  const hasError = !!error;

  if (isLoading || !data) return <LoadingState />;

  // Pré-calculs serveur — lib/etl/pipeline.ts (réponse Vercel <4.5 MB).
  const reasonsPolio = data.precomputed.polioReasonsSummary;
  const kpi = data.precomputed.kpi;
  const reasonsLvl = data.precomputed.reasonsByLevel[level];
  const nonVaxByUnit = reasonsLvl.nonVaxPolio;
  const refusalByUnit = reasonsLvl.polioRefusals;
  const absenceByUnit = reasonsLvl.absences;
  const channelsUnit = reasonsLvl.channels;
  const infoRows = data.precomputed.parentInformedByLevel[level].slice(0, 20);
  const avgInfo = data.information.parentInformedPct;

  return (
    <>
      {hasError && hasData && (
        <div className="mx-4 md:mx-6 mt-4 p-2 rounded border border-amber-500/30 bg-amber-500/10 text-amber-200 text-[12px] flex items-center gap-2">
          <span>⚠️</span>
          <span>Données du cache affichées — actualisation échouée</span>
          <button onClick={() => window.location.reload()} className="ml-auto text-amber-300 hover:text-amber-200 underline">
            Recharger la page
          </button>
        </div>
      )}
      <PageHeader
        title="Raisons, refus & information"
        subtitle={`Niveau d'analyse : ${levelLabel} · Filtres appliqués`}
      />

      <Grid cols={4} className="mb-4">
        <KpiCard label="Cas non-vaccinés Polio" value={fmtInt(reasonsPolio.total)} tone={reasonsPolio.total ? "bad" : "neutral"} icon="⚠️" />
        <KpiCard
          label="Refus Polio"
          value={fmtInt(kpi.refusalsPolio)}
          tone={kpi.refusalsPolio ? "bad" : "neutral"}
          icon="🚫"
        />
        <KpiCard label="Absents" value={fmtInt(reasonsPolio.absences)} tone={reasonsPolio.absences ? "warn" : "neutral"} icon="🕒" />
        <KpiCard
          label="Parents informés"
          value={fmtPct(avgInfo)}
          tone={avgInfo !== null && avgInfo >= 90 ? "good" : "warn"}
          icon="📣"
          hint="Seuil OMS : 90%"
        />
      </Grid>

      <Card className="mb-4">
        <CardHeader
          title={`Parents informés par ${levelLabel.toLowerCase()}`}
          subtitle={`Seuil opérationnel OMS : 90% · Moyenne : ${fmtPct(avgInfo)}`}
        />
        {infoRows.length ? (
          <ThresholdBar
            categories={infoRows.map((r) => r.label)}
            values={infoRows.map((r) => +r.pct.toFixed(1))}
            threshold={90}
            thresholdLabel="Seuil 90%"
            higherIsBetter
            height={Math.max(260, infoRows.length * 22 + 80)}
          />
        ) : <EmptyState />}
      </Card>

      <Card className="mb-4">
        <CardHeader
          title={`Raisons de non-vaccination · par ${levelLabel.toLowerCase()}`}
          subtitle="Répartition 100% empilée — total non vaccinés par unité"
        />
        {nonVaxByUnit.units.length ? (
          <PercentStackedBar categories={nonVaxByUnit.units} series={nonVaxByUnit.series} />
        ) : <EmptyState />}
      </Card>

      <Card className="mb-4">
        <CardHeader
          title={`Raisons des Refus Polio · par ${levelLabel.toLowerCase()}`}
          subtitle={`100% empilée — ${fmtInt(kpi.refusalsPolio)} refus cumulés`}
        />
        {refusalByUnit.units.length ? (
          <PercentStackedBar categories={refusalByUnit.units} series={refusalByUnit.series} />
        ) : <EmptyState hint="Aucun refus Polio dans la vue filtrée." />}
      </Card>

      <Card className="mb-4">
        <CardHeader
          title={`Raisons des Absences · par ${levelLabel.toLowerCase()}`}
          subtitle="Décomposition 100% empilée — formulaires Polio"
        />
        {absenceByUnit.units.length ? (
          <PercentStackedBar categories={absenceByUnit.units} series={absenceByUnit.series} />
        ) : <EmptyState />}
      </Card>

      <Card className="mb-4">
        <CardHeader
          title={`Canaux d'information · par ${levelLabel.toLowerCase()}`}
          subtitle="Top 6 canaux + Autres · 100% empilée"
        />
        {channelsUnit.units.length ? (
          <PercentStackedBar categories={channelsUnit.units} series={channelsUnit.series} />
        ) : <EmptyState />}
      </Card>
    </>
  );
}
