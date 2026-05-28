/**
 * Client ODK — fetch sécurisé avec retry + cache mémoire + pagination.
 *
 * Stratégie hybride backfill + incrémentiel :
 *  1. Les soumissions historiques sont lues depuis /data/backfill/ (filesystem,
 *     zéro réseau) via le module backfill.ts.
 *  2. Seules les soumissions NOUVELLES (postérieures au dernier timestamp backfill)
 *     sont requêtées à l'API ODK — typiquement quelques centaines par heure.
 *  3. Les deux jeux sont fusionnés et dédupliqués par _uuid.
 *
 * Avantages :
 *  - Eliminé le problème HARD_CAP (146k+ records → timeout Vercel).
 *  - Chaque requête ne récupère que quelques pages (< 5s au lieu de 10+ min).
 *  - Le backfill est mis à jour par `npm run backfill:build` (local / CI).
 *
 * N'expose JAMAIS les credentials côté client : toute utilisation de ce
 * module doit se faire dans une route /api/* (runtime Node.js).
 */

import pRetry, { AbortError } from "p-retry";
import { ENV, odkAuthHeader } from "./env";
import { loadBackfillSubmissions, loadBackfillMeta, clearBackfillCache } from "./backfill";
import { clearAnalyticsCache } from "./analytics-cache";
import type { OdkFetchResult, OdkForm, OdkSubmissionBase } from "@/lib/types/odk";

type CacheEntry<T> = { at: number; value: T };

const memCache = new Map<string, CacheEntry<unknown>>();

const PAGE_SIZE = 2000;
// L'API ODK (api.whonghub.org) répond lentement sur les requêtes filtrées +
// triées : 10s ne suffisaient pas et chaque page expirait → /api/analytics 502
// → dashboard vide. On laisse 30s par requête. Avec MAX_ATTEMPTS=2 cela fait
// jusqu'à 60s par page, absorbé par le budget route (150s) et maxDuration (300s).
const PER_REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 2;
// Nombre max de soumissions à récupérer en mode incrémentiel (= nouvelles depuis backfill).
// Dimensionné pour absorber jusqu'à 5h de croissance à pic (~10k/h par formulaire)
// même si le workflow GitHub Actions horaire venait à manquer plusieurs runs.
// 25 pages × ~1.2s = ~30s, sous le budget 45s d'analytics route.
const INCREMENTAL_CAP = 50_000;

function cacheGet<T>(key: string, ttlSec = ENV.CACHE_TTL_SECONDS): T | null {
  const hit = memCache.get(key) as CacheEntry<T> | undefined;
  if (!hit) return null;
  if ((Date.now() - hit.at) / 1000 > ttlSec) return null;
  return hit.value;
}

function cacheGetStale<T>(key: string): CacheEntry<T> | null {
  return (memCache.get(key) as CacheEntry<T> | undefined) ?? null;
}

function cacheSet<T>(key: string, value: T): void {
  memCache.set(key, { at: Date.now(), value });
}

