/**
 * Hooks SWR pour consommer /api/analytics et /api/odk/*.
 *
 * Architecture (avril 2026) :
 *  - L'URL n'inclut que les dimensions qui réduisent matériellement le
 *    bundle (restrict + dates + province) : 1 fetch par changement de
 *    province ou de période. Le serveur retourne la FactTable filtrée
 *    pour cette province.
 *  - Tous les autres filtres (antenne/ZS/AS/locality/type/profil/moniteur/
 *    contexte) sont appliqués côté client via `deriveFilteredBundle` et
 *    `derivePerformance` à partir de la FactTable → filtrage instantané,
 *    pas de re-fetch HTTP.
 */
"use client";

import { useEffect, useMemo, useRef } from "react";
import useSWR, { preload } from "swr";
import type { AnalyticsBundle } from "@/lib/types/domain";
import { useFilters, filtersToQuery, type FiltersState } from "@/lib/state/filters";
import { CAMPAIGN_PROVINCES } from "@/config/provinces";
import { deriveFilteredBundle } from "./derive-filtered-bundle";
import { derivePerformance } from "./derive-performance";

const fetcher = async (url: string): Promise<AnalyticsBundle & { error?: string }> => {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} – ${text.slice(0, 200)}`);
  }
  return res.json();
};

export function useAnalytics() {
  const filters = useFilters();
  const url = `/api/analytics${filtersToQuery(filters)}`;

  const { data: rawData, error, isValidating, mutate } = useSWR(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      revalidateOnReconnect: false,
      dedupingInterval: 600_000,
      errorRetryInterval: 5000,
      errorRetryCount: 3,
      keepPreviousData: true,
      refreshInterval: 0,
    }
  );

  // Vrai pendant qu'on attend le bundle d'une nouvelle province mais qu'on
  // dispose encore de l'ancien bundle (keepPreviousData). Permet d'afficher
  // une barre de progression sans vider le dashboard.
  const isProvinceSwitching = useMemo(() => {
    if (!isValidating || !rawData?.factTable?.length) return false;
    return !!filters.province && rawData.factTable[0].p !== filters.province;
  }, [isValidating, rawData, filters.province]);

  // Prefetch en arrière-plan des 10 autres provinces une fois le bundle
  // initial chargé. Les bundles statiques étant servis depuis le CDN Vercel
  // en <100ms, on peut les charger tous en quelques secondes. Le switch de
  // province devient alors purement client-side (lecture cache SWR + dérive
  // factTable) — instantané, sans aller-retour réseau.
  const prefetchedRef = useRef(false);
  useEffect(() => {
    if (!rawData || prefetchedRef.current) return;
    prefetchedRef.current = true;

    const restrictParam = filters.restrictToCampaign ? "1" : "0";
    const others = CAMPAIGN_PROVINCES.filter((p) => p !== filters.province);
    let cancelled = false;

    // Préchargement échelonné (800ms entre chaque) pour éviter de saturer
    // la bande passante et laisser respirer le rendu initial.
    const schedule = (idx: number) => {
      if (cancelled || idx >= others.length) return;
      const province = others[idx];
      const otherUrl = `/api/analytics?restrict=${restrictParam}&province=${encodeURIComponent(
        province
      )}`;
      preload(otherUrl, fetcher).catch(() => {
        // Silencieux : un échec de prefetch ne bloque rien.
      });
      setTimeout(() => schedule(idx + 1), 800);
    };

    // Démarrer 1.5s après le chargement initial pour ne pas concurrencer
    // le rendu et l'hydratation des graphiques de la première province.
    const timer = setTimeout(() => schedule(0), 1500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [rawData, filters.province, filters.restrictToCampaign]);

  // Filtrage client-side via la FactTable. On reconstruit le bundle filtré
  // (KPI, agrégats, raisons par niveau, etc.) à partir des lignes qui
  // matchent l'état courant des filtres non-géo (antenne/ZS/AS/locality/
  // type/profil/moniteur/contexte). La province est déjà appliquée
  // serveur-side — on ne la re-filtre PAS ici.
  //
  // Quand keepPreviousData sert l'ancien bundle (province différente), on
  // dérive quand même les données stales plutôt que de retourner undefined :
  // le dashboard reste visible avec les valeurs précédentes pendant le fetch.
  const data = useMemo<AnalyticsBundle | undefined>(() => {
    if (!rawData) return undefined;
    const ft = rawData.factTable;
    if (!ft || ft.length === 0) return rawData;

    const clientFilters = { ...filters, province: null } as FiltersState;
    const filteredBundle = deriveFilteredBundle(rawData, clientFilters);
    const performance = derivePerformance(ft, clientFilters);
    return { ...filteredBundle, performance };
  }, [rawData, filters]);

  return {
    data,
    error,
    // isLoading vrai uniquement au tout premier chargement (aucun rawData).
    // Pendant un switch de province, isProvinceSwitching est vrai à la place.
    isLoading: isValidating && !rawData,
    isProvinceSwitching,
    refresh: mutate,
    hasData: !!data,
  };
}

export async function triggerRefresh(): Promise<void> {
  await fetch("/api/refresh", { method: "POST" });
}
