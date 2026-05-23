/**
 * Cache mémoire LRU des bundles analytics, keyé par :
 *   (data fingerprint) :: (filter signature)
 *
 * Le `fingerprint` est dérivé des résultats `OdkFetchResult` (count + fetchedAt
 * de chaque formulaire) — il change automatiquement dès que les données ODK
 * sous-jacentes sont rafraîchies, ce qui invalide naturellement les bundles
 * cachés sur l'ancien dataset.
 *
 * La `signature` sérialise tous les filtres dimensionnels (12 champs) de façon
 * déterministe — un même `(data, filtres)` donne toujours la même clé.
 *
 * TTL court (5 min) + cap 30 entrées : on couvre les "aller-retours" de filtre
 * que les utilisateurs font fréquemment, sans fuite mémoire.
 *
 * Invalidation explicite via `clearAnalyticsCache()` lorsque la donnée brute
 * est purgée (markCacheStale / flushCache appelés depuis /api/refresh).
 */
import type { AnalyticsBundle } from "@/lib/types/domain";
import type { OdkFetchResult, OdkSubmissionBase } from "@/lib/types/odk";
import type { BuildOptions } from "@/lib/etl/pipeline";

interface Entry {
  bundle: AnalyticsBundle;
  expiresAt: number;
}

const TTL_MS = Number(process.env.ANALYTICS_CACHE_TTL_SECONDS ?? "300") * 1000;
const MAX_ENTRIES = Number(process.env.ANALYTICS_CACHE_MAX_ENTRIES ?? "30");

// Map ordonnée → on s'en sert comme LRU : à chaque hit, on supprime puis ré-insère
// la clé pour qu'elle devienne la plus récente. L'éviction supprime la plus
// ancienne (premier élément) lorsque la taille dépasse MAX_ENTRIES.
const cache = new Map<string, Entry>();

export function makeFingerprint(
  hh: OdkFetchResult<OdkSubmissionBase>,
  osh: OdkFetchResult<OdkSubmissionBase>
): string {
  return `hh:${hh.count}@${hh.fetchedAt}|os:${osh.count}@${osh.fetchedAt}`;
}

export function makeSignature(opts: BuildOptions): string {
  // Ordre figé pour que la sérialisation reste stable. On normalise les
  // valeurs falsy à la chaîne vide, et "all" pour les enums tri-valeur, afin
  // que les variations équivalentes (null vs undefined vs "") produisent la
  // MÊME clé.
  return [
    opts.restrictToCampaignProvinces ? "1" : "0",
    opts.minDate ?? "",
    opts.maxDate ?? "",
    opts.province ?? "",
    opts.antenne ?? "",
    opts.zs ?? "",
    opts.as ?? "",
    opts.locality ?? "",
    opts.monitoringType ?? "all",
    opts.monitorProfile ?? "",
    opts.monitor ?? "",
    opts.context ?? "all",
  ].join("|");
}

function makeKey(fingerprint: string, signature: string): string {
  return `${fingerprint}::${signature}`;
}

export function getCachedBundle(
  fingerprint: string,
  signature: string
): AnalyticsBundle | null {
  const key = makeKey(fingerprint, signature);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  // LRU touch : ré-insertion en queue.
  cache.delete(key);
  cache.set(key, entry);
  return entry.bundle;
}

export function setCachedBundle(
  fingerprint: string,
  signature: string,
  bundle: AnalyticsBundle
): void {
  const key = makeKey(fingerprint, signature);
  if (cache.has(key)) cache.delete(key);
  cache.set(key, { bundle, expiresAt: Date.now() + TTL_MS });
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/**
 * Invalide tous les bundles cachés. Appelé depuis odk-client lors d'un
 * refresh de la donnée source (markCacheStale / flushCache).
 */
export function clearAnalyticsCache(): void {
  cache.clear();
}

export function analyticsCacheStats(): { size: number; ttlMs: number; max: number } {
  return { size: cache.size, ttlMs: TTL_MS, max: MAX_ENTRIES };
}
