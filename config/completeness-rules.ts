/**
 * Règles de complétude et performance des soumissionnaires.
 *
 * Cibles journalières (validées par le coordonnateur, avril 2026) :
 *
 *  - Moniteur Indépendant (Indp_Monitor)
 *      ménages      : 30 ménages/jour (≈ 120 sur 4 jours de campagne)
 *      hors-ménage  :  2 points HM/jour
 *  - Autres profils (team_sup, District_sup, Other)
 *      ménages      : 10 ménages/jour (≈ 40 sur 4 jours)
 *      hors-ménage  :  2 points HM/jour
 *
 * Règle de COMPLÉTUDE géographique par jour :
 *  Pour chaque (province | antenne | ZS) et chaque jour, l'entité est
 *  couverte à 100 % si au moins UN formulaire a été soumis.
 */

export type MonitorProfile =
  | "Indp_Monitor"
  | "team_sup"
  | "District_sup"
  | "Other";

export interface DailyExpectation {
  profile: MonitorProfile;
  context: "Household" | "Outside";
  dailyTarget: number;
  label: string;
}

export const DAILY_EXPECTATIONS: DailyExpectation[] = [
  { profile: "Indp_Monitor", context: "Household", dailyTarget: 30, label: "Moniteur indépendant — ménages" },
  { profile: "Indp_Monitor", context: "Outside",   dailyTarget: 2,  label: "Moniteur indépendant — hors-ménages" },
  { profile: "team_sup",     context: "Household", dailyTarget: 10, label: "Superviseur équipe — ménages" },
  { profile: "team_sup",     context: "Outside",   dailyTarget: 2,  label: "Superviseur équipe — hors-ménages" },
  { profile: "District_sup", context: "Household", dailyTarget: 10, label: "Superviseur district — ménages" },
  { profile: "District_sup", context: "Outside",   dailyTarget: 2,  label: "Superviseur district — hors-ménages" },
  { profile: "Other",        context: "Household", dailyTarget: 10, label: "Autre — ménages" },
  { profile: "Other",        context: "Outside",   dailyTarget: 2,  label: "Autre — hors-ménages" },
];

/**
 * Règle de complétude géographique : combien de soumissions minimales
 * par jour et par unité organisationnelle pour compter "couvert à 100%".
 */
export const GEOGRAPHIC_COMPLETENESS = {
  minSubmissionsPerDay: {
    province: 1,
    antenne: 1,
    zs: 1,
  },
};

/** Jours de campagne attendus (par défaut 4 jours + J0 briefing). */
export const CAMPAIGN_ACTIVE_DAYS = 4;

/** Types de monitorage attendus selon le jour (1-based). */
export function expectedMonitoringType(dayIndex: number, totalDays = CAMPAIGN_ACTIVE_DAYS): "InProcess" | "EndProcess" {
  return dayIndex >= totalDays ? "EndProcess" : "InProcess";
}

/** Cible journalière pour un profil donné (Household par défaut). */
export function dailyTargetFor(profile: MonitorProfile, context: "Household" | "Outside" = "Household"): number | null {
  const match = DAILY_EXPECTATIONS.find(
    (e) => e.profile === profile && e.context === context
  );
  return match ? match.dailyTarget : null;
}

/** Libellé lisible d'un profil. */
export const PROFILE_LABELS: Record<MonitorProfile, string> = {
  Indp_Monitor: "Moniteur indépendant",
  team_sup: "Superviseur équipe",
  District_sup: "Superviseur district",
  Other: "Autre",
};