async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "User-Agent": "RR-Polio-Dashboard/0.1",
        ...(init?.headers ?? {}),
        ...odkAuthHeader(),
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error(`[odk] HTTP ${res.status} — ${url}`, txt.slice(0, 300));
      if (res.status === 401 || res.status === 403) {
        throw new AbortError(`ODK ${res.status} ${res.statusText} — ${url}`);
      }
      throw new Error(`ODK ${res.status} ${res.statusText} — ${url} — ${txt.slice(0, 200)}`);
    }

    const text = await res.text();

    if (!text || text.trim() === "") {
      console.error(`[odk] Réponse vide — ${url}`);
      throw new Error(`ODK réponse vide pour ${url}`);
    }

    const trimmed = text.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
      console.error(`[odk] Réponse non-JSON — ${url}`, trimmed.slice(0, 200));
      throw new Error(`ODK réponse non-JSON pour ${url}: ${trimmed.slice(0, 100)}`);
    }

    try {
      return JSON.parse(text) as T;
    } catch (parseErr) {
      console.error(
        `[odk] JSON parse error — ${url}`,
        parseErr,
        `len=${text.length} tail=${text.slice(-120)}`
      );
      throw new Error(
        `JSON invalide de ODK (${text.length} octets): ${
          parseErr instanceof Error ? parseErr.message : String(parseErr)
        }`
      );
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`[odk] Timeout ${PER_REQUEST_TIMEOUT_MS}ms — ${url}`);
      throw new Error(`Timeout après ${PER_REQUEST_TIMEOUT_MS}ms pour ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildPageUrl(
  baseUrl: string,
  query: string,
  start: number,
  limit: number,
  sort?: string
): string {
  const params = new URLSearchParams();
  params.set("query", query);
  params.set("start", String(start));
  params.set("limit", String(limit));
  if (sort) params.set("sort", sort);
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Pagination limitée au cap donné.
 * En mode incrémentiel, on récupère seulement les nouvelles soumissions
 * (quelques pages au maximum), bien en dessous du budget Vercel.
 * En mode "sans backfill", sort=newest-first pour avoir les données récentes.
 */
async function fetchAllPagesLimited(
  baseUrl: string,
  query: string,
  cap: number,
  sort?: string
): Promise<OdkSubmissionBase[]> {
  const all: OdkSubmissionBase[] = [];
  let start = 0;

  while (start < cap) {
    const limit = Math.min(PAGE_SIZE, cap - start);
    const url = buildPageUrl(baseUrl, query, start, limit, sort);
    const page = await pRetry(() => fetchJson<OdkSubmissionBase[]>(url), {
      retries: MAX_ATTEMPTS - 1,
      minTimeout: 800,
      maxTimeout: 2500,
      onFailedAttempt: (err) => {
        console.warn(
          `[odk] page start=${start} tentative ${err.attemptNumber}/${MAX_ATTEMPTS} échouée: ${err.message}`
        );
      },
    });

    if (!Array.isArray(page)) {
      throw new Error(`[odk] Réponse paginée non-tableau à start=${start}`);
    }

    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    start += PAGE_SIZE;
  }

  return all;
}

/**
 * Fusionne les soumissions backfill et fraîches en dédupliquant par _uuid.
 * Les doublons viennent de l'overlap $gte sur le dernier timestamp backfill.
 */
function mergeSubmissions(
  base: OdkSubmissionBase[],
  fresh: OdkSubmissionBase[]
): OdkSubmissionBase[] {
  const seen = new Set<string>();
  const merged: OdkSubmissionBase[] = [];

  for (const s of base) {
    const key = String(s._uuid ?? s._id ?? "");
    if (key && !seen.has(key)) {
      seen.add(key);
      merged.push(s);
    }
  }
  for (const s of fresh) {
    const key = String(s._uuid ?? s._id ?? "");
    if (key && !seen.has(key)) {
      seen.add(key);
      merged.push(s);
    }
  }

  return merged;
}

/**
 * Récupère toutes les soumissions d'un formulaire ODK.
 *
 * Stratégie hybride :
 *  1. Charge les soumissions historiques depuis le backfill (filesystem, rapide).
 *  2. Requête ODK uniquement pour les soumissions NOUVELLES depuis le dernier
 *     timestamp backfill (quelques pages max au lieu de 150+).
 *  3. Fusionne et déduplique.
 *
 * Fallbacks en cascade :
 *  - Cache stale → dernière réponse en mémoire si le fetch ODK échoue.
 *  - Backfill only → si pas de cache et fetch ODK échoue, retourne le backfill seul.
 */
export async function fetchFormSubmissions(
  form: OdkForm,
  opts: { force?: boolean } = {}
): Promise<OdkFetchResult<OdkSubmissionBase>> {
  const baseUrl =
    form === "households"
      ? ENV.ODK_HOUSEHOLDS_FORM_URL
      : ENV.ODK_OUTSIDE_FORM_URL;

  // Formulaire désactivé (ex. pas de hors-ménage en campagne Polio) : on
  // retourne un résultat vide sans tenter de requête réseau.
  if (!baseUrl) {
    return {
      form,
      count: 0,
      fetchedAt: new Date().toISOString(),
      submissions: [],
    };
  }

  // 1. Charger le backfill (filesystem en local, raw.githubusercontent en prod)
  const [backfillSubs, allMeta] = await Promise.all([
    loadBackfillSubmissions(form),
    loadBackfillMeta(),
  ]);
  const backfillMeta = allMeta[form];

  // 2. Déterminer le timestamp de départ pour le fetch incrémentiel
  const hasBackfill = backfillSubs.length > 0 && backfillMeta.latestSubmissionTime !== null;
  // Sanitize : ODK rejette toute valeur de date contenant des espaces/tabulations
  // (JSON.stringify échappe un \t en "\\t", produisant un filtre invalide).
  const sinceTs = (backfillMeta.latestSubmissionTime ?? ENV.CAMPAIGN_START_DATE).trim();

  // 3. Query ODK : uniquement les nouvelles soumissions depuis sinceTs
  const query = JSON.stringify({
    _submission_time: { $gte: sinceTs },
  });

  // Sans backfill : récupérer les données les plus récentes en priorité (newest-first)
  // pour avoir les données du jour même si la limite de pages est atteinte.
  const sortOrder = hasBackfill ? undefined : JSON.stringify({ _submission_time: -1 });

  const cacheKey = `form:${form}:incremental:${sinceTs}`;

  if (!opts.force) {
    const cached = cacheGet<OdkFetchResult<OdkSubmissionBase>>(cacheKey);
    if (cached) {
      console.log(`[odk] ${form}: cache hit (${cached.count} soumissions)`);
      return cached;
    }
  }

  try {
    // 4. Fetch incrémentiel ODK (quelques pages seulement)
    const freshSubs = await fetchAllPagesLimited(baseUrl, query, INCREMENTAL_CAP, sortOrder);

    // 5. Fusionner backfill + données fraîches
    const merged = mergeSubmissions(backfillSubs, freshSubs);

    const result: OdkFetchResult<OdkSubmissionBase> = {
      form,
      count: merged.length,
      fetchedAt: new Date().toISOString(),
      submissions: merged,
    };
    cacheSet(cacheKey, result);

    console.log(
      `[odk] ${form}: ${backfillSubs.length} backfill + ${freshSubs.length} frais → ${merged.length} total`
    );

    return result;
  } catch (err) {
    // Fallback 1 : cache stale
    const stale = cacheGetStale<OdkFetchResult<OdkSubmissionBase>>(cacheKey);
    if (stale) {
      const ageMin = Math.round((Date.now() - stale.at) / 60_000);
      console.warn(
        `[odk] fetch ${form} échoué (${
          err instanceof Error ? err.message : String(err)
        }) — cache stale (âge ${ageMin}min)`
      );
      return stale.value;
    }

    // Fallback 2 : backfill seul (au moins les données historiques)
    if (backfillSubs.length > 0) {
      console.warn(
        `[odk] fetch ${form} échoué — backfill seul (${backfillSubs.length} soumissions)`
      );
      return {
        form,
        count: backfillSubs.length,
        fetchedAt: new Date().toISOString(),
        submissions: backfillSubs,
      };
    }

    throw err;
  }
}

/** Vide le cache en mémoire (utile depuis /api/refresh). */
export function flushCache(): void {
  memCache.clear();
  // Aussi vider le cache backfill (fichiers snapshots + meta) sinon un
  // chargement partiel précédent (fichier raté silencieusement) reste servi.
  clearBackfillCache();
  // Et le cache des bundles analytics — sinon /api/analytics réutilise les
  // bundles précalculés sur l'ancienne donnée. Le fingerprint (count +
  // fetchedAt) protège déjà contre ce cas, mais on purge explicitement
  // pour libérer la mémoire des bundles obsolètes.
  clearAnalyticsCache();
}

/** Marque le cache comme stale pour trigger un re-fetch au prochain appel. */
export function markCacheStale(): void {
  for (const entry of memCache.values()) {
    entry.at = 0;
  }
  // Forcer le rechargement complet du backfill au prochain appel — sinon
  // les fichiers snapshots éventuellement partiellement chargés restent en
  // mémoire et le re-fetch ODK seul ne récupère pas les soumissions perdues.
  clearBackfillCache();
  clearAnalyticsCache();
}

/**
 * Introspection : renvoie la liste des clés distinctes observées dans les
 * soumissions d'un formulaire. Précieux pour vérifier les mappings.
 */
export function introspectKeys(subs: OdkSubmissionBase[]): {
  topLevelKeys: string[];
  repeatKeys: Record<string, string[]>;
  samples: OdkSubmissionBase[];
} {
  const top = new Set<string>();
  const repeatKeys: Record<string, Set<string>> = {};

  const sampleForAnalysis = subs.slice(-500);

  for (const s of sampleForAnalysis) {
    for (const k of Object.keys(s as object)) {
      top.add(k);
      const v = (s as Record<string, unknown>)[k];
      if (Array.isArray(v) && v.length && typeof v[0] === "object" && v[0] !== null) {
        if (!repeatKeys[k]) repeatKeys[k] = new Set();
        for (const child of v as Array<Record<string, unknown>>) {
          for (const ck of Object.keys(child)) repeatKeys[k].add(ck);
        }
      }
    }
  }
  return {
    topLevelKeys: Array.from(top).sort(),
    repeatKeys: Object.fromEntries(
      Object.entries(repeatKeys).map(([k, s]) => [k, Array.from(s).sort()])
    ),
    samples: subs.slice(0, 3),
  };
}
