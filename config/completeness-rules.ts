/**
 * Règles de complétude et performance des soumissionnaires.
 *
 * IMPORTANT — unité de comptage : les soumissions sont comptées en
 * FORMULAIRES (1 formulaire ménage = 10 ménages). Toutes les cibles
 * ci-dessous sont donc exprimées en formulaires/jour, pas en ménages.
 *
 * Cibles journalières (en formulaires) :
 *
 *  - Moniteur Indépendant (Indp_Monitor) — travaille 4 jours
 *    (2 jours in process + 2 jours end process)
 *      in process  : 3 form. ménages/jour + 2 form. hors-ménages/jour
 *      end process : 3 form. ménages/jour + 2 form. hors-ménages/jour
 *  - Autres profils (team_sup, District_sup, Other) — travaillent
 *    uniquement en in process, 2 jours
 *      in process  : 3 form. ménages/jour + 2 form. hors-ménages/jour
 *      end process : aucune cible (ils ne travaillent pas en end process)
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
  { profile: "Indp_Monitor", context: "Household", dailyTarget: 3, label: "Moniteur indépendant — formulaires ménages" },
  { profile: "Indp_Monitor", context: "Outside",   dailyTarget: 2, label: "Moniteur indépendant — formulaires hors-ménages" },
  { profile: "team_sup",     context: "Household", dailyTarget: 3, label: "Superviseur équipe — formulaires ménages" },
  { profile: "team_sup",     context: "Outside",   dailyTarget: 2, label: "Superviseur équipe — formulaires hors-ménages" },
  { profile: "District_sup", context: "Household", dailyTarget: 3, label: "Superviseur district — formulaires ménages" },
  { profile: "District_sup", context: "Outside",   dailyTarget: 2, label: "Superviseur district — formulaires hors-ménages" },
  { profile: "Other",        context: "Household", dailyTarget: 3, label: "Autre — formulaires ménages" },
  { profile: "Other",        context: "Outside",   dailyTarget: 2, label: "Autre — formulaires hors-ménages" },
];

export type MonitoringTypeFilter = "all" | "InProcess" | "EndProcess";

export interface ExpectedTargets {
  /** Formulaires ménages attendus/jour (null = pas de cible). */
  household: number | null;
  /** Formulaires hors-ménages attendus/jour (null = pas de cible). */
  outside: number | null;
}

/**
 * Cible journalière en FORMULAIRES selon le profil et le type de monitorage.
 *
 *  - In process (ou « all ») : tous les profils visent 3 form. ménages
 *    + 2 form. hors-ménages par jour.
 *  - End process : seuls les moniteurs indépendants travaillent
 *    (3 form. ménages + 2 form. hors-ménages/jour). Les autres profils
 *    n'ont aucune cible en end process → complétude non calculée.
 */
export function expectedFormsPerDay(
  profile: MonitorProfile,
  monitoringType: MonitoringTypeFilter,
): ExpectedTargets {
  const isIndependent = profile === "Indp_Monitor";
  if (monitoringType === "EndProcess" && !isIndependent) {
    return { household: null, outside: null };
  }
  return { household: 3, outside: 2 };
}

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
