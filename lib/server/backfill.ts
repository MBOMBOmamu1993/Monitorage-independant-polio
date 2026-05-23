/**
 * Chargement des données backfill — hybride filesystem + GitHub.
 *
 * Les snapshots backfill (~300 MB) sont commités dans le dépôt Git pour
 * la traçabilité, mais leur taille dépasse la limite 250 MB des serverless
 * functions Vercel. Solution :
 *   1. `next.config.mjs` exclut `data/backfill/**` du traçage de bundle.
 *   2. Ce module les lit depuis le filesystem en local/CI (instantané)
 *      et depuis GitHub en production.
 *   3. Cache mémoire au niveau module : décompression unique par cold start.
 *
 * Stratégie distante :
 *   - Si `GITHUB_TOKEN` est configuré → API GitHub Contents (marche pour
 *     repos privés ET publics, support raw via `Accept: vnd.github.raw`,
 *     limite 100 MB/fichier, rate-limit 5000/h authentifié).
 *   - Sinon → jsDelivr CDN (rapide mais repos publics uniquement) puis
 *     raw.githubusercontent.com en fallback.
 *
 * Pour un repo privé : DÉFINIR `GITHUB_TOKEN` (PAT avec `Contents: read`)
 * sur Vercel, sinon le backfill renverra une meta vide en production.
 *
 * Variables d'env :
 *   - VERCEL_GIT_REPO_OWNER, VERCEL_GIT_REPO_SLUG, VERCEL_GIT_COMMIT_SHA
 *     sont fournies automatiquement par Vercel.
 *   - BACKFILL_REPO_OWNER, BACKFILL_REPO_SLUG, BACKFILL_REPO_REF
 *     permettent un override manuel (utile hors-Vercel).
 *   - GITHUB_TOKEN ou BACKFILL_GITHUB_TOKEN : PAT pour repos privés.
 */

import fs from "fs";
import path from "path";
import zlib from "zlib";
import type { OdkSubmissionBase, OdkForm } from "@/lib/types/odk";

const BACKFILL_DIR = path.join(process.cwd(), "data", "backfill");

const REPO_OWNER =
  process.env.BACKFILL_REPO_OWNER ?? process.env.VERCEL_GIT_REPO_OWNER ?? "";
const REPO_SLUG =
  process.env.BACKFILL_REPO_SLUG ?? process.env.VERCEL_GIT_REPO_SLUG ?? "";
// Préférer le SHA (immutable, cacheable indéfiniment au CDN) au nom de branche.
const REPO_REF =
  process.env.BACKFILL_REPO_REF ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.VERCEL_GIT_COMMIT_REF ??
  "main";

// Token GitHub pour repos privés. Sans ce token, jsDelivr et raw renvoient
// 403/404 pour les repos privés et le backfill ne charge JAMAIS en prod.
const GITHUB_TOKEN =
  process.env.BACKFILL_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN ?? "";

interface RemoteSource {
  /** Identifiant lisible pour les logs */
  label: string;
  /** Construit l'URL absolue à fetcher pour un fichier relatif au sous-dir backfill */
  buildUrl: (relativePath: string) => string;
  /** Headers à envoyer (auth, accept, etc.) */
  headers: Record<string, string>;
}

