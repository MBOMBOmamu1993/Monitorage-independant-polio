"use client";

import { useEffect, useRef } from "react";
import type { LatLngExpression } from "leaflet";

export interface MapPoint {
  lat: number;
  lng: number;
  title?: string;
  tooltip?: string;
  label?: string;
  tone?: "good" | "warn" | "bad" | "info";
  weight?: number;
  /** true → entoure d'un cercle rouge avec label visible */
  highlight?: boolean;
}

/**
 * Carte opérationnelle Leaflet avec fond satellite Google Maps,
 * clustering de marqueurs, couche heatmap optionnelle, auto-fit zoom,
 * et cercles rouges labellés pour les localités à risque.
 * Fallbacks : Esri World Imagery et OpenStreetMap.
 */
export default function LeafletMap({
  points,
  height = 520,
  mode = "cluster",
  center = [-4.0383, 21.7587],
  zoom = 5,
}: {
  points: MapPoint[];
  height?: number;
  mode?: "cluster" | "heat";
  center?: LatLngExpression;
  zoom?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").Layer | null>(null);
  const highlightLayerRef = useRef<import("leaflet").Layer | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!ref.current || mapRef.current) return;
      const L = (await import("leaflet")).default;
      await import("leaflet.markercluster");
      await import("leaflet.heat");
      if (cancelled) return;

      const map = L.map(ref.current, {
        center,
        zoom,
        zoomControl: true,
        preferCanvas: true,
        maxZoom: 22,
      });
      mapRef.current = map;

      // Google Maps satellite : meilleure résolution mondiale, zones rurales incluses
      const googleSat = L.tileLayer(
        "https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
        {
          attribution: "© Google",
          subdomains: ["0", "1", "2", "3"],
          maxNativeZoom: 20,
          maxZoom: 22,
        }
      ).addTo(map);

      // Esri World Imagery : fallback si Google indisponible
      const esriSat = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "Esri, Maxar, Earthstar Geographics",
          maxNativeZoom: 18,
          maxZoom: 22,
        }
      );

      const labels = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
        {
          attribution: "© OpenStreetMap, © CARTO",
          opacity: 0.85,
          maxNativeZoom: 19,
          maxZoom: 22,
        }
      ).addTo(map);

      const osm = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { maxZoom: 22, maxNativeZoom: 19, attribution: "© OpenStreetMap" }
      );

      // Netteé + éclaircissement des tuiles satellite via CSS
      const style = document.createElement("style");
      style.textContent = `
        .leaflet-tile-pane img {
          image-rendering: optimizeQuality;
          filter: contrast(1.1) brightness(1.07) saturate(1.06);
        }
      `;
      document.head.appendChild(style);

      L.control
        .layers(
          { "Google Satellite": googleSat, "Esri Satellite": esriSat, OpenStreetMap: osm },
          { "Étiquettes lieux": labels }
        )
        .addTo(map);
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [center, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    async function render() {
      const L = (await import("leaflet")).default;
      await import("leaflet.markercluster");
      await import("leaflet.heat");
      if (cancelled || !map) return;

      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      if (highlightLayerRef.current) {
        map.removeLayer(highlightLayerRef.current);
        highlightLayerRef.current = null;
      }

      if (!points.length) return;

      if (mode === "heat") {
        const heat = (L as unknown as {
          heatLayer: (
            latlngs: Array<[number, number, number?]>,
            options?: Record<string, unknown>
          ) => import("leaflet").Layer;
        }).heatLayer(
          points.map((p) => [p.lat, p.lng, Math.max(1, p.weight ?? 1)]),
          { radius: 24, blur: 20, maxZoom: 14 }
        );
        heat.addTo(map);
        layerRef.current = heat;
      } else {
        const cluster = (
          L as unknown as {
            markerClusterGroup: (opts?: unknown) => import("leaflet").Layer;
          }
        ).markerClusterGroup({
          chunkedLoading: true,
          disableClusteringAtZoom: 16,
          spiderfyOnMaxZoom: true,
          maxClusterRadius: 45,
        });
        for (const p of points) {
          const color =
            p.tone === "bad"
              ? "#e23636"
              : p.tone === "warn"
              ? "#f29e0b"
              : p.tone === "good"
              ? "#22b457"
              : "#0093d5";
          const marker = L.circleMarker([p.lat, p.lng], {
            radius: 5 + Math.min(6, Math.log2((p.weight ?? 1) + 1)),
            color,
            fillColor: color,
            fillOpacity: 0.85,
            weight: 1,
          });
          if (p.tooltip) marker.bindTooltip(p.tooltip, { sticky: true });
          if (p.title) marker.bindPopup(p.title);
          (cluster as unknown as { addLayer: (l: unknown) => void }).addLayer(marker);
        }
        (cluster as unknown as { addTo: (m: import("leaflet").Map) => void }).addTo(map);
        layerRef.current = cluster;
      }

      // Cercles rouges labellés (overlay indépendant du mode)
      const highlights = points.filter((p) => p.highlight);
      if (highlights.length) {
        const group = L.layerGroup();
        for (const p of highlights) {
          const circle = L.circle([p.lat, p.lng], {
            radius: 250,
            color: "#dc2626",
            weight: 2,
            fillColor: "#dc2626",
            fillOpacity: 0.15,
          });
          if (p.label) {
            circle.bindTooltip(p.label, {
              permanent: true,
              direction: "top",
              className: "rr-polio-label",
              offset: [0, -6],
            });
          }
          group.addLayer(circle);
        }
        group.addTo(map);
        highlightLayerRef.current = group;
      }

      // Auto-fit bounds pour zoomer sur les maisons
      const latlngs = points.map((p) => [p.lat, p.lng] as [number, number]);
      if (latlngs.length > 0) {
        const bounds = L.latLngBounds(latlngs);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [28, 28], maxZoom: 19 });
        }
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [points, mode]);

  return <div ref={ref} style={{ height, width: "100%" }} className="rounded-xl" />;
}
