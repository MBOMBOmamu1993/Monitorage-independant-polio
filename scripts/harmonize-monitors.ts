/**
 * Harmonisation des noms de moniteurs avec Fuzzy Matching
 * ========================================================
 *
 * Ce script analyse les noms de moniteurs dans les données ODK (backfill +
 * données locales de référence), détecte les variations d'orthographe pour
 * un même moniteur, et génère automatiquement le fichier d'alias.
 *
 * Stratégies de détection (par ordre de priorité) :
 *  1. Préfixe / troncation : "KAPAMBU BUTA" → "KAPAMBU BUTA TRIOMPHE"
 *  2. Similarité élevée Ratcliff/Obershelp ≥ 0.80 + mot discriminant commun
 *  3. Conscience de la Zone de Santé : favorise les appariements intra-ZS
 *
 * Choix du nom canonique : toujours la version la plus complète (plus longue),
 * ex. LOFOLI < LOFOLI BOKOTA < LOFOLI BOKOTA FELLY → canonique = LOFOLI BOKOTA FELLY
 *
 * Usage :
 *   npx tsx scripts/harmonize-monitors.ts
 *
 * Ou via npm :
 *   npm run harmonize-monitors
 */

// Charger les variables d'environnement depuis .env.local AVANT tout autre import
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const key in envConfig) {
    process.env[key] = envConfig[key];
  }
}

import { normKey } from "@/lib/etl/normalize";
import { ENV, odkAuthHeader } from "@/lib/server/env";

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Seuil de similarité Ratcliff/Obershelp (0.80 = permissif, 0.90 = strict). */
const SIMILARITY_THRESHOLD = 0.80;

/**
 * Longueur minimale du préfixe (normalisé) pour déclencher la détection
 * de troncation. Ex : "KAPAMBU BUTA" (12 chars) est assez long pour être
 * un vrai préfixe ; "JEAN" (4 chars) ne l'est pas.
 */
const MIN_PREFIX_LENGTH = 8;

// URLs ODK depuis les variables d'environnement
const ODK_URLS = {
  household: ENV.ODK_HOUSEHOLDS_FORM_URL,
  outside: ENV.ODK_OUTSIDE_FORM_URL,
};

// Chemins vers les données locales de référence (fallback ODK)
const LOCAL_DATA_PATHS = {
  household: path.join(process.cwd(), "data", "reference", "DRC_SIA_IM_Households_Polio_RR-2026-04-19-10-05-27.json"),
  outside: path.join(process.cwd(), "data", "reference", "DRC_sia_im_outsidehouse.json"),
};

// Dossiers backfill (source principale des données)
const BACKFILL_DIRS = {
  household: path.join(process.cwd(), "data", "backfill", "households"),
  outside: path.join(process.cwd(), "data", "backfill", "outside"),
};

// Headers d'authentification (optionnels)
const ODK_HEADERS: Record<string, string> = { Accept: "application/json" };
let hasOdkToken = false;
try {
  Object.assign(ODK_HEADERS, odkAuthHeader());
  hasOdkToken = true;
} catch {
  console.warn("⚠️  Pas de token ODK – utilisation des données locales/backfill");
}

// Champs possibles pour le nom du moniteur
const MONITOR_FIELDS = [
  "Name_of_Monitor",
  "name_of_monitor",
  "Monitor_Name",
  "monitor_name",
  "monitorName",
];

// Champs possibles pour la Zone de Santé
const ZS_FIELDS = ["ZS", "zs", "District", "district"];

// =============================================================================
// FONCTIONS DE SIMILARITÉ
// =============================================================================

/**
 * Calcule le ratio de similarité Ratcliff/Obershelp entre deux chaînes (0 à 1).
 *
 * Formule officielle : 2 * M / (len_a + len_b)
 * où M = nombre total de caractères appariés via les blocs communs récursifs.
 *
 * Note : computeMatchingCharacters retourne déjà 2*M (le *2 est inclus dans
 * la récursion), donc le diviseur correct est (lenA + lenB), PAS max(lenA, lenB).
 */