function buildRemoteSources(): RemoteSource[] {
  if (!REPO_OWNER || !REPO_SLUG) return [];

  const sources: RemoteSource[] = [];

  // 1. raw.githubusercontent.com : le plus direct et rapide.
  //    Avec token = OK pour privés. Sans token = OK pour publics seulement.
  sources.push({
    label: GITHUB_TOKEN ? "raw-auth" : "raw-anon",
    buildUrl: (rel) =>
      `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_SLUG}/${REPO_REF}/data/backfill/${rel}`,
    headers: {
      Accept: "application/json,application/octet-stream",
      "User-Agent": "RR-Polio-Dashboard/0.1",
      ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
    },
  });

  // 2. jsDelivr : CDN edge mondial, ne fonctionne que pour repos PUBLICS.
  sources.push({
    label: "jsdelivr",
    buildUrl: (rel) =>
      `https://cdn.jsdelivr.net/gh/${REPO_OWNER}/${REPO_SLUG}@${REPO_REF}/data/backfill/${rel}`,
    headers: {
      Accept: "application/json,application/octet-stream",
      "User-Agent": "RR-Polio-Dashboard/0.1",
    },
  });

  // 3. API GitHub Contents : marche pour repos PRIVÉS ET publics dès qu'on
  //    a un token. Avec `Accept: vnd.github.raw`, on récupère le fichier brut.
  if (GITHUB_TOKEN) {
    sources.push({
      label: "github-api",
      buildUrl: (rel) =>
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_SLUG}/contents/data/backfill/${rel}?ref=${encodeURIComponent(REPO_REF)}`,
      headers: {
        Accept: "application/vnd.github.raw",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "RR-Polio-Dashboard/0.1",
      },
    });
  }

  return sources;
}

const REMOTE_SOURCES = buildRemoteSources();

// Timeout par fichier. Augmenté à 25s car les fichiers peuvent faire 20MB+ 
// et la bande passante Vercel est partagée.
const REMOTE_FETCH_TIMEOUT_MS = 25_000;

/**
 * Concurrence du fetch CDN. Les fichiers backfill sont gros (~22 MB) et nombreux.
 * Réduit à 5 pour éviter d'étouffer la bande passante et la RAM de la lambda Vercel.
 */
const REMOTE_FETCH_CONCURRENCY = 5;

export interface BackfillFormMeta {
  /** ISO timestamp de la dernière soumission dans le backfill */
  latestSubmissionTime: string | null;
  /** Nombre total de soumissions dans le backfill */
  count: number;
  /** ISO timestamp de la dernière mise à jour du backfill */
  lastUpdated: string | null;
  /** Liste des fichiers JSON (relatifs au sous-répertoire du formulaire) */
  files: string[];
}

export interface BackfillMeta {
  version: number;
  households: BackfillFormMeta;
  outside: BackfillFormMeta;
}

function defaultMeta(): BackfillMeta {
  return {
    version: 1,
    households: { latestSubmissionTime: null, count: 0, lastUpdated: null, files: [] },
    outside: { latestSubmissionTime: null, count: 0, lastUpdated: null, files: [] },
  };
}

/** Nombre de tentatives par source distante (1 + 2 retries). */
const REMOTE_FETCH_ATTEMPTS = 3;

async function fetchRemoteBytes(relativePath: string): Promise<Buffer | null> {
  for (const source of REMOTE_SOURCES) {
    const url = source.buildUrl(relativePath);
    for (let attempt = 1; attempt <= REMOTE_FETCH_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), REMOTE_FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: source.headers,
          // Cache HTTP côté Vercel (data cache) — invalidé toutes les heures
          // car le backfill est rebuild quotidiennement par GitHub Actions.
          next: { revalidate: 3600 },
        });
        if (!res.ok) {
          // 4xx (sauf 429) : pas la peine de retry — passer à la source suivante.
          if (res.status >= 400 && res.status < 500 && res.status !== 429) {
            console.error(
              `[backfill] HTTP ${res.status} via ${source.label} pour ${relativePath} (pas de retry)`
            );
            break;
          }
          console.error(
            `[backfill] HTTP ${res.status} via ${source.label} pour ${relativePath} (tentative ${attempt}/${REMOTE_FETCH_ATTEMPTS})`
          );
        } else {
          const ab = await res.arrayBuffer();
          return Buffer.from(ab);
        }
      } catch (e) {
        console.error(
          `[backfill] fetch échoué via ${source.label} pour ${relativePath} (tentative ${attempt}/${REMOTE_FETCH_ATTEMPTS}):`,
          e instanceof Error ? e.message : e
        );
      } finally {
        clearTimeout(tid);
      }
      if (attempt < REMOTE_FETCH_ATTEMPTS) {
        // Backoff exponentiel borné : 500ms, 1500ms.
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }
  return null;
}

function parseJsonBuffer<T>(buf: Buffer, relativePath: string): T | null {
  try {
    // Support transparent .gz (header 0x1f 0x8b) — qu'il vienne du fs ou du CDN.
    const isGzip = buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b;
    const text = isGzip ? zlib.gunzipSync(buf).toString("utf-8") : buf.toString("utf-8");
    return JSON.parse(text) as T;
  } catch (e) {
    console.error(`[backfill] parse échoué pour ${relativePath}:`, e);
    return null;
  }
}

async function readJsonFile<T>(relativePath: string): Promise<T | null> {
  // 1. Filesystem local (dev, CI, scripts) — instantané et gratuit.
  const localPath = path.join(BACKFILL_DIR, relativePath);
  if (fs.existsSync(localPath)) {
    try {
      return parseJsonBuffer<T>(fs.readFileSync(localPath), relativePath);
    } catch (e) {
      console.warn(`[backfill] lecture fs échouée pour ${relativePath}:`, e);
    }
  }

  // 2. Fetch depuis CDN (cold start en prod ; cache HTTP Vercel + jsDelivr edge).
  const buf = await fetchRemoteBytes(relativePath);
  if (!buf) return null;
  return parseJsonBuffer<T>(buf, relativePath);
}

/**
 * Cache module-level : 1 fetch + parse coûteux par cold start uniquement.
 * Sur warm starts, retour instantané du tableau déjà en mémoire.
 */
const submissionsCache: Partial<Record<OdkForm, OdkSubmissionBase[]>> = {};
let metaCache: BackfillMeta | null = null;

/** Statistiques du dernier chargement par formulaire (diagnostic). */
export interface BackfillLoadStats {
  filesTotal: number;
  filesLoaded: number;
  filesFailed: number;
  failedFiles: string[];
  recordsLoaded: number;
  loadedAt: string;
}
const loadStats: Partial<Record<OdkForm, BackfillLoadStats>> = {};

export function getBackfillLoadStats(): Partial<Record<OdkForm, BackfillLoadStats>> {
  return loadStats;
}

export async function loadBackfillMeta(): Promise<BackfillMeta> {
  if (metaCache) return metaCache;
  const data = await readJsonFile<BackfillMeta>("meta.json");
  if (!data) {
    if (REMOTE_SOURCES.length === 0) {
      console.warn(
        "[backfill] meta.json introuvable et REPO env non configuré — backfill désactivé"
      );
    } else if (!GITHUB_TOKEN) {
      console.warn(
        `[backfill] meta.json introuvable via ${REMOTE_SOURCES.map((s) => s.label).join(", ")} — ` +
          "si le repo est PRIVÉ, définir GITHUB_TOKEN (PAT avec Contents: read) sur Vercel"
      );
    } else {
      console.warn(
        `[backfill] meta.json introuvable via toutes les sources distantes (${REMOTE_SOURCES.map((s) => s.label).join(", ")}) — ` +
          `vérifier que data/backfill/meta.json existe sur le ref ${REPO_REF}`
      );
    }
    metaCache = defaultMeta();
    return metaCache;
  }
  metaCache = data;
  return data;
}

/**
 * Map asynchrone à concurrence bornée — préserve l'ordre des résultats.
 * Indispensable pour le chargement backfill : on veut paralléliser le
 * fetch CDN sans saturer la mémoire de la lambda Vercel.
 */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const idx = next++;
        if (idx >= items.length) return;
        results[idx] = await worker(items[idx], idx);
      }
    }
  );

  await Promise.all(runners);
  return results;
}

/**
 * Charge toutes les soumissions backfill pour le formulaire donné.
 * Les fichiers sont fetchés en parallèle (concurrence bornée) car le CDN
 * jsDelivr/raw.githubusercontent ajoute ~1-5s de latence par fichier ; en
 * séquentiel on dépasse vite le budget route (45s). La concurrence bornée
 * évite la pression mémoire (chaque fichier ~22 MB de JSON ≈ 60 MB V8).
 * L'agrégation finale conserve l'ordre du meta pour la cohérence.
 */
export async function loadBackfillSubmissions(
  form: OdkForm
): Promise<OdkSubmissionBase[]> {
  if (submissionsCache[form]) return submissionsCache[form]!;

  const meta = await loadBackfillMeta();
  const formMeta = meta[form];

  if (!formMeta.files?.length) {
    console.log(`[backfill] ${form}: aucun fichier backfill trouvé`);
    submissionsCache[form] = [];
    return [];
  }

  const t0 = Date.now();
  const failedFiles: string[] = [];
  const chunks = await mapWithConcurrency(
    formMeta.files,
    REMOTE_FETCH_CONCURRENCY,
    async (file) => {
      const data = await readJsonFile<OdkSubmissionBase[]>(`${form}/${file}`);
      if (data === null) {
        failedFiles.push(file);
        return [] as OdkSubmissionBase[];
      }
      if (!Array.isArray(data)) {
        console.warn(`[backfill] ${form}/${file}: format inattendu (non-tableau)`);
        failedFiles.push(file);
        return [] as OdkSubmissionBase[];
      }
      return data;
    }
  );

  const all: OdkSubmissionBase[] = [];
  for (const chunk of chunks) {
    if (chunk.length) all.push(...chunk);
  }

  const elapsed = Date.now() - t0;
  const filesLoaded = formMeta.files.length - failedFiles.length;
  if (failedFiles.length) {
    console.error(
      `[backfill] ${form}: ${failedFiles.length}/${formMeta.files.length} fichier(s) ont ÉCHOUÉ — ` +
        `~${formMeta.count - all.length} soumissions manquantes. Fichiers : ${failedFiles.join(", ")}`
    );
  }
  console.log(
    `[backfill] ${form}: ${all.length}/${formMeta.count} soumissions chargées depuis ${filesLoaded}/${formMeta.files.length} fichier(s) en ${elapsed}ms (concurrence ${REMOTE_FETCH_CONCURRENCY})`
  );

  loadStats[form] = {
    filesTotal: formMeta.files.length,
    filesLoaded,
    filesFailed: failedFiles.length,
    failedFiles,
    recordsLoaded: all.length,
    loadedAt: new Date().toISOString(),
  };

  submissionsCache[form] = all;
  return all;
}

/** Vide le cache mémoire (utile pour les tests et le refresh manuel). */
export function clearBackfillCache(): void {
  delete submissionsCache.households;
  delete submissionsCache.outside;
  metaCache = null;
}
