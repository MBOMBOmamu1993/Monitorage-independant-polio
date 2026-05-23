/**
 * Taxonomie des raisons de non-vaccination, absences, refus, canaux d'info.
 *
 * Les libellés bruts viennent des formulaires ODK (valeurs en anglais ou
 * français, parfois multi-sélection séparée par espaces).
 * On les mappe vers des catégories canoniques pour l'analyse.
 */

import type { ReasonCategory } from "@/lib/types/domain";

/** Mapping d'un libellé absences (groupe2) vers une catégorie de raison. */
export const ABSENCE_LABELS: Array<{ field: string; label: string; category: ReasonCategory }> = [
  { field: "absFarm", label: "Champ / ferme", category: "ABSENCE" },
  { field: "absMarket", label: "Marché", category: "ABSENCE" },
  { field: "absParentAbsent", label: "Parents absents", category: "ABSENCE" },
  { field: "absPlayAreas", label: "Aires de jeu", category: "ABSENCE" },
  { field: "absSchool", label: "École", category: "ABSENCE" },
  { field: "absSocialEvent", label: "Événement social", category: "ABSENCE" },
  { field: "absTravelling", label: "Voyage", category: "ABSENCE" },
  { field: "absOther", label: "Autre", category: "AUTRE" },
];

/** Décomposition d'un enfant non vacciné par sous-catégorie (group1). */
export const NON_VAX_BREAKDOWN: Array<{ field: string; label: string; category: ReasonCategory }> = [
  { field: "childAbsentTotal", label: "Absent", category: "ABSENCE" },
  { field: "childAsleep", label: "Endormi", category: "AUTRE" },
  { field: "childHfTooFar", label: "FOSA trop loin", category: "AUTRE" },
  { field: "childNonCompliance", label: "Refus", category: "REFUS" },
  { field: "childNoHwPresent", label: "Aucun agent santé présent", category: "EQUIPE_NON_PASSEE" },
  { field: "childOthers", label: "Autres raisons", category: "AUTRE" },
  { field: "childVaccinatedRoutine", label: "Déjà vacciné en routine", category: "DEJA_VACCINE_AILLEURS" },
];

/**
 * Normalisation des canaux d'information.
 * Les valeurs ODK viennent en multi-select séparé par des espaces :
 *   "TV Gong_gong Health_worker Volunteers Religious_leader"
 */
export const INFORMATION_CHANNELS: Record<string, string> = {
  TV: "Télévision",
  Radio: "Radio",
  Gong_gong: "Gong-gong",
  Health_worker: "Agent de santé",
  Volunteers: "Volontaires",
  Religious_leader: "Leader religieux",
  Com_Info_centre: "Centre d'information communautaire",
  Mosque: "Mosquée",
  Church: "Église",
  Social_media: "Réseaux sociaux",
  Newspaper: "Presse écrite",
  School: "École",
  Caregiver: "Soignant",
  Other: "Autre",
};

/** Version canonique d'un canal : renvoie le libellé lisible ou la clé brute. */
export function humanChannel(raw: string): string {
  const k = raw.trim();
  return INFORMATION_CHANNELS[k] ?? INFORMATION_CHANNELS[k.replace(/\s+/g, "_")] ?? k;
}

/**
 * Classification du risque de couverture (inspirée End-Process RR).
 *   ≥ 95 %     : objectif atteint (GREEN)
 *   90 – 94 %  : alerte (YELLOW)
 *   < 90 %     : critique (RED)
 */
export function classifyCoverage(pct: number | null | undefined): "GREEN_GE_95" | "YELLOW_90_94" | "RED_LT_90" | "UNKNOWN" {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return "UNKNOWN";
  if (pct >= 95) return "GREEN_GE_95";
  if (pct >= 90) return "YELLOW_90_94";
  return "RED_LT_90";
}

export const COVERAGE_LABEL: Record<string, string> = {
  GREEN_GE_95: "≥ 95 % (objectif atteint)",
  YELLOW_90_94: "90 – 94 % (alerte)",
  RED_LT_90: "< 90 % (critique)",
  UNKNOWN: "Couverture indéterminée",
};

export const COVERAGE_COLOR: Record<string, string> = {
  GREEN_GE_95: "#178a44",
  YELLOW_90_94: "#f29e0b",
  RED_LT_90: "#c81e1e",
  UNKNOWN: "#94a3b8",
};