function similarity(a: string, b: string): number {
  const aNorm = normalizeText(a);
  const bNorm = normalizeText(b);

  if (!aNorm || !bNorm) return 0.0;
  if (aNorm === bNorm) return 1.0;

  return computeMatchingCharacters(aNorm, bNorm) / (aNorm.length + bNorm.length);
}

function computeMatchingCharacters(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;

  const lcs = longestCommonSubstring(a, b);
  if (lcs.length === 0) return 0;

  const aIdx = a.indexOf(lcs);
  const bIdx = b.indexOf(lcs);

  return lcs.length * 2
    + computeMatchingCharacters(a.slice(0, aIdx), b.slice(0, bIdx))
    + computeMatchingCharacters(a.slice(aIdx + lcs.length), b.slice(bIdx + lcs.length));
}

function longestCommonSubstring(a: string, b: string): string {
  let longest = "";
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let k = 0;
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
      if (k > longest.length) longest = a.slice(i, i + k);
    }
  }
  return longest;
}

function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// =============================================================================
// EXTRACTION DES MONITEURS
// =============================================================================

interface MonitorStats {
  /** Forme brute la plus complète observée. */
  raw: string;
  /** Clé normalisée (normKey). */
  norm: string;
  /** Nombre total de soumissions. */
  count: number;
  /**
   * Zones de Santé (normKey) où ce moniteur a soumis.
   * Permet de restreindre les appariements aux moniteurs du même ZS.
   */
  zsSet: Set<string>;
}

// =============================================================================
// LECTURE DES DONNÉES
// =============================================================================

async function fetchOdkData(url: string, localPath: string): Promise<any[]> {
  if (!hasOdkToken) {
    try {
      if (fs.existsSync(localPath)) {
        const raw = fs.readFileSync(localPath, "utf-8");
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
      }
    } catch (e) {
      console.warn(`   ⚠️  Lecture fichier local : ${e instanceof Error ? e.message : String(e)}`);
    }
    return [];
  }

  try {
    const response = await fetch(url, { headers: ODK_HEADERS });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const data = await response.json();
    return Array.isArray(data) ? data : (data.data ?? data.submissions ?? []);
  } catch (e) {
    console.warn(`   ⚠️  API ODK : ${e instanceof Error ? e.message : String(e)}`);
    return fetchOdkData("", localPath);
  }
}

