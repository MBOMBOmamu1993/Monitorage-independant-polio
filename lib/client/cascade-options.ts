/**
 * Cascade dynamique des filtres à partir de la FactTable.
 *
 * Pour chaque filtre, on calcule les valeurs valides en appliquant
 * TOUS les autres filtres actifs — ainsi, choisir Province=KENGE +
 * Contexte=Ménage ne montre dans le dropdown "Moniteur" que les
 * moniteurs qui ont bien fait des visites ménage à KENGE.
 *
 * Cela remplace la pré-computation statique côté serveur pour les
 * filtres transversaux (type, profil, moniteur, contexte) et
 * complète la cascade géographique avec la prise en compte des
 * filtres non-géographiques.
 */
"use client";

import { useDeferredValue, useMemo } from "react";
import type { FactRow } from "@/lib/types/domain";
import type { FiltersState } from "@/lib/state/filters";

// ─── Helpers de matching par groupe ──────────────────────────────────────────

function matchGeo(r: FactRow, f: FiltersState): boolean {
  if (f.province && r.p !== f.province) return false;
  if (f.antenne && r.a !== f.antenne) return false;
  if (f.zs && r.z !== f.zs) return false;
  if (f.as && r.as !== f.as) return false;
  if (f.locality && r.l !== f.locality) return false;
  return true;
}

function matchDate(r: FactRow, f: FiltersState): boolean {
  if (f.minDate && r.d < f.minDate) return false;
  if (f.maxDate && r.d > f.maxDate) return false;
  return true;
}

function matchCtx(r: FactRow, f: FiltersState): boolean {
  if (f.context === "all") return true;
  return r.c === (f.context === "households" ? "Household" : "Outside");
}

function matchType(r: FactRow, f: FiltersState): boolean {
  if (f.monitoringType === "all") return true;
  return r.t === f.monitoringType;
}

function matchProfile(r: FactRow, f: FiltersState): boolean {
  if (!f.monitorProfile) return true;
  return r.pr === f.monitorProfile;
}

