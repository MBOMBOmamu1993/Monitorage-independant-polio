#!/usr/bin/env tsx
/**
 * build-backfill.ts — Peuple les fichiers backfill depuis l'API ODK.
 *
 * Ce script s'exécute en local (ou dans GitHub Actions) sans limitation
 * de temps, récupère TOUTES les soumissions ODK et les sauvegarde dans
 * /data/backfill/{form}/ groupées par date.
 *
 * Ensuite, le dashboard ne récupère que les nouvelles soumissions depuis
 * le dernier timestamp backfill (quelques pages au lieu de 150+).
 *
 * Usage :
 *   npm run backfill:build           # Reconstruction complète
 *   npm run backfill:build -- --update  # Incrémentiel (depuis le dernier backfill)
 *
 * Variables d'environnement (depuis .env.local) :
 *   ODK_TOKEN, ODK_HOUSEHOLDS_FORM_URL, ODK_OUTSIDE_FORM_URL,
 *   CAMPAIGN_START_DATE
 */

import { config } from "dotenv";
import fs from "fs";
import path from "path";

// Charger .env.local
config({ path: path.join(process.cwd(), ".env.local") });
config({ path: path.join(process.cwd(), ".env.example") }); // Fallback

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ODK_TOKEN = process.env.ODK_TOKEN ?? "";
const ODK_USERNAME = process.env.ODK_USERNAME ?? "";
const ODK_PASSWORD = process.env.ODK_PASSWORD ?? "";
const HOUSEHOLDS_URL =
  process.env.ODK_HOUSEHOLDS_FORM_URL ??
  "https://api.whonghub.org/api/v1/data/16244.json";
const OUTSIDE_URL =
  process.env.ODK_OUTSIDE_FORM_URL ??
  "https://api.whonghub.org/api/v1/data/4499.json";
const CAMPAIGN_START = process.env.CAMPAIGN_START_DATE ?? "2026-04-22";

const BACKFILL_DIR = path.join(process.cwd(), "data", "backfill");
const PAGE_SIZE = 2000; // Pages plus grandes pour le script (pas de limite Vercel)
const RECORDS_PER_FILE = 10_000; // Diviser les gros jours en plusieurs fichiers
const PER_REQUEST_TIMEOUT_MS = 45_000; // 45s par requête (tolérant pour CI)
const MAX_RETRIES = 4;

const isUpdate = process.argv.includes("--update");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OdkRecord {
  _id?: number;
  _uuid?: string;
  _submission_time?: string;
  [key: string]: unknown;
}

interface BackfillFormMeta {
  latestSubmissionTime: string | null;
  count: number;
  lastUpdated: string | null;
  files: string[];
}

interface BackfillMeta {
  version: number;
  households: BackfillFormMeta;
  outside: BackfillFormMeta;
}

// ---------------------------------------------------------------------------
// Utilitaires réseau
// ---------------------------------------------------------------------------

function authHeader(): Record<string, string> {
  if (ODK_TOKEN) return { Authorization: `Token ${ODK_TOKEN}` };
  if (ODK_USERNAME && ODK_PASSWORD) {
    const b64 = Buffer.from(`${ODK_USERNAME}:${ODK_PASSWORD}`).toString("base64");
    return { Authorization: `Basic ${b64}` };
  }
  throw new Error(
    "Aucune authentification ODK configurée. Définir ODK_TOKEN dans .env.local"
  );
}

