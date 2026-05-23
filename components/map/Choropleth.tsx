"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LatLngExpression } from "leaflet";

export interface ChoroplethDatum {
  /** Clé à matcher avec une propriété du feature (ex. nom province / ZS) */
  key: string;
  value: number | null;
  label?: string;
}

export interface ChoroplethProps {
  /** URL d'un TopoJSON (auto-détecte l'objet) ou d'un GeoJSON FeatureCollection */
  url: string;
  /** Nom de l'objet topojson à convertir (ex. "gadm41_COD_1"). Optionnel. */
  topojsonObject?: string;
  /** Propriétés candidats pour la clé de jointure. Premier non-null gagne. */
  keyProperties: string[];
  /** Données à projeter (key → value). */
  data: ChoroplethDatum[];
  /** Palette : breakpoints décroissants (ex. [95, 90, 80, 50]) + couleurs associées. */
  breakpoints: { at: number; color: string; label: string }[];
  /** Valeur manquante → couleur. */
  missingColor?: string;
  /** Titre de la légende. */
  legendTitle?: string;
  /** Suffixe d'unité (ex. "%"). */
  unit?: string;
  height?: number;
  center?: LatLngExpression;
  zoom?: number;
}

type Feature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: unknown;
};

function normKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[-_/\\.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function colorFor(
  v: number | null,
  breaks: { at: number; color: string }[],
  missing: string
): string {
  if (v === null || !Number.isFinite(v)) return missing;
  for (const b of breaks) {
    if (v >= b.at) return b.color;
  }
  return breaks[breaks.length - 1]?.color ?? missing;
}

export default function Choropleth({
  url,
  topojsonObject,
  keyProperties,
  data,
  breakpoints,
  missingColor = "#d4d4d8",
  legendTitle = "Couverture",
  unit = "%",
  height = 560,
  center = [-4.0383, 21.7587],
  zoom = 5,
}: ChoroplethProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").GeoJSON | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dataIndex = useMemo(() => {
    const m = new Map<string, ChoroplethDatum>();
    for (const d of data) m.set(normKey(d.key), d);
    return m;
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!ref.current || mapRef.current) return;
      const L = (await import("leaflet")).default;
      if (cancelled) return;

      const map = L.map(ref.current, { center, zoom, zoomControl: true });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      const legend = new L.Control({ position: "bottomright" });
      legend.onAdd = () => {
        const div = L.DomUtil.create("div", "choropleth-legend");
        div.innerHTML =
          `<div style="font-weight:600;margin-bottom:4px">${legendTitle}</div>` +
          breakpoints
            .map(
              (b) =>
                `<div><span class="swatch" style="background:${b.color}"></span>${b.label}</div>`
            )
            .join("") +
          `<div><span class="swatch" style="background:${missingColor}"></span>Aucune donnée</div>`;
        return div;
      };
      legend.addTo(map);
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [center, zoom, breakpoints, legendTitle, missingColor]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    async function draw() {
      const L = (await import("leaflet")).default;
      setError(null);
      if (cancelled || !map) return;

      let featureCollection: { type: "FeatureCollection"; features: Feature[] } | null = null;
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const raw = await resp.json();

        if (raw?.type === "Topology") {
          const topojson = await import("topojson-client");
          const objects = raw.objects as Record<string, unknown>;
          const objName =
            topojsonObject && objects[topojsonObject]
              ? topojsonObject
              : Object.keys(objects)[0];
          const fc = topojson.feature(
            raw,
            objects[objName] as unknown as never
          ) as unknown as { type: "FeatureCollection"; features: Feature[] };
          featureCollection = fc;
        } else if (raw?.type === "FeatureCollection") {
          featureCollection = raw;
        } else {
          throw new Error("Format GeoJSON/TopoJSON inconnu");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return;
      }

      if (!featureCollection) return;

      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }

      const layer = L.geoJSON(
        featureCollection as unknown as GeoJSON.GeoJsonObject,
        {
          style: (feat) => {
            const props = (feat?.properties ?? {}) as Record<string, unknown>;
            let keyVal: string | null = null;
            for (const k of keyProperties) {
              const v = props[k];
              if (typeof v === "string" && v.trim()) {
                keyVal = v;
                break;
              }
            }
            const d = keyVal ? dataIndex.get(normKey(keyVal)) : undefined;
            const fillColor = colorFor(
              d?.value ?? null,
              breakpoints,
              missingColor
            );
            return {
              fillColor,
              fillOpacity: 0.75,
              color: "#374151",
              weight: 0.7,
            };
          },
          onEachFeature: (feat, lyr) => {
            const props = (feat.properties ?? {}) as Record<string, unknown>;
            let keyVal: string | null = null;
            for (const k of keyProperties) {
              const v = props[k];
              if (typeof v === "string" && v.trim()) {
                keyVal = v;
                break;
              }
            }
            const d = keyVal ? dataIndex.get(normKey(keyVal)) : undefined;
            const displayVal =
              d?.value === null || d?.value === undefined
                ? "—"
                : `${d.value.toFixed(1)}${unit}`;
            lyr.bindTooltip(
              `<div style="font-weight:600">${keyVal ?? "?"}</div>` +
                `<div>${legendTitle} : ${displayVal}</div>`,
              { sticky: true }
            );
          },
        }
      ).addTo(map);
      layerRef.current = layer;

      try {
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [16, 16] });
        }
      } catch {
        /* ignore */
      }
    }
    draw();
    return () => {
      cancelled = true;
    };
  }, [url, topojsonObject, keyProperties, dataIndex, breakpoints, missingColor, legendTitle, unit]);

  return (
    <div>
      {error ? (
        <div className="text-xs text-danger-600 mb-2">
          Carte indisponible : {error}
        </div>
      ) : null}
      <div
        ref={ref}
        style={{ height, width: "100%" }}
        className="rounded-xl"
      />
    </div>
  );
}