function matchMonitor(r: FactRow, f: FiltersState): boolean {
  if (!f.monitor) return true;
  return r.m === f.monitor;
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export interface CascadeOptions {
  /** Contextes disponibles (ménage/hors-ménage) — sans le filtre contexte, avec tous les autres. */
  contexts: Set<string>;
  /** Types de monitorage disponibles — sans le filtre type, avec tous les autres. */
  types: Set<string>;
  /** Profils disponibles — sans le filtre profil, avec tous les autres. */
  profiles: Set<string>;
  /** Moniteurs disponibles — sans le filtre moniteur, avec tous les autres. */
  monitors: Set<string>;
  /** Provinces disponibles — sans le filtre province, avec tous les autres. */
  provinces: Set<string>;
  /** Antennes disponibles — sans le filtre antenne, avec tous les autres. */
  antennes: Set<string>;
  /** ZS disponibles — sans le filtre ZS, avec tous les autres. */
  zs: Set<string>;
  /** AS disponibles — sans le filtre AS, avec tous les autres. */
  as: Set<string>;
  /** Localités disponibles — sans le filtre localité, avec tous les autres. */
  localities: Set<string>;
}

function noFiltersActive(f: FiltersState): boolean {
  return (
    !f.province &&
    !f.antenne &&
    !f.zs &&
    !f.as &&
    !f.locality &&
    !f.minDate &&
    !f.maxDate &&
    f.context === "all" &&
    f.monitoringType === "all" &&
    !f.monitorProfile &&
    !f.monitor
  );
}

/**
 * Cache "toutes options" calculé une seule fois par FactTable. Permet de
 * retourner immédiatement la cascade complète quand aucun filtre n'est
 * actif (cas typique : clic sur Réinitialiser).
 */
function computeAllOptions(factTable: FactRow[]): CascadeOptions {
  const contexts = new Set<string>();
  const types = new Set<string>();
  const profiles = new Set<string>();
  const monitors = new Set<string>();
  const provinces = new Set<string>();
  const antennes = new Set<string>();
  const zsList = new Set<string>();
  const asList = new Set<string>();
  const localities = new Set<string>();

  for (const r of factTable) {
    contexts.add(r.c === "Household" ? "households" : "outside");
    types.add(r.t);
    if (r.pr) profiles.add(r.pr);
    if (r.m) monitors.add(r.m);
    provinces.add(r.p);
    if (r.a) antennes.add(r.a);
    if (r.z) zsList.add(r.z);
    if (r.as) asList.add(r.as);
    if (r.l) localities.add(r.l);
  }

  return { contexts, types, profiles, monitors, provinces, antennes, zs: zsList, as: asList, localities };
}

export function useCascadeOptions(
  factTable: FactRow[] | undefined,
  f: FiltersState,
): CascadeOptions | null {
  // Cache "toutes options" indépendant des filtres : recalculé seulement
  // si la FactTable change (donc 1×/page de chargement).
  const allOptions = useMemo(
    () => (factTable && factTable.length > 0 ? computeAllOptions(factTable) : null),
    [factTable],
  );

  // useDeferredValue : laisse React peindre l'UI avec les nouveaux filtres
  // AVANT de recalculer la cascade. Le clic sur Réinitialiser apparaît
  // instantané ; le rescan de la FactTable se fait dans un rendu différé.
  const fDeferred = useDeferredValue(f);

  return useMemo(() => {
    if (!factTable || factTable.length === 0) return null;

    // Fast path : aucun filtre actif → retour direct du cache.
    if (noFiltersActive(fDeferred)) return allOptions;

    const contexts = new Set<string>();
    const types = new Set<string>();
    const profiles = new Set<string>();
    const monitors = new Set<string>();
    const provinces = new Set<string>();
    const antennes = new Set<string>();
    const zsList = new Set<string>();
    const asList = new Set<string>();
    const localities = new Set<string>();

    for (const r of factTable) {
      const geo = matchGeo(r, fDeferred);
      const date = matchDate(r, fDeferred);
      const ctx = matchCtx(r, fDeferred);
      const type = matchType(r, fDeferred);
      const prof = matchProfile(r, fDeferred);
      const mon = matchMonitor(r, fDeferred);

      // Contextes valides : tout sauf le filtre contexte lui-même
      if (geo && date && type && prof && mon) {
        contexts.add(r.c === "Household" ? "households" : "outside");
      }
      // Types valides : tout sauf le filtre type
      if (geo && date && ctx && prof && mon) {
        types.add(r.t);
      }
      // Profils valides : tout sauf le filtre profil
      if (geo && date && ctx && type && mon && r.pr) {
        profiles.add(r.pr);
      }
      // Moniteurs valides : tout sauf le filtre moniteur
      if (geo && date && ctx && type && prof && r.m) {
        monitors.add(r.m);
      }
      // Provinces : tout sauf le filtre province (mais avec antenne/ZS/AS/localité)
      const geoSansProvince =
        (!fDeferred.antenne || r.a === fDeferred.antenne) &&
        (!fDeferred.zs || r.z === fDeferred.zs) &&
        (!fDeferred.as || r.as === fDeferred.as) &&
        (!fDeferred.locality || r.l === fDeferred.locality);
      if (geoSansProvince && date && ctx && type && prof && mon) {
        provinces.add(r.p);
      }
      // Antennes : tout sauf le filtre antenne
      const geoSansAntenne =
        (!fDeferred.province || r.p === fDeferred.province) &&
        (!fDeferred.zs || r.z === fDeferred.zs) &&
        (!fDeferred.as || r.as === fDeferred.as) &&
        (!fDeferred.locality || r.l === fDeferred.locality);
      if (geoSansAntenne && date && ctx && type && prof && mon && r.a) {
        antennes.add(r.a);
      }
      // ZS : tout sauf le filtre ZS
      const geoSansZs =
        (!fDeferred.province || r.p === fDeferred.province) &&
        (!fDeferred.antenne || r.a === fDeferred.antenne) &&
        (!fDeferred.as || r.as === fDeferred.as) &&
        (!fDeferred.locality || r.l === fDeferred.locality);
      if (geoSansZs && date && ctx && type && prof && mon && r.z) {
        zsList.add(r.z);
      }
      // AS : tout sauf le filtre AS
      const geoSansAs =
        (!fDeferred.province || r.p === fDeferred.province) &&
        (!fDeferred.antenne || r.a === fDeferred.antenne) &&
        (!fDeferred.zs || r.z === fDeferred.zs) &&
        (!fDeferred.locality || r.l === fDeferred.locality);
      if (geoSansAs && date && ctx && type && prof && mon && r.as) {
        asList.add(r.as);
      }
      // Localités : tout sauf le filtre localité
      const geoSansLocality =
        (!fDeferred.province || r.p === fDeferred.province) &&
        (!fDeferred.antenne || r.a === fDeferred.antenne) &&
        (!fDeferred.zs || r.z === fDeferred.zs) &&
        (!fDeferred.as || r.as === fDeferred.as);
      if (geoSansLocality && date && ctx && type && prof && mon && r.l) {
        localities.add(r.l);
      }
    }

    return {
      contexts,
      types,
      profiles,
      monitors,
      provinces,
      antennes,
      zs: zsList,
      as: asList,
      localities,
    };
  }, [factTable, fDeferred, allOptions]);
}
