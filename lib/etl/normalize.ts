/**
 * Normalisation des chaînes saisies à la main (localités, moniteurs, org units).
 *
 * Règles :
 *  - Trim
 *  - Espaces multiples -> un seul
 *  - UPPERCASE
 *  - Remplacement tirets/slashes/underscores/points/apostrophes par espace
 *  - Retrait diacritiques
 *  - Dictionnaire d'alias manuels (extensible via data/dictionaries/*.json)
 */

import aliasLocalities from "@/data/dictionaries/locality.aliases.json";
import aliasMonitors from "@/data/dictionaries/monitor.aliases.json";
import aliasMonitorsZs from "@/data/dictionaries/monitor.aliases.zs.json";
import { PROVINCE_ALIASES } from "@/config/provinces";

/** Normalisation robuste : produit la CLÉ canonique pour le matching. */
export function normKey(raw: string | null | undefined): string {
  if (!raw) return "";
  const no_diacritics = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return no_diacritics
    .toUpperCase()
    .replace(/[’'`]/g, "")
    .replace(/[-_/\\.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Met en forme "humaine" : Title Case, espaces simples. */
export function toHuman(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned
    .split(" ")
    .map((w) => (w.length <= 2 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

/**
 * Normalise un nom de localité (champ texte libre).
 *
 * Forme canonique en MAJUSCULES sans accents / tirets / underscores /
 * espaces multiples / ponctuation parasite. Un "S" final est retiré pour
 * absorber les pluriels. Ainsi, dans une même aire de santé :
 *   "Mavuba", "mavuba ", "MAVUBAS", "Mavuba-1" → "MAVUBA 1" / "MAVUBA"
 *
 * Un dictionnaire d'alias (data/dictionaries/locality.aliases.json)
 * permet de forcer une orthographe de référence si besoin.
 */
export function normalizeLocality(raw: string | null | undefined): {
  raw: string | null;
  norm: string;
  canonical: string | null;
} {
  if (!raw) return { raw: null, norm: "", canonical: null };
  const norm = normKey(raw);
  if (!norm) return { raw, norm: "", canonical: null };
  // Retire le "S" final des mots (pluriel) pour fusionner "MAVUBAS" avec "MAVUBA".
  const singular =
    norm
      .split(" ")
      .map((w) => (w.length > 3 && w.endsWith("S") ? w.slice(0, -1) : w))
      .join(" ")
      .trim() || norm;
  const dict = aliasLocalities as Record<string, string>;
  const aliased = dict[norm] ?? dict[singular];
  const canonical = aliased ? aliased.toUpperCase() : singular;
  return { raw, norm, canonical };
}

/**
 * Normalise un nom de moniteur (avec alias).
 *
 * Pour éviter les doublons dus aux variations de casse, espaces, tirets et
 * accents, la forme canonique est volontairement en MAJUSCULES avec espaces
 * simples, sans diacritiques ni ponctuation parasite. Ainsi :
 *   "Jean-Mbombo", "jean  mbombo", "Jéan Mbombo" → "JEAN MBOMBO"
 *
 * Si une ZS est fournie, l'alias ZS-aware est consulté EN PRIORITÉ.
 * Cela permet à un même nom court (ex. "NLANDU") de pointer vers des
 * personnes différentes selon la zone de santé :
 *   - "NLANDU" en KENGE       → "NLANDU KABEMBA Hébreux"
 *   - "NLANDU" en GOMBE_MATADI → "NLANDU KIMBUANA WINAND"
 */
export function normalizeMonitor(
  raw: string | null | undefined,
  zs?: string | null,
): {
  raw: string | null;
  norm: string;
  canonical: string | null;
} {
  if (!raw) return { raw: null, norm: "", canonical: null };
  const norm = normKey(raw);
  if (!norm) return { raw, norm: "", canonical: null };

  // 1. Alias ZS-aware (prioritaire)
  if (zs) {
    const zsKey = normKey(zs);
    const zsDict = aliasMonitorsZs as Record<string, Record<string, string>>;
    const zsEntry = zsDict[norm];
    if (zsEntry && zsEntry[zsKey]) {
      return { raw, norm, canonical: zsEntry[zsKey].toUpperCase() };
    }
  }

  // 2. Alias global
  const dict = aliasMonitors as Record<string, string>;
  const aliased = dict[norm];
  const canonical = aliased ? aliased.toUpperCase() : norm;
  return { raw, norm, canonical };
}

/**
 * Normalise une province vers sa forme canonique de la campagne.
 *
 * IMPORTANT : reste en Title Case (ex. "Kongo Central", "Kwango") car le
 * pipeline applique ensuite un filtre strict via le Set CAMPAIGN_PROVINCES
 * qui est en Title Case. Si on retournait UPPERCASE ici, le filtre
 * `restrictToCampaignProvinces` rejetterait 100% des soumissions et le
 * dashboard afficherait 0 partout.
 */
export function normalizeProvince(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const k = normKey(raw);
  // Si pas d'alias : on Title-Case la forme normalisée (où underscores/tirets
  // sont déjà devenus des espaces), sinon "Haut_lomami" et "Haut Lomami"
  // resteraient comme deux provinces distinctes.
  return (PROVINCE_ALIASES as Record<string, string>)[k] ?? toHuman(k);
}

/**
 * Normalise ZS / AS / Antenne vers une forme canonique en MAJUSCULES,
 * sans tirets/underscores/diacritiques, avec espaces simples.
 *
 * Objectif : fusionner "mfimi_1", "Mfimi 1", "MFIMI-1", "mfimi  1"
 * → "MFIMI 1" pour que la cascade Province→Antenne→ZS→AS→Localité
 * ne subisse plus de doublons typographiques.
 */
export function normalizeOrgLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = normKey(raw);
  return key || null;
}
