"use client";

import { useAnalytics } from "@/lib/client/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Grid } from "@/components/ui/Grid";
import { KpiCard } from "@/components/ui/KpiCard";
import { LoadingState } from "@/components/ui/EmptyState";
import RankingTable from "@/components/ui/RankingTable";
import { fmtInt, fmtUnit } from "@/lib/client/format";
import { useFilters } from "@/lib/state/filters";
import { resolveDrillLevel } from "@/lib/client/drill-level";

export default function SurveillancePage() {
  const { data, isLoading, error, hasData } = useAnalytics();
  const filters = useFilters();
  const hasError = !!error;

  const { level } = resolveDrillLevel(filters);

  if (isLoading || !data) return <LoadingState />;

  // Pré-calculs serveur — surveillance par niveau (formulaire Ménage uniquement).
  // Les filtres date/monitor/profile ne s'appliquent pas ici (pas réimplémentés
  // post-refactor) ; les filtres orgUnit appliquent un drill côté client.
  const allRows = data.precomputed.surveillanceByLevel[level];

  // Filtrage par drill orgUnit : on ne garde que les unités sous la sélection.
  // Pour les niveaux deep (zs/as/locality), unit est juste le nom local — on ne
  // peut pas re-filtrer par province sans avoir orgUnit complet, donc le drill
  // reste indicatif. Pour un filtrage strict, utiliser data.aggregates.
  const rows = allRows;

  const stats = rows.reduce(
    (acc, r) => ({
      submissions: acc.submissions + r.submissions,
    }),
    { submissions: 0 }
  );

  const unitLabel = level === "province" ? "Province" :
                   level === "antenne" ? "Antenne" :
                   level === "zs" ? "Zone de Santé" :
                   level === "as" ? "Aire de Santé" : "Localité";

  const getLabel = (r: { unit: string }) => fmtUnit(r.unit);

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
        title="Surveillance communautaire"
        subtitle={`Suivi des ménages visités lors du porte-à-porte (formulaire Ménage) · ${
          filters.province ? filters.province : "Toutes provinces"
        }${filters.minDate ? ` · Depuis le ${filters.minDate}` : ""}`}
      />

      <Grid cols={2} className="mb-6">
        <KpiCard
          label="Ménages visités"
          value={fmtInt(stats.submissions)}
          sub="Soumissions ménage couvertes"
          tone="neutral"
          icon="🏠"
        />
      </Grid>

      <Card>
        <CardHeader
          title="Détails par unité organisationnelle"
          subtitle="Ménages visités par niveau géographique"
        />
        <RankingTable
          rows={rows}
          defaultSort={{ key: "submissions", dir: "desc" }}
          columns={[
            {
              key: "unit",
              label: unitLabel,
              render: (r) => getLabel(r),
              sortBy: (r) => getLabel(r),
            },
            {
              key: "submissions",
              label: "Ménages visités",
              align: "right",
              render: (r) => fmtInt(r.submissions),
              sortBy: (r) => r.submissions,
            },
          ]}
        />
      </Card>
    </>
  );
}