/** Lit tous les fichiers JSON d'un dossier backfill (tri alphabétique). */
function readBackfillDir(dir: string): any[] {
  if (!fs.existsSync(dir)) return [];
  const submissions: any[] = [];
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith(".json"))
    .sort();

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, file), "utf-8");
      const data = JSON.parse(raw);
      const arr = Array.isArray(data) ? data : (data.data ?? data.submissions ?? []);
      submissions.push(...arr);
    } catch (e) {
      console.warn(`   ⚠️  Backfill ${file} : ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return submissions;
}

function extractMonitorsFromSubmissions(
  submissions: any[],
  monitors: Map<string, MonitorStats>
): void {
  for (const sub of submissions) {
    // Nom du moniteur
    let raw: string | undefined;
    for (const field of MONITOR_FIELDS) {
      if (sub[field] && typeof sub[field] === "string") {
        raw = sub[field].trim();
        if (raw) break;
      }
    }
    // Supprimer les caractères non-alphabétiques en début de nom
    // (ex : ". SOSA SANDUKU" → "SOSA SANDUKU", "¹ngansi" → "ngansi", "1\nNOM" → "NOM")
    raw = raw.replace(/^[^a-zA-ZÀ-ÿ]+/, "").trim();

    if (!raw || !isValidMonitorName(raw)) continue;

    const norm = normKey(raw);
    if (!norm) continue;

    // Zone de Santé
    let zs = "";
    for (const field of ZS_FIELDS) {
      if (sub[field] && typeof sub[field] === "string") {
        zs = normKey(sub[field]);
        if (zs) break;
      }
    }

    const existing = monitors.get(norm);
    if (existing) {
      existing.count += 1;
      // Conserver la forme la plus longue comme représentant brut
      if (raw.length > existing.raw.length) existing.raw = raw;
      if (zs) existing.zsSet.add(zs);
    } else {
      monitors.set(norm, { raw, norm, count: 1, zsSet: new Set(zs ? [zs] : []) });
    }
  }
}

async function extractMonitors(): Promise<Map<string, MonitorStats>> {
  const monitors = new Map<string, MonitorStats>();

  // 1. Backfill households (source principale)
  console.log("📂 Lecture backfill ménage...");
  const hhBackfill = readBackfillDir(BACKFILL_DIRS.household);
  console.log(`   → ${hhBackfill.length} soumissions`);
  extractMonitorsFromSubmissions(hhBackfill, monitors);

  // 2. Backfill outside
  console.log("📂 Lecture backfill hors-ménage...");
  const ohBackfill = readBackfillDir(BACKFILL_DIRS.outside);
  console.log(`   → ${ohBackfill.length} soumissions`);
  extractMonitorsFromSubmissions(ohBackfill, monitors);

  // 3. Données ODK (API ou fichiers locaux de référence)
  console.log("📥 Récupération données ménage (ODK/local)...");
  const hhOdk = await fetchOdkData(ODK_URLS.household, LOCAL_DATA_PATHS.household);
  console.log(`   → ${hhOdk.length} soumissions`);
  extractMonitorsFromSubmissions(hhOdk, monitors);

  console.log("📥 Récupération données hors-ménage (ODK/local)...");
  const ohOdk = await fetchOdkData(ODK_URLS.outside, LOCAL_DATA_PATHS.outside);
  console.log(`   → ${ohOdk.length} soumissions`);
  extractMonitorsFromSubmissions(ohOdk, monitors);

  return monitors;
}

// =============================================================================
// DÉTECTION DES VARIATIONS
// =============================================================================

interface MonitorCluster {
  canonical: MonitorStats;
  variants: MonitorStats[];
}

/**
 * Prénoms très courants en RDC — trop fréquents pour être discriminants.
 * On les exclut du test "partage un mot commun" afin d'éviter de fusionner
 * "JEAN MBOMBO" avec "JEAN MUKOKO" uniquement parce qu'ils partagent "JEAN".
 */
/**
 * Mots trop fréquents pour être discriminants dans les noms de moniteurs RDC.
 * Contient les prénoms masculins et féminins courants + particules.
 * Un mot discriminant valide est : longueur ≥ 3 ET absent de cette liste.
 */
const COMMON_FIRST_NAMES = new Set([
  // Prénoms masculins courants
  "JEAN", "MARIE", "MICHEL", "MICHAEL", "PIERRE", "PAUL", "JACQUES",
  "JOSEPH", "ALAIN", "DANIEL", "CHRISTIAN", "CHRISTOPHE", "EMMANUEL",
  "SAMUEL", "DAVID", "MOISE", "MOSES", "ABRAHAM", "ISAAC", "JACOB",
  "SIMON", "ANDRE", "ANTOINE", "BERNARD", "CHARLES", "EDOUARD",
  "FRANCIS", "FRANCOIS", "GEORGES", "HENRI", "JULIEN", "LAURENT",
  "LOUIS", "MARC", "MATHIEU", "OLIVIER", "PATRICK", "PHILIPPE",
  "ROBERT", "STEPHANE", "THOMAS", "VICTOR", "WILLIAM", "ALBERT",
  "ARTHUR", "AUGUSTIN", "BENJAMIN", "CESAR", "DIEUDONNE", "ERIC",
  "FREDERIC", "GABRIEL", "GERARD", "GILBERT", "GUSTAVE", "HERVE",
  "HONORE", "ISAIE", "JEREMIE", "JEROME", "LEON", "LUC", "MARTIN",
  "MAURICE", "NICOLAS", "PASCAL", "PHILIP", "RAPHAEL", "RAYMOND",
  "RENE", "RICARDO", "RICHARD", "ROGER", "SERGE", "STEVE", "SYLVAIN",
  "THEOPHILE", "TIMOTHEE", "URBAIN", "VALENTIN", "YVES", "FELIX",
  "BENOIT", "CLAUDE", "DIDIER", "ELVIS", "FABRICE", "GAETAN",
  "HUBERT", "JOEL", "KEVIN", "LIONEL", "NOEL", "OSCAR",
  "PAPY", "ROMEO", "THIERRY", "ULRICH", "CLOVIS", "FISTON",
  "REGIS", "HARDY", "GLODY", "CEDRIC", "DELPHIN", "TRESOR",
  "DIEUDONNÉ", "JÉRÉMY", "OLIVIER", "BLAISE", "XAVIER",
  // Prénoms féminins courants
  "MARIE", "NADINE", "NICLETTE", "NICOLETTE", "CHANTAL", "BELLE",
  "DORCAS", "RUTH", "RACHEL", "SARAH", "JUDITH", "ESTHER", "GLORIA",
  "YVETTE", "JOSEPHINE", "CLAIRE", "CLAUDETTE", "CHRISTIANE",
  "MARGUERITE", "HELENE", "ALICE", "ROSE", "FRANCOISE", "VERONIQUE",
  "JACQUELINE", "DENISE", "CLAUDINE", "EMILIE", "VIRGINIE", "SUZANNE",
  "BRIGITTE", "NATHALIE", "AURELIE", "STEPHANIE", "LAETITIA", "PROMISE",
  "ESPERANCE", "ALINE", "CLARISSE", "NADÈGE", "GRACE", "PATIENCE",
  "BEATRICE", "ANGELE", "THERESE", "CECILE", "BERNADETTE", "CELESTINE",
  "GERTRUDE", "LEONORE", "PAULINE", "BLANDINE", "AIMEE", "MARIE",
  "ELVIRE", "SOLANGE", "YVONNE", "FÉLICITÉ", "JOSÉPHINE", "ADÈLE",
  "GLOIRE", "LUMIERE", "LUMIERE", "PROMESSE", "ESPOIR", "AMOUR", "FOI",
  "JOIE", "PAIX", "BONHEUR", "PATIENCE", "VICTOIRE", "TRÉSOR", "PERLE",
  // Mots religieux/spirituels souvent utilisés comme prénoms
  "DIEU", "SEIGNEUR", "ANGE", "GRACE", "FOI",
  // Particules et appellations génériques
  "DON", "BON", "PAPA", "MAMAN", "FILS", "FELLY",
  "PETIT", "GRAND", "JUNIOR", "JOHN", "MARY",
  // Termes anglophones communs en RDC
  "PRAISE", "BLESSING", "MERCY", "FAITH", "HOPE", "LOVE",
]);

/**
 * Vérifie que deux noms partagent au moins un mot discriminant
 * (non-prénom commun, ≥ 3 lettres). Protège contre la fusion de personnes
 * différentes qui partagent juste un prénom courant.
 */
function shareDiscriminantWord(a: string, b: string): boolean {
  const wordsA = a.toUpperCase().split(/\s+/).filter(w => w.length >= 3);
  const wordsB = new Set(b.toUpperCase().split(/\s+/).filter(w => w.length >= 3));

  for (const w of wordsA) {
    if (COMMON_FIRST_NAMES.has(w)) continue;
    if (wordsB.has(w)) return true;
  }
  return false;
}

/**
 * Vérifie si un nom est un préfixe de l'autre (forme normée, séparation aux mots).
 *
 * Ex : norm("KAPAMBU BUTA") = "KAPAMBU BUTA"
 *      norm("KAPAMBU BUTA TRIOMPHE") = "KAPAMBU BUTA TRIOMPHE"
 *      → isPrefixOf → true
 *
 * La séparation aux mots évite qu'un préfixe de chaîne pure sans espace
 * ne fasse matcher des noms non liés.
 */
function isPrefixOf(shorter: string, longer: string): boolean {
  if (shorter.length < MIN_PREFIX_LENGTH) return false;
  // Le préfixe doit correspondre à des mots entiers
  return longer === shorter || longer.startsWith(shorter + " ");
}

/**
 * Décide si deux entrées correspondent au même moniteur.
 *
 * Ordre d'évaluation :
 *  1. Préfixe/troncation  → fusion certaine si mot discriminant partagé
 *  2. Similarité ≥ seuil   → fusion si mot discriminant partagé
 *
 * La conscience de la ZS booste la confiance mais n'est pas un prérequis
 * (un moniteur peut opérer dans plusieurs ZS ou se tromper en saisissant la ZS).
 */
function areSamePerson(a: MonitorStats, b: MonitorStats, threshold: number): boolean {
  const normA = a.norm;
  const normB = b.norm;

  // --- Préfixe / troncation ---
  const [shorter, longer] = normA.length <= normB.length
    ? [normA, normB]
    : [normB, normA];
  const [shorterStats, longerStats] = normA.length <= normB.length
    ? [a, b]
    : [b, a];

  if (isPrefixOf(shorter, longer)) {
    // Exiger ≥ 2 mots non-triviaux distincts pour confirmer que c'est
    // bien la même personne et pas juste un nom de famille partagé.
    // Ex : "NLANDU KABEMBA" (2 mots discriminants) ✓
    //      "NLANDU" seul (1 mot) → trop ambigu, refusé.
    const meaningfulWords = shorter.split(" ").filter(w => w.length >= 3 && !COMMON_FIRST_NAMES.has(w));
    return meaningfulWords.length >= 2;
  }

  // --- Similarité Ratcliff/Obershelp ---
  const sim = similarity(a.raw, b.raw);
  if (sim >= threshold && shareDiscriminantWord(a.raw, b.raw)) {
    return true;
  }

  return false;
}

function findSimilarNames(
  monitors: Map<string, MonitorStats>,
  threshold: number = SIMILARITY_THRESHOLD
): MonitorCluster[] {
  const entries = Array.from(monitors.values());
  const clusters: MonitorCluster[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < entries.length; i++) {
    const stats1 = entries[i];
    if (processed.has(stats1.norm)) continue;

    const cluster: MonitorCluster = { canonical: stats1, variants: [] };

    for (let j = i + 1; j < entries.length; j++) {
      const stats2 = entries[j];
      if (processed.has(stats2.norm)) continue;

      if (areSamePerson(stats1, stats2, threshold)) {
        cluster.variants.push(stats2);
        processed.add(stats2.norm);
      }
    }

    if (cluster.variants.length > 0) {
      clusters.push(cluster);
    }
    processed.add(stats1.norm);
  }

  // Trier par volume total décroissant
  return clusters.sort((a, b) => {
    const volA = a.canonical.count + a.variants.reduce((s, v) => s + v.count, 0);
    const volB = b.canonical.count + b.variants.reduce((s, v) => s + v.count, 0);
    return volB - volA;
  });
}

/**
 * Choisit le nom canonique pour un cluster.
 *
 * Stratégie en deux étapes :
 *  1. Éliminer les variantes rares (< 3 % du total ou < 3 occurrences) :
 *     ce sont typiquement des fautes de frappe ou saisies erronées.
 *  2. Parmi les formes conservées, choisir la plus longue (la plus complète).
 *     En cas d'égalité de longueur, préférer la plus fréquente.
 *
 * Exemple :
 *   "KAPAMBU BUTA TRIOMPHE" (505x, 21 chars) vs "KAPAMABU BUTA TRIOMPHE" (1x, 22 chars)
 *   → "KAPAMABU" est filtrée (< 3 %), canonique = "KAPAMBU BUTA TRIOMPHE" ✓
 *
 *   "NLANDU KABEMBA" (7x) vs "NLANDU KABEMBA Hébreux" (509x, 22 chars)
 *   → les deux passent le filtre, canonique = "NLANDU KABEMBA Hébreux" (plus long) ✓
 */
function chooseCanonicalName(cluster: MonitorCluster): string {
  const allNames = [cluster.canonical, ...cluster.variants];
  const total = allNames.reduce((s, n) => s + n.count, 0);
  const minCount = Math.max(3, Math.floor(total * 0.03));

  // Garder uniquement les formes suffisamment fréquentes
  const qualified = allNames.filter(n => n.count >= minCount);
  const pool = qualified.length > 0 ? qualified : allNames; // fallback si tout est rare

  // Trier : plus long d'abord, puis plus fréquent
  const sorted = [...pool].sort((a, b) => {
    if (b.raw.length !== a.raw.length) return b.raw.length - a.raw.length;
    return b.count - a.count;
  });

  return sorted[0].raw;
}

// =============================================================================
// FILTRAGE DES VALEURS NON-VALIDES
// =============================================================================

function isValidMonitorName(raw: string): boolean {
  if (!raw || raw.length < 3) return false;
  const trimmed = raw.trim();

  const invalidValues = [
    "non connu", "inconnu", "aucun", "a definier",
    "sans objet", "nc", "ok", "oui", "non", "n/a", "na",
  ];
  if (invalidValues.includes(trimmed.toLowerCase())) return false;

  // Numéro de téléphone
  if (/^(\+?243)?[0-9\s-]{9,}$/.test(trimmed)) return false;

  // Principalement des chiffres (> 50 %)
  const digitCount = trimmed.replace(/[^0-9]/g, "").length;
  if (digitCount / trimmed.length > 0.5) return false;

  // Trop peu de lettres
  const letterCount = trimmed.replace(/[^a-zA-ZÀ-ÿ]/g, "").length;
  if (letterCount < 3) return false;

  return true;
}

// =============================================================================
// GÉNÉRATION DU FICHIER D'ALIASES
// =============================================================================

/**
 * Détecte les troncations à 1 mot, ZS par ZS.
 *
 * Pour chaque (norm 1-mot, ZS) : si UN SEUL moniteur "MOT XXX" est connu dans
 * cette ZS, on génère une entrée d'alias spécifique à la ZS.
 *
 * Exemple :
 *   "NLANDU" en KENGE        → "NLANDU KABEMBA Hébreux" (seul NLANDU XXX en KENGE)
 *   "NLANDU" en GOMBE_MATADI → "NLANDU KIMBUANA WINAND" (seul NLANDU XXX là-bas)
 *   "NLANDU" en NGIRI_NGIRI  → "Nlandu birbeline"
 *
 * Garde-fous :
 *  - Mot ≥ 4 chars, non-trivial (pas un prénom courant).
 *  - Dans la ZS donnée, EXACTEMENT 1 candidat "MOT XXX" non-ambigu.
 *
 * @returns Map norm 1-mot → Map ZS → raw canonique
 */
function findZsAwareTruncations(
  monitors: Map<string, MonitorStats>,
  normToCanonicalRaw: Map<string, string>,
): Map<string, Map<string, string>> {
  const result = new Map<string, Map<string, string>>();

  for (const [norm, stats] of monitors) {
    // Doit être un nom à 1 seul mot discriminant et ≥ 4 chars
    const meaningfulWords = norm.split(" ").filter(w => w.length >= 3 && !COMMON_FIRST_NAMES.has(w));
    if (meaningfulWords.length !== 1) continue;
    if (norm.length < 4) continue;
    if (stats.zsSet.size === 0) continue;

    // Pré-calcul : tous les "norm + ' ...'" candidats avec leur cible canonique et leur ZS
    const candidates: { canonicalNorm: string; canonicalRaw: string; zsSet: Set<string> }[] = [];
    for (const [norm2, stats2] of monitors) {
      if (norm2 === norm) continue;
      if (!norm2.startsWith(norm + " ")) continue;
      const targetRaw = normToCanonicalRaw.get(norm2) ?? stats2.raw;
      const targetNorm = normKey(targetRaw);
      candidates.push({ canonicalNorm: targetNorm, canonicalRaw: targetRaw, zsSet: stats2.zsSet });
    }

    if (candidates.length === 0) continue;

    // Pour chaque ZS du moniteur 1-mot, vérifier l'unicité du candidat dans cette ZS
    for (const zs of stats.zsSet) {
      const targetsInZs = new Map<string, string>(); // canonicalNorm → canonicalRaw
      for (const c of candidates) {
        if (c.zsSet.has(zs)) {
          targetsInZs.set(c.canonicalNorm, c.canonicalRaw);
        }
      }

      if (targetsInZs.size !== 1) continue; // 0 ou ≥ 2 candidats : ambigu, on saute

      const [targetRaw] = targetsInZs.values();
      if (!isValidMonitorName(targetRaw)) continue;

      if (!result.has(norm)) result.set(norm, new Map());
      result.get(norm)!.set(zs, targetRaw);
    }
  }

  return result;
}

function generateAliasesFile(
  clusters: MonitorCluster[],
  monitors: Map<string, MonitorStats>,
): Record<string, string> {
  const aliases: Record<string, string> = {};
  const normToCanonicalRaw = new Map<string, string>();

  // --- Phase 1 : alias issus du clustering multi-mots ---
  for (const cluster of clusters) {
    const canonical = chooseCanonicalName(cluster);
    if (!isValidMonitorName(canonical)) continue;

    const canonicalNorm = normKey(canonical);

    const allNames = [cluster.canonical, ...cluster.variants];
    for (const variant of allNames) {
      if (!isValidMonitorName(variant.raw)) continue;
      normToCanonicalRaw.set(variant.norm, canonical);
      if (variant.norm !== canonicalNorm) {
        aliases[variant.norm] = canonical;
      }
    }
  }
  // Pour les moniteurs hors-cluster : leur canonique = eux-mêmes
  for (const [norm, stats] of monitors) {
    if (!normToCanonicalRaw.has(norm)) {
      normToCanonicalRaw.set(norm, stats.raw);
    }
  }

  // Tri alphabétique des alias globaux
  const sortedAliases = Object.fromEntries(
    Object.entries(aliases).sort(([a], [b]) => a.localeCompare(b))
  );
  const outputPath = path.join(process.cwd(), "data", "dictionaries", "monitor.aliases.json");
  fs.writeFileSync(outputPath, JSON.stringify(sortedAliases, null, 2), "utf-8");
  console.log(`\n📁 Fichier d'alias global   : ${outputPath}`);
  console.log(`   → ${Object.keys(sortedAliases).length} variantes (multi-mots)`);

  // --- Phase 2 : alias ZS-aware pour les troncations à 1 mot ---
  const zsTruncations = findZsAwareTruncations(monitors, normToCanonicalRaw);
  const zsAliases: Record<string, Record<string, string>> = {};
  let totalZsAliases = 0;
  for (const [norm, perZs] of [...zsTruncations.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const sortedPerZs = Object.fromEntries(
      [...perZs.entries()].sort(([a], [b]) => a.localeCompare(b))
    );
    zsAliases[norm] = sortedPerZs;
    totalZsAliases += perZs.size;
  }

  const zsOutputPath = path.join(process.cwd(), "data", "dictionaries", "monitor.aliases.zs.json");
  fs.writeFileSync(zsOutputPath, JSON.stringify(zsAliases, null, 2), "utf-8");
  console.log(`📁 Fichier d'alias ZS-aware : ${zsOutputPath}`);
  console.log(`   → ${totalZsAliases} entrées sur ${Object.keys(zsAliases).length} noms 1-mot`);

  return sortedAliases;
}

// =============================================================================
// AFFICHAGE
// =============================================================================

function displayClusters(clusters: MonitorCluster[]): void {
  console.log("\n" + "=".repeat(70));
  console.log("📊 GROUPES DE VARIATIONS DÉTECTÉS");
  console.log("=".repeat(70));

  if (clusters.length === 0) {
    console.log("\n✅ Aucune variation détectée.");
    return;
  }

  for (let i = 0; i < Math.min(clusters.length, 50); i++) {
    const cluster = clusters[i];
    const canonical = chooseCanonicalName(cluster);
    const totalCount = cluster.canonical.count + cluster.variants.reduce((s, v) => s + v.count, 0);
    const allZs = new Set([...cluster.canonical.zsSet, ...cluster.variants.flatMap(v => [...v.zsSet])]);

    console.log(`\n${i + 1}. ✅ Canonique : "${canonical}"`);
    console.log(`   ZS : ${[...allZs].join(", ") || "?"}`);
    console.log(`   Total occurrences : ${totalCount}`);

    const variants = [cluster.canonical, ...cluster.variants].filter(v => v.raw !== canonical);
    if (variants.length > 0) {
      console.log("   Variantes :");
      for (const v of variants) {
        console.log(`      • "${v.raw}" (${v.count}x)`);
      }
    }
  }

  if (clusters.length > 50) {
    console.log(`\n   ... et ${clusters.length - 50} autres groupes (voir fichier d'alias)`);
  }
}

function displaySummary(monitors: Map<string, MonitorStats>, clusters: MonitorCluster[]): void {
  const totalVariants = clusters.reduce((s, c) => s + c.variants.length, 0);
  const totalSubs = Array.from(monitors.values()).reduce((s, m) => s + m.count, 0);
  const uniqueZs = new Set(Array.from(monitors.values()).flatMap(m => [...m.zsSet]));

  console.log("\n" + "=".repeat(70));
  console.log("📊 RÉSUMÉ");
  console.log("=".repeat(70));
  console.log(`   Zones de Santé couvertes          : ${uniqueZs.size}`);
  console.log(`   Noms uniques (avant harmonisation) : ${monitors.size}`);
  console.log(`   Noms uniques (après harmonisation) : ${monitors.size - totalVariants}`);
  console.log(`   Variantes harmonisées              : ${totalVariants}`);
  console.log(`   Soumissions totales analysées      : ${totalSubs}`);
}

function displayTopMonitors(monitors: Map<string, MonitorStats>): void {
  console.log("\n📋 TOP 20 DES MONITEURS (par fréquence) :");
  const sorted = Array.from(monitors.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i];
    const zsList = [...m.zsSet].slice(0, 3).join(", ");
    console.log(`   ${String(i + 1).padStart(2)}. "${m.raw}" (${m.count}x) — ZS: ${zsList || "?"}`);
  }
}

// =============================================================================
// POINT D'ENTRÉE
// =============================================================================

async function main(): Promise<void> {
  console.log("=".repeat(70));
  console.log("🔍 HARMONISATION DES NOMS DE MONITEURS v2");
  console.log("=".repeat(70));
  console.log(`Seuil de similarité   : ${SIMILARITY_THRESHOLD}`);
  console.log(`Longueur min. préfixe : ${MIN_PREFIX_LENGTH} chars`);
  console.log(`Nom canonique         : version la plus longue (la plus complète)`);

  try {
    console.log("\n📥 Extraction des noms de moniteurs...");
    const monitors = await extractMonitors();
    console.log(`\n   → ${monitors.size} noms uniques trouvés`);

    displayTopMonitors(monitors);

    console.log(`\n🔎 Recherche de similarités (préfixes + Ratcliff/Obershelp)...`);
    const clusters = findSimilarNames(monitors, SIMILARITY_THRESHOLD);
    console.log(`   → ${clusters.length} groupes de variations détectés`);

    displayClusters(clusters);
    displaySummary(monitors, clusters);

    console.log("\n💾 Génération du fichier d'alias...");
    generateAliasesFile(clusters, monitors);

    console.log("\n✅ Terminé !");
    console.log("💡 monitor.aliases.json sera appliqué automatiquement au prochain parsing.");

  } catch (error) {
    console.error("\n❌ Erreur :", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