async function fetchWithRetry(url: string): Promise<OdkRecord[]> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "RR-Polio-Backfill/1.0",
          ...authHeader(),
        },
      });
      clearTimeout(tid);

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }

      const text = await res.text();
      if (!text.trim().startsWith("[") && !text.trim().startsWith("{")) {
        throw new Error(`Réponse non-JSON: ${text.slice(0, 100)}`);
      }
      return JSON.parse(text) as OdkRecord[];
    } catch (e) {
      clearTimeout(tid);
      const msg = e instanceof Error ? e.message : String(e);
      if (attempt === MAX_RETRIES) throw new Error(`Échec après ${MAX_RETRIES} tentatives: ${msg}`);
      const delay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s, 8s
      console.warn(`  [tentative ${attempt}/${MAX_RETRIES}] Erreur: ${msg} — nouvelle tentative dans ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return []; // Jamais atteint
}

async function fetchAllPages(baseUrl: string, sinceTs: string): Promise<OdkRecord[]> {
  const all: OdkRecord[] = [];
  let start = 0;
  const query = JSON.stringify({ _submission_time: { $gte: sinceTs } });

  while (true) {
    const params = new URLSearchParams({
      query,
      start: String(start),
      limit: String(PAGE_SIZE),
    });
    const url = `${baseUrl}?${params.toString()}`;

    process.stdout.write(
      `\r  Page start=${start} — ${all.length} soumissions récupérées jusqu'ici…`
    );

    const page = await fetchWithRetry(url);

    if (!Array.isArray(page)) {
      console.error(`\n  Réponse non-tableau à start=${start}`);
      break;
    }

    all.push(...page);

    if (page.length < PAGE_SIZE) break; // Dernière page
    start += PAGE_SIZE;
  }

  process.stdout.write("\n");
  return all;
}

// ---------------------------------------------------------------------------
// Gestion des fichiers backfill
// ---------------------------------------------------------------------------

function loadMeta(): BackfillMeta {
  const metaPath = path.join(BACKFILL_DIR, "meta.json");
  if (!fs.existsSync(metaPath)) {
    return {
      version: 1,
      households: { latestSubmissionTime: null, count: 0, lastUpdated: null, files: [] },
      outside: { latestSubmissionTime: null, count: 0, lastUpdated: null, files: [] },
    };
  }
  return JSON.parse(fs.readFileSync(metaPath, "utf-8")) as BackfillMeta;
}

function saveMeta(meta: BackfillMeta): void {
  fs.writeFileSync(
    path.join(BACKFILL_DIR, "meta.json"),
    JSON.stringify(meta, null, 2) + "\n",
    "utf-8"
  );
}

/**
 * Charge les soumissions existantes pour une date donnée. Couvre à la fois
 * le format simple (`YYYY-MM-DD.json`) et le format chunké (`YYYY-MM-DD-pXX.json`).
 * Indispensable pour fusionner avec les nouveaux records sans rien perdre.
 */
function loadExistingRecordsForDate(formDir: string, date: string): OdkRecord[] {
  if (!fs.existsSync(formDir)) return [];
  const pattern = new RegExp(`^${date}(-p\\d{2})?\\.json$`);
  const records: OdkRecord[] = [];
  for (const f of fs.readdirSync(formDir)) {
    if (!pattern.test(f)) continue;
    try {
      const content = fs.readFileSync(path.join(formDir, f), "utf-8");
      const arr = JSON.parse(content) as OdkRecord[];
      if (Array.isArray(arr)) records.push(...arr);
    } catch (e) {
      console.warn(`  ⚠️  Lecture échouée pour ${f}:`, e instanceof Error ? e.message : e);
    }
  }
  return records;
}

/** Déduplique par _uuid (puis _id si pas d'uuid). Le dernier écrit gagne. */
function dedupRecords(records: OdkRecord[]): OdkRecord[] {
  const seen = new Map<string, OdkRecord>();
  let noKey = 0;
  for (const r of records) {
    const key = String(r._uuid ?? r._id ?? "");
    if (!key) {
      noKey++;
      continue;
    }
    seen.set(key, r);
  }
  if (noKey > 0) console.warn(`  ⚠️  ${noKey} record(s) sans _uuid/_id ignoré(s)`);
  return Array.from(seen.values());
}

/** Compte les records dans une liste de fichiers JSON (vérité terrain). */
function countRecordsInFiles(formDir: string, files: readonly string[]): number {
  let total = 0;
  for (const f of files) {
    try {
      const content = fs.readFileSync(path.join(formDir, f), "utf-8");
      const arr = JSON.parse(content) as unknown[];
      if (Array.isArray(arr)) total += arr.length;
    } catch (e) {
      console.warn(`  ⚠️  Comptage échoué pour ${f}:`, e instanceof Error ? e.message : e);
    }
  }
  return total;
}