/**
 * Raisons de non-vaccination RR (catalogue issu du formulaire ODK).
 *
 * Champ ODK : `personnes_rr/statut_global_rr_grp/raison_non_vacc_rr`
 * Le formulaire renvoie des codes numériques 1..16.
 *
 * Catégorie :
 *   - OFFRE   : raisons qui empêchent le système d'apporter le service
 *               (vaccin/vaccinateur indisponible, séance annulée, site/horaire
 *               non connu, longue attente, site trop éloigné).
 *   - DEMANDE : le service est accessible mais la population refuse/évite
 *               (peur, croyances religieuses, rumeurs, maladie, coût, etc.).
 *
 * L'ordre des codes suit la convention XLSForm (Offre puis Demande, Autre
 * en dernier). Si la liste doit être corrigée, modifier ce tableau
 * uniquement — toute la chaîne ETL + UI s'adaptera automatiquement.
 */
export type RrReasonCategory = "OFFRE" | "DEMANDE";

export interface RrNonVaxReasonDef {
  code: string;           // code ODK (1..16) ou slug équivalent
  label: string;          // libellé FR tel que présenté dans le rapport End-Process
  category: RrReasonCategory;
  aliases?: string[];     // variantes de saisie (libellés libres, slugs XLSForm)
}

/** Raisons spécifiques de refus Polio fournies par l'utilisateur */
export const POLIO_REFUSAL_REASONS: Array<{ code: string; label: string }> = [
  { code: "religion", label: "Croyance religieuse" },
  { code: "side_effects", label: "Effets secondaires" },
  { code: "too_many_doses", label: "Trop de doses" },
  { code: "child_sick", label: "L'enfant était malade" },
  { code: "not_decision_maker", label: "Ce n'est pas moi qui décide" },
  { code: "other", label: "Autre" },
];

export const RR_NON_VAX_REASONS: RrNonVaxReasonDef[] = [
  { code: "1",  label: "Censure religieuse",                           category: "DEMANDE", aliases: ["censure_religieuse", "religion"] },
  { code: "2",  label: "Tradition / Coutume",                          category: "DEMANDE", aliases: ["tradition"] },
  { code: "3",  label: "Manque de confiance",                          category: "DEMANDE", aliases: ["pas_confiance"] },
  { code: "4",  label: "Peur des effets secondaires",                  category: "DEMANDE", aliases: ["peur_effets_secondaires", "peur_effets"] },
  { code: "5",  label: "Vaccin non disponible",                        category: "OFFRE",   aliases: ["vaccin_non_disponible"] },
  { code: "6",  label: "Vaccinateur absent",                           category: "OFFRE",   aliases: ["vaccinateur_absent"] },
  { code: "7",  label: "Séance de vaccination annulée",                category: "OFFRE",   aliases: ["seance_annulee", "séance_annulée"] },
  { code: "8",  label: "Site de vaccination trop éloigné",             category: "OFFRE",   aliases: ["site_trop_eloigne", "site_trop_éloigné"] },
  { code: "9",  label: "Longue attente",                               category: "OFFRE",   aliases: ["longue_attente"] },
  { code: "10", label: "Site et/ou horaire non connu",                 category: "OFFRE",   aliases: ["site_horaire_non_connu"] },
  { code: "11", label: "Coût élevé de la vaccination",                 category: "OFFRE",   aliases: ["cout_eleve", "coût_élevé"] },
  { code: "12", label: "Moment de vaccination inopportun",             category: "DEMANDE", aliases: ["moment_inopportun"] },
  { code: "13", label: "Rumeurs",                                      category: "DEMANDE", aliases: ["rumeurs"] },
  { code: "14", label: "Personne malade",                              category: "DEMANDE", aliases: ["personne_malade", "malade"] },
  { code: "15", label: "Gardien(ne) trop occupée",                     category: "DEMANDE", aliases: ["gardien_occupe", "gardienne_occupee"] },
  { code: "16", label: "Autre (deuil, etc.)",                          category: "DEMANDE", aliases: ["autre", "other"] },
];

/** Couleurs — convention rapport : Offre = rouge, Demande = bleu. */
export const RR_REASON_COLORS: Record<RrReasonCategory, string> = {
  OFFRE: "#c81e1e",
  DEMANDE: "#1f6bff",
};

const RR_REASON_INDEX: Map<string, RrNonVaxReasonDef> = (() => {
  const m = new Map<string, RrNonVaxReasonDef>();
  for (const r of RR_NON_VAX_REASONS) {
    m.set(r.code, r);
    m.set(r.code.toLowerCase(), r);
    m.set(normRr(r.label), r);
    for (const a of r.aliases ?? []) m.set(normRr(a), r);
  }
  return m;
})();

function normRr(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Résout un libellé ou un code brut (ODK) vers la définition canonique. */
export function resolveRrReason(raw: string | null | undefined): RrNonVaxReasonDef | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  return (
    RR_REASON_INDEX.get(s) ??
    RR_REASON_INDEX.get(s.toLowerCase()) ??
    RR_REASON_INDEX.get(normRr(s)) ??
    null
  );
}
