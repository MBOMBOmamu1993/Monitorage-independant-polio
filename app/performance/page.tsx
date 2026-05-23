"use client";

import { useMemo, useState } from "react";
import { useAnalytics } from "@/lib/client/api";
import { useFilters } from "@/lib/state/filters";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Grid } from "@/components/ui/Grid";
import { KpiCard } from "@/components/ui/KpiCard";
import { LoadingState, EmptyState } from "@/components/ui/EmptyState";
import RankingTable from "@/components/ui/RankingTable";
import BarStacked from "@/components/charts/BarStacked";
import ThresholdBar from "@/components/charts/ThresholdBar";
import { fmtInt, fmtPct, fmtDateShort, riskChip } from "@/lib/client/format";

type ProfileFilter = "all" | "Indp_Monitor" | "team_sup" | "District_sup" | "Other";

export default function PerformancePage() {
  const { data, isLoading, error, hasData } = useAnalytics();
  const filters = useFilters();
  const [profileFilter, setProfileFilter] = useState<ProfileFilter>("all");
  const hasError = !!error;

  // La performance est maintenant pré-calculée côté serveur dans data.performance.
  // Le filtre par profil se fait par un simple .filter() sur le tableau.
  const filteredPerformance = useMemo(() => {
    if (!data) return [];
    const effectiveProfile =
      profileFilter !== "all" ? profileFilter : filters.monitorProfile;
    if (effectiveProfile && effectiveProfile !== "all") {
      return data.performance.filter((r) => r.profile === effectiveProfile);
    }
    return data.performance;
  }, [data, filters, profileFilter]);

  const kpi = useMemo(() => {
    const list = filteredPerformance;
    const totalMonitors = list.length;
    const complete = list.filter((r) => (r.completenessPct ?? 0) >= 90).length;
    const warn = list.filter(
      (r) => (r.completenessPct ?? 0) >= 70 && (r.completenessPct ?? 0) < 90
    ).length;
    const critical = list.filter((r) => (r.completenessPct ?? 0) < 70).length;
    const avgHH =
      list.length > 0
        ? list.reduce((s, r) => s + r.averageHouseholdPerDay, 0) / list.length
        : 0;
    const avgOH =
      list.length > 0
        ? list.reduce((s, r) => s + r.averageOutsidePerDay, 0) / list.length
        : 0;
    return { totalMonitors, complete, warn, critical, avgHH, avgOH };
  }, [filteredPerformance]);

  if (isLoading || !data) return <LoadingState />;

  const rows = filteredPerformance;
  const showWarning = hasError && hasData;

  const top = [...rows]
    .filter((r) => r.completenessPct !== null)
    .sort((a, b) => (b.completenessPct ?? 0) - (a.completenessPct ?? 0))
    .slice(0, 15);

  const bottom = [...rows]
    .filter((r) => r.completenessPct !== null)
    .sort((a, b) => (a.completenessPct ?? 0) - (b.completenessPct ?? 0))
    .slice(0, 15);

  const avgByProfile = (() => {
    const bucket = new Map<string, { hh: number; oh: number; n: number }>();
    for (const r of rows) {
      const p = r.profile ?? "Other";
      const slot = bucket.get(p) ?? { hh: 0, oh: 0, n: 0 };
      slot.hh += r.averageHouseholdPerDay;
      slot.oh += r.averageOutsidePerDay;
      slot.n += 1;
      bucket.set(p, slot);
    }
    return Array.from(bucket.entries()).map(([p, v]) => ({
      profile: p,
      avgHH: v.n ? v.hh / v.n : 0,
      avgOH: v.n ? v.oh / v.n : 0,
      n: v.n,
    }));
  })();

  return (
    <>
      {showWarning && (
        <div className="mx-4 md:mx-6 mt-4 p-2 rounded border border-amber-500/30 bg-amber-500/10 text-amber-200 text-[12px] flex items-center gap-2">
          <span>⚠️</span>
          <span>Données du cache affichées — actualisation échouée</span>
          <button onClick={() => window.location.reload()} className="ml-auto text-amber-300 hover:text-amber-200 underline">
            Recharger la page
          </button>
        </div>
      )}
      <PageHeader
        title="Performance des moniteurs"
        subtitle={
          filters.monitoringType === "EndProcess"
            ? "Cibles (end process) : Moniteur indépendant 3 form. ménages + 2 form. HM /jour · Autres profils : ne travaillent pas en end process"
            : "Cibles (in process) : 3 form. ménages + 2 form. HM /jour (tous profils) · 1 formulaire = 10 ménages"
        }
        right={
          <select
            className="input"
            value={profileFilter}
            onChange={(e) => setProfileFilter(e.target.value as ProfileFilter)}
          >
            <option value="all">Tous profils</option>
            <option value="Indp_Monitor">Moniteur indépendant</option>
            <option value="team_sup">Superviseur équipe</option>
            <option value="District_sup">Superviseur district</option>
            <option value="Other">Autre</option>
          </select>
        }
      />

      <Grid cols={4} className="mb-4">
        <KpiCard
          label="Moniteurs actifs"
          value={fmtInt(kpi.totalMonitors)}
          tone="brand"
          icon="👥"
        />
        <KpiCard
          label="Complétude ≥ 90%"
          value={fmtInt(kpi.complete)}
          sub={`${fmtPct(
            kpi.totalMonitors ? (kpi.complete * 100) / kpi.totalMonitors : null
          )} du total`}
          tone="good"
          icon="✅"
        />
        <KpiCard
          label="70–89%"
          value={fmtInt(kpi.warn)}
          tone={kpi.warn ? "warn" : "neutral"}
          icon="⚠️"
        />
        <KpiCard
          label="< 70%"
          value={fmtInt(kpi.critical)}
          tone={kpi.critical ? "bad" : "neutral"}
          icon="🔴"
        />
      </Grid>

      <div className="mb-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader
            title="Top 15 — meilleure complétude"
            subtitle="% vs cible journalière (ménages + HM)"
          />
          {top.length ? (
            <ThresholdBar
              categories={top.map((r) => r.monitor)}
              values={top.map((r) => +(r.completenessPct ?? 0).toFixed(1))}
              threshold={90}
              thresholdLabel="Seuil 90%"
              higherIsBetter
              height={Math.max(260, top.length * 24 + 80)}
            />
          ) : (
            <EmptyState />
          )}
        </Card>
        <Card>
          <CardHeader
            title="Bottom 15 — complétude la plus faible"
            subtitle="Moniteurs à accompagner en priorité"
          />
          {bottom.length ? (
            <ThresholdBar
              categories={bottom.map((r) => r.monitor)}
              values={bottom.map((r) => +(r.completenessPct ?? 0).toFixed(1))}
              threshold={90}
              thresholdLabel="Seuil 90%"
              higherIsBetter
              height={Math.max(260, bottom.length * 24 + 80)}
            />
          ) : (
            <EmptyState />
          )}
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader
          title="Moyenne journalière Ménage vs Hors-ménage par profil"
          subtitle={
            filters.monitoringType === "EndProcess"
              ? "Cibles (end process) : IM = 3 ménages / 2 HM · Autres = aucune (in process uniquement)"
              : "Cibles (in process) : 3 form. ménages / 2 form. HM par jour (tous profils)"
          }
        />
        {avgByProfile.length ? (
          <BarStacked
            categories={avgByProfile.map((p) => `${p.profile} (${p.n})`)}
            series={[
              {
                name: "Moy. ménages/jour",
                data: avgByProfile.map((p) => +p.avgHH.toFixed(2)),
                color: "#0093d5",
              },
              {
                name: "Moy. HM/jour",
                data: avgByProfile.map((p) => +p.avgOH.toFixed(2)),
                color: "#f29e0b",
              },
            ]}
            stack={false}
          />
        ) : (
          <EmptyState />
        )}
      </Card>

      <Card>
        <CardHeader
          title="Indicateurs détaillés par moniteur"
          subtitle={`${rows.length} moniteurs affichés`}
        />
        {rows.length ? (
          <RankingTable
            rows={rows}
            pageSize={20}
            defaultSort={{ key: "completenessPct", dir: "asc" }}
            columns={[
              {
                key: "monitor",
                label: "Moniteur",
                render: (r) => r.monitor,
                sortBy: (r) => r.monitor,
              },
              {
                key: "profile",
                label: "Profil",
                render: (r) => r.profile ?? "—",
                sortBy: (r) => r.profile ?? "",
              },
              {
                key: "zs",
                label: "ZS",
                render: (r) => r.zs ?? "—",
                sortBy: (r) => r.zs ?? "",
              },
              {
                key: "submissionsHousehold",
                label: "Ménage",
                align: "right",
                render: (r) => fmtInt(r.submissionsHousehold),
                sortBy: (r) => r.submissionsHousehold,
              },
              {
                key: "submissionsOutside",
                label: "HM",
                align: "right",
                render: (r) => fmtInt(r.submissionsOutside),
                sortBy: (r) => r.submissionsOutside,
              },
              {
                key: "daysActive",
                label: "Jours",
                align: "right",
                render: (r) => fmtInt(r.daysActive),
                sortBy: (r) => r.daysActive,
              },
              {
                key: "averageHouseholdPerDay",
                label: "Moy.M/j",
                align: "right",
                render: (r) =>
                  `${r.averageHouseholdPerDay.toFixed(1)} / ${
                    r.expectedHouseholdPerDay ?? "—"
                  }`,
                sortBy: (r) => r.averageHouseholdPerDay,
              },
              {
                key: "averageOutsidePerDay",
                label: "Moy.HM/j",
                align: "right",
                render: (r) =>
                  `${r.averageOutsidePerDay.toFixed(1)} / ${
                    r.expectedOutsidePerDay ?? "—"
                  }`,
                sortBy: (r) => r.averageOutsidePerDay,
              },
              {
                key: "completenessPct",
                label: "Complétude",
                align: "right",
                render: (r) => (
                  <span
                    className={riskChip(
                      r.completenessPct === null
                        ? "UNKNOWN"
                        : r.completenessPct >= 90
                        ? "GREEN_GE_95"
                        : r.completenessPct >= 70
                        ? "YELLOW_90_94"
                        : "RED_LT_90"
                    )}
                  >
                    {fmtPct(r.completenessPct)}
                  </span>
                ),
                sortBy: (r) => r.completenessPct,
              },
              {
                key: "firstDate",
                label: "1ère / Dernière",
                render: (r) =>
                  `${fmtDateShort(r.firstDate)} → ${fmtDateShort(r.lastDate)}`,
                sortBy: (r) => r.firstDate ?? "",
              },
            ]}
          />
        ) : (
          <EmptyState />
        )}
      </Card>
    </>
  );
}