/** Supprime tous les fichiers du formDir matchant un pattern de date. */
function deleteFilesForDate(formDir: string, date: string): void {
  if (!fs.existsSync(formDir)) return;
  const pattern = new RegExp(`^${date}(-p\\d{2})?\\.json$`);
  for (const f of fs.readdirSync(formDir)) {
    if (pattern.test(f)) {
      fs.unlinkSync(path.join(formDir, f));
    }
  }
}

/**
 * Sauvegarde les enregistrements dans des fichiers JSON groupés par date.
 *
 * En mode incrémentiel, FUSIONNE avec les fichiers existants du même jour
 * (dédup par _uuid) avant de réécrire — sinon on écrase chaque jour avec
 * uniquement la dernière heure de soumissions, perdant tout le reste.
 *
 * Divise automatiquement en plusieurs parties si > RECORDS_PER_FILE.
 * Retourne la liste des fichiers créés et le nombre total de records écrits.
 */
function saveRecordsByDate(
  records: OdkRecord[],
  formDir: string,
  formName: string,
  mergeWithExisting: boolean
): { files: string[]; latestTs: string | null; totalWritten: number } {
  const byDate = new Map<string, OdkRecord[]>();

  for (const rec of records) {
    const ts = rec._submission_time ?? "";
    const date = ts.slice(0, 10) || "unknown";
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(rec);
  }

  const files: string[] = [];
  let latestTs: string | null = null;
  let totalWritten = 0;

  for (const [date, newRecs] of Array.from(byDate.entries()).sort()) {
    // FUSION : charger l'existant pour ce jour et dédupliquer par _uuid.
    // Sans ça, l'incrémentiel écrase 2026-04-25.json à chaque run et les
    // soumissions précédentes du même jour disparaissent.
    const existing = mergeWithExisting ? loadExistingRecordsForDate(formDir, date) : [];
    const merged = dedupRecords([...existing, ...newRecs]);
    if (mergeWithExisting && existing.length) {
      console.log(
        `  [${formName}] ${date}: ${existing.length} existants + ${newRecs.length} nouveaux → ${merged.length} après dédup`
      );
    }

    // Mettre à jour le timestamp le plus récent
    for (const r of merged) {
      if (r._submission_time && (!latestTs || r._submission_time > latestTs)) {
        latestTs = r._submission_time;
      }
    }

    // Supprimer les anciens fichiers de ce jour pour éviter les orphelins
    // (ex: avait p01,p02,p03 mais après dédup il n'en faut plus que 2).
    if (mergeWithExisting) deleteFilesForDate(formDir, date);

    // Diviser en parties si trop grand
    const chunks: OdkRecord[][] = [];
    for (let i = 0; i < merged.length; i += RECORDS_PER_FILE) {
      chunks.push(merged.slice(i, i + RECORDS_PER_FILE));
    }

    chunks.forEach((chunk, idx) => {
      const suffix = chunks.length > 1 ? `-p${String(idx + 1).padStart(2, "0")}` : "";
      const filename = `${date}${suffix}.json`;
      const filePath = path.join(formDir, filename);
      fs.writeFileSync(filePath, JSON.stringify(chunk, null, 0) + "\n", "utf-8");
      const sizeMB = (fs.statSync(filePath).size / 1024 / 1024).toFixed(1);
      console.log(
        `  [${formName}] Sauvegardé ${filename}: ${chunk.length} enregistrements (${sizeMB} MB)`
      );
      files.push(filename);
      totalWritten += chunk.length;
    });
  }

  return { files, latestTs, totalWritten };
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

async function buildForm(
  formName: "households" | "outside",
  baseUrl: string,
  meta: BackfillMeta
): Promise<void> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Formulaire : ${formName}`);
  console.log(`URL        : ${baseUrl}`);

  const formDir = path.join(BACKFILL_DIR, formName);
  if (!fs.existsSync(formDir)) fs.mkdirSync(formDir, { recursive: true });

  const currentMeta = meta[formName];
  const sinceTs = isUpdate && currentMeta.latestSubmissionTime
    ? currentMeta.latestSubmissionTime
    : CAMPAIGN_START;

  console.log(`Mode       : ${isUpdate && currentMeta.latestSubmissionTime ? "incrémentiel" : "complet"}`);
  console.log(`Depuis     : ${sinceTs}`);
  console.log(`${"=".repeat(60)}`);

  const records = await fetchAllPages(baseUrl, sinceTs);
  console.log(`  Total récupéré : ${records.length} soumissions`);

  if (records.length === 0) {
    console.log(`  Aucune nouvelle soumission depuis ${sinceTs}.`);
    return;
  }

  if (isUpdate && currentMeta.latestSubmissionTime) {
    // Mode incrémentiel : fusionner avec l'existant (par jour, dédup _uuid).
    const { files: writtenFiles, latestTs, totalWritten } = saveRecordsByDate(
      records,
      formDir,
      formName,
      /* mergeWithExisting */ true
    );

    // Liste finale des fichiers = l'union des fichiers écrits cette fois + ceux
    // des jours non touchés. On lit le dossier pour avoir la vérité terrain.
    const allFiles = fs
      .readdirSync(formDir)
      .filter((f) => f.endsWith(".json"))
      .sort();

    // Compter les records depuis les fichiers réellement présents (pas une
    // addition naïve currentMeta.count + records.length qui dérive à chaque
    // run et finit par mentir sur le contenu réel des snapshots).
    const totalCount = countRecordsInFiles(formDir, allFiles);

    meta[formName] = {
      latestSubmissionTime: latestTs ?? currentMeta.latestSubmissionTime,
      count: totalCount,
      lastUpdated: new Date().toISOString(),
      files: allFiles,
    };
    console.log(
      `  → ${writtenFiles.length} fichier(s) ré-écrit(s), ${totalWritten} records dans le batch, ${totalCount} records au total dans ${allFiles.length} fichier(s)`
    );
  } else {
    // Mode complet : vider l'ancien backfill et reconstruire
    const oldFiles = currentMeta.files;
    for (const f of oldFiles) {
      const p = path.join(formDir, f);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }

    const { files, latestTs, totalWritten } = saveRecordsByDate(
      records,
      formDir,
      formName,
      /* mergeWithExisting */ false
    );
    meta[formName] = {
      latestSubmissionTime: latestTs,
      count: totalWritten,
      lastUpdated: new Date().toISOString(),
      files: files.sort(),
    };
  }

  console.log(`  → Timestamp le plus récent : ${meta[formName].latestSubmissionTime}`);
  console.log(`  → Fichiers backfill : ${meta[formName].files.length}`);
}

async function main() {
  console.log("\n🗂  RR-Polio — Construction du backfill ODK");
  console.log(`Mode : ${isUpdate ? "INCRÉMENTIEL" : "COMPLET"}`);
  console.log(`Date de début campagne : ${CAMPAIGN_START}`);
  console.log(`Répertoire backfill : ${BACKFILL_DIR}\n`);

  if (!fs.existsSync(BACKFILL_DIR)) {
    fs.mkdirSync(BACKFILL_DIR, { recursive: true });
  }

  // Vérifier l'authentification
  try {
    authHeader();
  } catch (e) {
    console.error("❌ Erreur authentification:", e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const meta = loadMeta();
  const startTime = Date.now();

  try {
    await buildForm("households", HOUSEHOLDS_URL, meta);
    await buildForm("outside", OUTSIDE_URL, meta);
  } catch (e) {
    console.error("\n❌ Erreur lors du fetch:", e instanceof Error ? e.message : e);
    // Sauvegarder quand même la progression partielle
    saveMeta(meta);
    process.exit(1);
  }

  saveMeta(meta);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\n✅ Backfill terminé en ${elapsed}s`);
  console.log(`   Ménage   : ${meta.households.count} soumissions dans ${meta.households.files.length} fichier(s)`);
  console.log(`   Hors-mén : ${meta.outside.count} soumissions dans ${meta.outside.files.length} fichier(s)`);
  console.log(`\n   Prochaine étape : git add data/backfill && git commit -m "data: backfill ODK" && git push`);
}

main().catch((e) => {
  console.error("Erreur fatale:", e);
  process.exit(1);
});
