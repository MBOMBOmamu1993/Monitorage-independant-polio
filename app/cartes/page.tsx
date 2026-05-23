"use client";

import { useMemo, useState } from "react";
import { useAnalytics } from "@/lib/client/api";
import { useFilters } from "@/lib/state/filters";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import MapClient from "@/components/map/MapClient";
import ChoroplethClient from "@/components/map/ChoroplethClient";
import type { MapPoint } from "@/components/map/LeafletMap";

type Tab = "satellite" | "choro-polio-m" | "choro-polio-hm";
type Mode = "cluster" | "heat";
// Note : seul "hotspots" reste disponible sur l'onglet satellite — les overlays
// par soumission (submissions/nonVax/refus/absent) nécessitaient les coords GPS
// individuelles, retirées de l'API pour respecter la limite Vercel 4.5 MB.
type Overlay = "hotspots";

const PROVINCE_TOPO =
  "https://gist.githubusercontent.com/MBOMBOmamu1993/8248c56c7a4db86f651a44e29dee282c/raw/RDC_Provinces_name.topo.json";
const ZS_TOPO =
  "https://gist.githubusercontent.com/MBOMBOmamu1993/1297c206c046ee018d5ed6c392d6c20f/raw/rdc_zs.topojson";

const COVERAGE_BREAKPOINTS = [
  { at: 95, color: "#178a44", label: "≥ 95 %" },
  { at: 90, color: "#a3d34c", label: "90–94 %" },
  { at: 80, color: "#f29e0b", label: "80–89 %" },
  { at: 50, color: "#ef4444", label: "50–79 %" },
  { at: 0, color: "#991b1b", label: "< 50 %" },
];

export default function CartesPage() {
  const { data, isLoading, error, hasData } = useAnalytics();
  const f = useFilters();
  const [tab, setTab] = useState<Tab>("satellite");
  const [choroGeo, setChoroGeo] = useState<"province" | "zs">("province");
  const [mode, setMode] = useState<Mode>("cluster");
  const overlay: Overlay = "hotspots";
  const hasError = !!error;

  if (isLoading || !data) return <LoadingState />;

  // Centroïde GPS par localité avec enfants Polio non-vaccinés.
  // Pré-calculé côté serveur — voir lib/etl/pipeline.precomputeMapPoints.
  const points: MapPoint[] = (data.precomputed.mapPoints ?? []).map((p) => {
    return {
      lat: p.lat,
      lng: p.lng,
      tone: "bad" as const,
      weight: p.nonVaxPolio,
      label: p.locality,
      tooltip: `<b>${p.locality}</b><br/>Non-vaccinés Polio: ${p.nonVaxPolio}`,
      title: `<b>${p.locality}</b><br/>Non-vaccinés Polio: ${p.nonVaxPolio}`,
    };
  });

  const aggSource =
    choroGeo === "province"
      ? data.aggregates.byProvince
      : data.aggregates.byZs;

  const polioHHChoroData = aggSource
    .filter((a) => a.polioCoverageHouseholdPct !== null)
    .map((a) => ({
      key:
        choroGeo === "province"
          ? a.orgUnit.province
          : a.orgUnit.zs ?? "",
      value: a.polioCoverageHouseholdPct,
    }));

  const polioOHChoroData = aggSource
    .filter((a) => a.polioCoverageOutsidePct !== null)
    .map((a) => ({
      key:
        choroGeo === "province"
          ? a.orgUnit.province
          : a.orgUnit.zs ?? "",
      value: a.polioCoverageOutsidePct,
    }));

  const tabs: { id: Tab; label: string }[] = [
    { id: "satellite", label: "🛰️ Satellite" },
    { id: "choro-polio-m", label: "💧 Choropleth Polio (M)" },
    { id: "choro-polio-hm", label: "💧 Choropleth Polio (HM)" },
  ];

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
        title="Cartographie opérationnelle"
        subtitle="Google Satellite · Choropleths TopoJSON (Province / Zone de Santé)"
        right={
          tab === "satellite" ? (
            <div className="flex gap-2">
              <select
                className="input"
                value={mode}
                onChange={(e) => setMode(e.target.value as Mode)}
              >
                <option value="cluster">Cluster</option>
                <option value="heat">Heatmap</option>
              </select>
            </div>
          ) : (
            <select
              className="input"
              value={choroGeo}
              onChange={(e) =>
                setChoroGeo(e.target.value as "province" | "zs")
              }
            >
              <option value="province">Par Province</option>
              <option value="zs">Par Zone de Santé</option>
            </select>
          )
        }
      />

      <div className="flex gap-1 mb-3 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              "px-3 py-1.5 rounded-md text-sm font-medium transition " +
              (tab === t.id
                ? "bg-oms-600 text-white shadow-sm"
                : "bg-white border border-surface-200 text-surface-700 hover:bg-surface-50")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "satellite" ? (
        <Card>
          <CardHeader
            title="Localités avec enfants non-vaccinés"
            subtitle={`${points.length} localités · Survolez un point pour voir le Polio · Zoom satellite jusqu'aux ménages`}
          />
          {points.length ? (
            <MapClient points={points} mode={mode} height={620} />
          ) : (
            <EmptyState hint="Aucune coordonnée GPS exploitable dans la vue filtrée." />
          )}
        </Card>
      ) : tab === "choro-polio-m" ? (
        <Card>
          <CardHeader
            title={`Couverture Polio Ménage par ${
              choroGeo === "province" ? "province" : "ZS"
            }`}
            subtitle="Seuil opérationnel : 95% · enfants 0–59 mois à domicile"
          />
          <ChoroplethClient
            url={choroGeo === "province" ? PROVINCE_TOPO : ZS_TOPO}
            topojsonObject={
              choroGeo === "province" ? "gadm41_COD_1" : "Zone de SantéRDC"
            }
            keyProperties={
              choroGeo === "province"
                ? ["NAME_1", "name", "PROVINCE"]
                : ["Nom", "NOM", "name", "ZS", "zs"]
            }
            data={polioHHChoroData}
            breakpoints={COVERAGE_BREAKPOINTS}
            legendTitle="Couverture Polio M"
            unit="%"
            height={620}
          />
        </Card>
      ) : (
        <Card>
          <CardHeader
            title={`Couverture Polio Hors-ménage par ${
              choroGeo === "province" ? "province" : "ZS"
            }`}
            subtitle="Enfants rencontrés hors-ménage (écoles, marchés, transit)"
          />
          <ChoroplethClient
            url={choroGeo === "province" ? PROVINCE_TOPO : ZS_TOPO}
            topojsonObject={
              choroGeo === "province" ? "gadm41_COD_1" : "Zone de SantéRDC"
            }
            keyProperties={
              choroGeo === "province"
                ? ["NAME_1", "name", "PROVINCE"]
                : ["Nom", "NOM", "name", "ZS", "zs"]
            }
            data={polioOHChoroData}
            breakpoints={COVERAGE_BREAKPOINTS}
            legendTitle="Couverture Polio HM"
            unit="%"
            height={620}
          />
        </Card>
      )}
    </>
  );
}
