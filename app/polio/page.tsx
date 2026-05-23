"use client";

import { useMemo } from "react";
import { useAnalytics } from "@/lib/client/api";
import { useFilters } from "@/lib/state/filters";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Grid } from "@/components/ui/Grid";
import { KpiCard } from "@/components/ui/KpiCard";
import { DualPane } from "@/components/ui/DualPane";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import BarStacked from "@/components/charts/BarStacked";
import ComboBarLine from "@/components/charts/ComboBarLine";
import PercentStackedBar from "@/components/charts/PercentStackedBar";
import { fmtInt, fmtPct, riskChip, riskLabel } from "@/lib/client/format";
import ThresholdBar from "@/components/charts/ThresholdBar";
import { classifyCoverage } from "@/config/reasons";
import {
  pickAggregatesForLevel,
  resolveDrillLevel,
  labelOf,
} from "@/lib/client/drill-level";

export default function PolioPage() {
  const { data, isLoading, error, hasData } = useAnalytics();
  const f = useFilters();
  const { level, label: levelLabel } = useMemo(() => resolveDrillLevel(f), [f]);
  const aggs = useMemo(
    () => pickAggregatesForLevel(data, f, level),
    [data, f, level]
  );
  const hasError = !!error;

  // Attendre que les données soient chargées, garder l'affichage pendant les erreurs temporaires
  if (isLoading || !data) return <LoadingState />;

  // Pré-calculs serveur — voir lib/etl/pipeline.ts (réponse Vercel <4.5 MB).
  const b = data.precomputed.polioBreakdown;
  const reasonsLvl = data.precomputed.reasonsByLevel[level];
  const nonVaxByUnit = reasonsLvl.nonVaxPolio;
  const refusalByUnit = reasonsLvl.polioRefusals;
  const absenceByUnit = reasonsLvl.absences;
  const channelsUnit = reasonsLvl.channels;
  const parentInformedRows = data.precomputed.parentInformedByLevel[level];

  const hhPct = b.householdEval ? (b.householdVac / b.householdEval) * 100 : null;
  const oshPct = b.outsideEval ? (b.outsideVac / b.outsideEval) * 100 : null;
  const globalEval = b.householdEval + b.outsideEval;
  const globalVac = b.householdVac + b.outsideVac;
  const globalPct = globalEval ? (globalVac / globalEval) * 100 : null;
  const globalRisk = classifyCoverage(globalPct);

  // Combo Nombre + % non vaccinés par unité (niveau adaptatif)
  const comboRows = aggs
    .map((a) => {
      const ev = a.childrenPolioHousehold + a.childrenPolioOutside;
      const nv = a.polioNotVaccinatedHousehold + a.polioNotVaccinatedOutside;
      return {
        label: labelOf(a, level),
        ev,
        nv,
        pct: ev ? (nv / ev) * 100 : 0,
      };
    })
    .filter((r) => r.ev > 0)
    .sort((a, b) => b.nv - a.nv)
    .slice(0, 20);

  // M vs HM side-by-side (niveau adaptatif)
  const sideRows = aggs
    .map((a) => {
      const hh = a.childrenPolioHousehold
        ? ((a.childrenPolioHousehold - a.polioVaccinatedHousehold) /
            a.childrenPolioHousehold) *
          100
        : 0;
      const osh = a.childrenPolioOutside
        ? ((a.childrenPolioOutside - a.polioVaccinatedOutside) /
            a.childrenPolioOutside) *
          100
        : 0;
      const ev = a.childrenPolioHousehold + a.childrenPolioOutside;
      return { label: labelOf(a, level), hh, osh, ev };
    })
    .filter((r) => r.ev > 0)
    .sort((a, b) => b.hh + b.osh - (a.hh + a.osh))
    .slice(0, 15);

  // Top unités par volume non-vac (stacked horizontal)
  const topGap = aggs
    .map((a) => ({
      label: labelOf(a, level),
      hh: a.polioNotVaccinatedHousehold,
      osh: a.polioNotVaccinatedOutside,
      tot: a.polioNotVaccinatedHousehold + a.polioNotVaccinatedOutside,
    }))
    .filter((r) => r.tot > 0)
    .sort((a, b) => b.tot - a.tot)
    .slice(0, 15);

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
        title="Polio — nVPO2 + VPOb"
        subtitle={`Analyses ménage & hors-ménage · Seuil couverture 95% · Seuil non-vaccinés 5% · Niveau : ${levelLabel}`}
      />

      <Grid cols={4} className="mb-4">
        <KpiCard
          label="Couverture globale"
          value={fmtPct(globalPct)}
          sub={
            <span className={riskChip(globalRisk)}>{riskLabel(globalRisk)}</span>
          }
          tone="brand"
          icon="💧"
        />
        <KpiCard
          label="Enfants évalués"
          value={fmtInt(globalEval)}
          sub={`${fmtInt(globalVac)} vaccinés · ${fmtInt(globalEval - globalVac)} non vac.`}
          icon="👶"
        />
        <KpiCard
          label="Refus"
          value={fmtInt(b.refusals)}
          tone={b.refusals ? "bad" : "neutral"}
          icon="🚫"
        />
        <KpiCard
          label="Absents"
          value={fmtInt(b.absences)}
          tone={b.absences ? "warn" : "neutral"}
          icon="🕒"
        />
      </Grid>

      <DualPane
        leftTitle="Volet Ménage (M)"
        leftSubtitle="Enfants trouvés à domicile lors du monitorage"
        leftTone="brand"
        rightTitle="Volet Hors-ménage (HM)"
        rightSubtitle="Enfants rencontrés hors-ménage (écoles, marchés, transit)"
        rightTone="warn"
        leftBadge={
          <span className={riskChip(classifyCoverage(hhPct))}>
            {fmtPct(hhPct)}
          </span>
        }
        rightBadge={
          <span className={riskChip(classifyCoverage(oshPct))}>
            {fmtPct(oshPct)}
          </span>
        }
        left={
          <Grid cols={2}>
            <KpiCard
              label="Éval. ménage"
              value={fmtInt(b.householdEval)}
              tone="neutral"
            />
            <KpiCard
              label="Vaccinés ménage"
              value={fmtInt(b.householdVac)}
              tone="good"
            />
            <KpiCard
              label="Non vac. ménage"
              value={fmtInt(b.householdEval - b.householdVac)}
              tone="bad"
            />
            <KpiCard
              label="% non vac."
              value={fmtPct(
                b.householdEval
                  ? ((b.householdEval - b.householdVac) / b.householdEval) * 100
                  : null
              )}
              tone={
                b.householdEval &&
                (b.householdEval - b.householdVac) / b.householdEval > 0.05
                  ? "bad"
                  : "good"
              }
              hint="Seuil opérationnel OMS : ≤ 5%"
            />
          </Grid>
        }
        right={
          <Grid cols={2}>
            <KpiCard
              label="Éval. hors-ménage"
              value={fmtInt(b.outsideEval)}
              tone="neutral"
            />
            <KpiCard
              label="Vaccinés hors-ménage"
              value={fmtInt(b.outsideVac)}
              tone="good"
            />
            <KpiCard
              label="Non vac. hors-ménage"
              value={fmtInt(b.outsideEval - b.outsideVac)}
              tone="bad"
            />
            <KpiCard
              label="% non vac."
              value={fmtPct(
                b.outsideEval
                  ? ((b.outsideEval - b.outsideVac) / b.outsideEval) * 100
                  : null
              )}
              tone={
                b.outsideEval &&
                (b.outsideEval - b.outsideVac) / b.outsideEval > 0.05
                  ? "bad"
                  : "good"
              }
              hint="Seuil opérationnel OMS : ≤ 5%"
            />
          </Grid>
        }
      />

      <Card className="mt-4">
        <CardHeader
          title={`Nombre & % d'enfants non vaccinés par ${levelLabel.toLowerCase()}`}
          subtitle="Barres : effectif · Ligne rouge : % avec seuil opérationnel à 5%"
        />
        {comboRows.length ? (
          <ComboBarLine
            categories={comboRows.map((r) => r.label)}
            counts={comboRows.map((r) => r.nv)}
            pcts={comboRows.map((r) => +r.pct.toFixed(2))}
            threshold={5}
            countLabel="Non vaccinés"
            pctLabel="% non vaccinés"
          />
        ) : (
          <EmptyState />
        )}
      </Card>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader
            title={`% non vaccinés M vs HM par ${levelLabel.toLowerCase()}`}
            subtitle="Comparaison côte-à-côte · seuil 5%"
          />
          {sideRows.length ? (
            <BarStacked
              horizontal
              stack={false}
              categories={sideRows.map((r) => r.label)}
              series={[
                {
                  name: "% non vac. Ménage",
                  data: sideRows.map((r) => +r.hh.toFixed(1)),
                  color: "#0093d5",
                },
                {
                  name: "% non vac. Hors-ménage",
                  data: sideRows.map((r) => +r.osh.toFixed(1)),
                  color: "#f29e0b",
                },
              ]}
            />
          ) : (
            <EmptyState />
          )}
        </Card>

        <Card>
          <CardHeader
            title={`Top ${topGap.length} ${levelLabel.toLowerCase()} — non vaccinés`}
            subtitle="Effectifs ménage + hors-ménage"
          />
          {topGap.length ? (
            <BarStacked
              horizontal
              categories={topGap.map((r) => r.label)}
              series={[
                { name: "Ménage", data: topGap.map((r) => r.hh), color: "#c81e1e" },
                { name: "Hors-ménage", data: topGap.map((r) => r.osh), color: "#f29e0b" },
              ]}
            />
          ) : (
            <EmptyState />
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title={`Raisons de non-vaccination · par ${levelLabel.toLowerCase()}`}
          subtitle="Répartition 100% empilée — total non vaccinés par unité"
        />
        {nonVaxByUnit.units.length ? (
          <PercentStackedBar categories={nonVaxByUnit.units} series={nonVaxByUnit.series} />
        ) : <EmptyState />}
      </Card>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader
            title={`Raisons des Refus · par ${levelLabel.toLowerCase()}`}
            subtitle="Décomposition 100% empilée"
          />
          {refusalByUnit.units.length ? (
            <PercentStackedBar categories={refusalByUnit.units} series={refusalByUnit.series} />
          ) : <EmptyState />}
        </Card>
        <Card>
          <CardHeader
            title={`Raisons des Absences · par ${levelLabel.toLowerCase()}`}
            subtitle="Décomposition 100% empilée"
          />
          {absenceByUnit.units.length ? (
            <PercentStackedBar categories={absenceByUnit.units} series={absenceByUnit.series} />
          ) : <EmptyState />}
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(() => {
          const rows = parentInformedRows.slice(0, 20);
          if (!rows.length) return null;
          return (
            <Card>
              <CardHeader
                title={`Parents informés Polio · par ${levelLabel.toLowerCase()}`}
                subtitle="Seuil opérationnel OMS : 90%"
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

        <Card>
          <CardHeader
            title={`Canaux d'information · par ${levelLabel.toLowerCase()}`}
            subtitle="Top 6 canaux + Autres · 100% empilée"
          />
          {channelsUnit.units.length ? (
            <PercentStackedBar categories={channelsUnit.units} series={channelsUnit.series} />
          ) : <EmptyState />}
        </Card>
      </div>
    </>
  );
}
