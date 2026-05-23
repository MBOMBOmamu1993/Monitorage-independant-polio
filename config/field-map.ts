/**
 * Mapping ODK <-> modèle de domaine.
 *
 * Pourquoi un mapping paramétrable ?
 * -----------------------------------
 * Les deux formulaires RR-Polio (ménage 16244 et hors-ménage 4499) peuvent
 * avoir des champs nommés différemment (ex. "Province" vs "Region",
 * "aire_sante" vs "health_facility"). Plutôt que de coder en dur chaque
 * variante, on déclare un tableau ordonné de clés candidates et on prend
 * la première qui existe dans la soumission.
 *
 * Si le schéma change, on ajuste ce fichier SANS toucher au reste.
 */

export type Candidates = string[];

export interface FieldMap {
  province: Candidates;
  antenne: Candidates;
  zs: Candidates;
  as: Candidates;
  locality: Candidates;
  gpsString: Candidates; // "lat lng alt accuracy"
  geolocation: Candidates; // [lat, lng]
  monitorName: Candidates;
  monitorProfile: Candidates;
  monitoringDate: Candidates;
  submissionTime: Candidates;
  monitoringType: Candidates;
  settlementType: Candidates;

  parentInformed: Candidates;
  infoChannels: Candidates;

  // Agrégats ménage (déjà calculés par l'app ODK)
  totU5Present: Candidates;
  tot0_11Present: Candidates;
  tot6_14Present: Candidates;
  tot12_59Present: Candidates;
  u5VacFM: Candidates;

  // Décomposition Absents / NC / etc. (valeurs ENTIÈRES pour les compteurs)
  childAbsentTotal: Candidates;
  childAsleep: Candidates;
  childHfTooFar: Candidates;
  childNonCompliance: Candidates; // Refus
  childNoHwPresent: Candidates;
  childOthers: Candidates;
  childVaccinatedRoutine: Candidates;

  absFarm: Candidates;
  absMarket: Candidates;
  absOther: Candidates;
  absParentAbsent: Candidates;
  absPlayAreas: Candidates;
  absSchool: Candidates;
  absSocialEvent: Candidates;
  absTravelling: Candidates;

  // Détail Refus
  refusalReligion: Candidates;
  refusalTradition: Candidates;
  refusalNoTrust: Candidates;
  refusalFearSideEffects: Candidates;
  refusalTooManyDoses: Candidates;
  refusalChildSick: Candidates;
  refusalNotDecisionMaker: Candidates;
  refusalOther: Candidates;

  // Détail Absence
  absentTravel: Candidates;
  absentSchool: Candidates;
  absentMarket: Candidates;
  absentOther: Candidates;

  // Repeat RR (par enfant)
  rrRepeat: Candidates;

  // Numbers
  numberAFP: Candidates;
  numberMeasles: Candidates;

  // Commentaire
  comment: Candidates;
}

/**
 * Mapping pour le formulaire MÉNAGE (DRC_SIA_IM_Households — XForm 4498).
 *
 * Les noms ci-dessous correspondent aux champs RÉCAPITULATIFS de niveau
 * soumission (rollups plats : "Total_U5_Present", "TotalFM", "Total_refusal",
 * "Tot_child_Abs_Market_T", ...). Le repeat "HH" (un objet par ménage, champs
 * préfixés "group1/…_HH") n'est PAS utilisé : on agrège au niveau soumission.
 */
export const HOUSEHOLD_FIELD_MAP: FieldMap = {
  province: ["Region", "Province", "province", "region"],
  antenne: ["Antenne", "antenne"],
  zs: ["District", "ZS", "zs", "district"],
  as: ["facility", "fosaName", "aire_sante", "AS", "as", "health_facility"],
  locality: ["Village_Name", "Settlement_name", "settlement_name", "localite", "Localite"],
  gpsString: ["GPS_hh", "gps_hh", "GPS", "gps"],
  geolocation: ["_geolocation"],
  monitorName: ["Name_of_Monitor", "name_of_monitor", "Monitor_Name"],
  monitorProfile: ["Monitored_Level", "monitored_level", "monitor_profile"],
  monitoringDate: ["date_monitored", "today", "Date_Monitoring"],
  submissionTime: ["_submission_time"],
  monitoringType: ["Type_Monitoring", "type_monitoring"],
  settlementType: ["Settlement_Type", "settlement_type"],

  parentInformed: ["Sum_caregiverAwareness", "Parent_Caregive_Inform_HH", "parent_caregive_inform_hh"],
  infoChannels: ["Source_Info_SIA_HH", "source_info_sia_hh"],

  totU5Present: ["Total_U5_Present", "Total_U5_Present_HH"],
  tot0_11Present: ["Total_0_11_Present_HH"],
  tot6_14Present: ["Total_6_14_Present_HH"],
  tot12_59Present: ["Total_12_59_Present_HH"],
  u5VacFM: ["TotalFM", "U5_Vac_FM_HH", "U5_Vac_FM_HH1"],

  childAbsentTotal: ["Total_Absent", "group1/Tot_child_Absent_HH"],
  childAsleep: ["TOT_Child_Asleep", "group1/Tot_child_Asleep_HH"],
  childHfTooFar: ["group1/Tot_child_HF_tooFar"],
  childNonCompliance: ["Total_refusal", "group1/Tot_child_NC_HH"], // Refus
  childNoHwPresent: ["Total_Noteam", "group1/Tot_child_No_Hwpresent"],
  childOthers: ["Tot_child_Others_HH_T", "group1/Tot_child_Others_HH"],
  childVaccinatedRoutine: ["Tot_child_Vac_Routine", "group1/Tot_child_VaccinatedRoutine"],

  absFarm: ["Tot_child_Abs_Farm_T", "group2/Tot_child_Abs_Farm"],
  absMarket: ["Tot_child_Abs_Market_T", "group2/Tot_child_Abs_Market"],
  absOther: ["Tot_child_Abs_Other_T", "group2/Tot_child_Abs_Other"],
  absParentAbsent: ["Sum_child_Abs_Parent_Absent", "group2/Tot_child_Abs_Parent_Absent"],
  absPlayAreas: ["Tot_child_Abs_Play_areas_T", "group2/Tot_child_Abs_Play_areas"],
  absSchool: ["Tot_child_Abs_School_T", "group2/Tot_child_Abs_School"],
  absSocialEvent: ["Tot_child_Abs_SocialEvent", "group2/Tot_child_Abs_Social_event"],
  absTravelling: ["Sum_child_Abs_Travelling", "group2/Tot_child_Abs_Travelling"],

  refusalReligion: ["Tot_child_NC_Religious_beliefs_T", "group4/Tot_child_NC_beliefs"],
  refusalTradition: ["group1/Tot_child_NC_Tradition"],
  refusalNoTrust: ["group1/Tot_child_NC_NoTrust"],
  refusalFearSideEffects: ["Tot_child_NC_sideEffects", "group4/Tot_child_SideEffects"],
  refusalTooManyDoses: ["Sum_Too_many_doses", "group4/Tot_child_NC_Too_many_doses"],
  refusalChildSick: ["Sum_Child_sick", "group4/Tot_child_NC_Child_was_sick"],
  refusalNotDecisionMaker: ["group4/Tot_child_NC_Child_not_me"],
  refusalOther: ["Sum_NC_Others", "Sum_NC_COVID", "group4/Tot_child_NC_Other"],

  absentTravel: ["Sum_child_Abs_Travelling"],
  absentSchool: ["Tot_child_Abs_School_T"],
  absentMarket: ["Tot_child_Abs_Market_T"],
  absentOther: ["Tot_child_Abs_Other_T"],

  rrRepeat: ["personnes_rr"],
  numberAFP: ["afp_case_T", "Number_AFP"],
  numberMeasles: ["Number_Measles"],
  comment: ["summary1/comments", "comments"],
};

/**
 * Mapping pour le formulaire HORS-MÉNAGE (XForm id 4499).
 *
 * Hypothèse : mêmes racines que le ménage mais suffixes "_OSH" ou "_OH" au lieu de "_HH".
 * Ajuster via l'introspection /api/odk/introspect si la réalité diffère.
 */
export const OUTSIDE_FIELD_MAP: FieldMap = {
  province: ["Region", "region", "Province", "province"],
  antenne: ["Antenne", "antenne"],
  zs: ["District", "district", "ZS", "zs"],
  as: ["facility", "fosaName", "health_facility", "aire_sante", "AS", "as"],
  locality: ["Settlement_name", "settlement_name", "localite", "Localite"],
  gpsString: ["GPS_osh", "GPS_OSH", "gps_osh", "GPS_hh", "gps_hh", "GPS", "gps"],
  geolocation: ["_geolocation"],
  monitorName: ["Name_of_Monitor", "name_of_monitor", "Monitor_Name"],
  monitorProfile: ["Monitored_Level", "monitored_level", "monitor_profile"],
  monitoringDate: ["date_monitored", "today", "Date_Monitoring"],
  submissionTime: ["_submission_time"],
  monitoringType: ["Type_Monitoring", "type_monitoring"],
  settlementType: ["Settlement_Type", "settlement_type"],

  parentInformed: [
    "Sum_caregiverAwareness",
    "Parent_Caregive_Inform_OSH", "Parent_Caregive_Inform_OH",
    "Parent_Caregive_Inform_HH",
  ],
  infoChannels: ["Source_Info_SIA_OSH", "Source_Info_SIA_OH", "Source_Info_SIA_HH"],

  // Comptes enfants : on tente _OSH, _OH et variantes, fallback _HH.
  totU5Present: [
    "OHH_count", "Total_U5_Present_OSH", "Total_U5_Present_OH", "Total_U5_Present",
    "Total_U5_Present_HH", "OHH/Child_Checked", "Child_Checked", "child_checked"
  ],
  tot0_11Present: ["Total_0_11_Present_OSH", "Total_0_11_Present_OH", "Total_0_11_Present_HH"],
  tot6_14Present: ["Total_6_14_Present_OSH", "Total_6_14_Present_OH", "Total_6_14_Present_HH"],
  tot12_59Present: ["Total_12_59_Present_OSH", "Total_12_59_Present_OH", "Total_12_59_Present_HH"],
  u5VacFM: [
    "U5_Vac_FM_OSH", "U5_Vac_FM_OH", "U5_Vac_FM",
    "U5_Vac_FM_HH", "U5_Vac_FM_HH1",
    "OHH/Child_FMD", "Child_FMD", "child_fmd", "TotalFM"
  ],

  // Décomposition Absents / NC / etc. — avec suffixes OSH/OH + fallback HH
  childAbsentTotal: [
    "Total_Absent",
    "group1/Tot_child_Absent_OSH", "group1/Tot_child_Absent_OH",
    "group1/Tot_child_Absent_HH",
  ],
  childAsleep: [
    "TOT_Child_Asleep",
    "group1/Tot_child_Asleep_OSH", "group1/Tot_child_Asleep_OH",
    "group1/Tot_child_Asleep_HH",
  ],
  childHfTooFar: [
    "group1/Tot_child_HF_tooFar_OSH", "group1/Tot_child_HF_tooFar_OH",
    "group1/Tot_child_HF_tooFar_HH",
  ],
  childNonCompliance: [
    "Total_refusal",
    "group1/Tot_child_NC_OSH", "group1/Tot_child_NC_OH",
    "group1/Tot_child_NC_HH",
  ],
  childNoHwPresent: [
    "Total_Noteam",
    "group1/Tot_child_No_Hwpresent_OSH", "group1/Tot_child_No_Hwpresent_OH",
    "group1/Tot_child_No_Hwpresent_HH",
  ],
  childOthers: [
    "Tot_child_Others_HH_T",
    "group1/Tot_child_Others_OSH", "group1/Tot_child_Others_OH",
    "group1/Tot_child_Others_HH",
  ],
  childVaccinatedRoutine: [
    "Tot_child_Vac_Routine",
    "group1/Tot_child_VaccinatedRoutine_OSH", "group1/Tot_child_VaccinatedRoutine_OH",
    "group1/Tot_child_VaccinatedRoutine_HH",
  ],

  absFarm: [
    "Tot_child_Abs_Farm_T",
    "group2/Tot_child_Abs_Farm_OSH", "group2/Tot_child_Abs_Farm_OH",
    "group2/Tot_child_Abs_Farm_HH",
  ],
  absMarket: [
    "Tot_child_Abs_Market_T",
    "group2/Tot_child_Abs_Market_OSH", "group2/Tot_child_Abs_Market_OH",
    "group2/Tot_child_Abs_Market_HH",
  ],
  absOther: [
    "Tot_child_Abs_Other_T",
    "group2/Tot_child_Abs_Other_OSH", "group2/Tot_child_Abs_Other_OH",
    "group2/Tot_child_Abs_Other_HH",
  ],
  absParentAbsent: [
    "Sum_child_Abs_Parent_Absent",
    "group2/Tot_child_Abs_Parent_Absent_OSH", "group2/Tot_child_Abs_Parent_Absent_OH",
    "group2/Tot_child_Abs_Parent_Absent_HH",
  ],
  absPlayAreas: [
    "Tot_child_Abs_Play_areas_T",
    "group2/Tot_child_Abs_Play_areas_OSH", "group2/Tot_child_Abs_Play_areas_OH",
    "group2/Tot_child_Abs_Play_areas_HH",
  ],
  absSchool: [
    "Tot_child_Abs_School_T",
    "group2/Tot_child_Abs_School_OSH", "group2/Tot_child_Abs_School_OH",
    "group2/Tot_child_Abs_School_HH",
  ],
  absSocialEvent: [
    "Tot_child_Abs_SocialEvent",
    "group2/Tot_child_Abs_Social_event_OSH", "group2/Tot_child_Abs_Social_event_OH",
    "group2/Tot_child_Abs_Social_event_HH",
  ],
  absTravelling: [
    "Sum_child_Abs_Travelling",
    "group2/Tot_child_Abs_Travelling_OSH", "group2/Tot_child_Abs_Travelling_OH",
    "group2/Tot_child_Abs_Travelling_HH",
  ],

  // Détail Refus — avec suffixes OSH/OH + fallback HH
  refusalReligion: [
    "Tot_child_NC_Religious_beliefs_T",
    "group4/Tot_child_NC_beliefs_OSH", "group1/Tot_child_NC_Religion_OSH",
    "group4/Tot_child_NC_beliefs_OH", "group1/Tot_child_NC_Religion_OH",
    "group4/Tot_child_NC_beliefs", "group1/Tot_child_NC_Religion",
    "group1/Tot_child_NC_Religion_HH",
  ],
  refusalTradition: [
    "group1/Tot_child_NC_Tradition_OSH", "group1/Tot_child_NC_Tradition_OH",
    "group1/Tot_child_NC_Tradition_HH",
  ],
  refusalNoTrust: [
    "group1/Tot_child_NC_NoTrust_OSH", "group1/Tot_child_NC_NoTrust_OH",
    "group1/Tot_child_NC_NoTrust_HH",
  ],
  refusalFearSideEffects: [
    "Tot_child_NC_sideEffects",
    "group4/Tot_child_SideEffects_OSH", "group1/Tot_child_NC_FearSideEffects_OSH",
    "group4/Tot_child_SideEffects_OH", "group1/Tot_child_NC_FearSideEffects_OH",
    "group4/Tot_child_SideEffects", "group1/Tot_child_NC_FearSideEffects",
    "group1/Tot_child_NC_FearSideEffects_HH",
  ],
  refusalTooManyDoses: [
    "Sum_Too_many_doses",
    "group4/Tot_child_NC_Too_many_doses_OSH", "group4/Tot_child_NC_Too_many_doses_OH",
    "group4/Tot_child_NC_Too_many_doses",
  ],
  refusalChildSick: [
    "Sum_Child_sick",
    "group4/Tot_child_NC_Child_was_sick_OSH", "group4/Tot_child_NC_Child_was_sick_OH",
    "group4/Tot_child_NC_Child_was_sick",
  ],
  refusalNotDecisionMaker: [
    "group4/Tot_child_NC_Child_not_me_OSH", "group4/Tot_child_NC_Child_not_me_OH",
    "group4/Tot_child_NC_Child_not_me",
  ],
  refusalOther: [
    "Sum_NC_Others", "Sum_NC_COVID",
    "group4/Tot_child_NC_Other_OSH", "group1/Tot_child_NC_Other_OSH",
    "group4/Tot_child_NC_Other_OH", "group1/Tot_child_NC_Other_OH",
    "group4/Tot_child_NC_Other", "group1/Tot_child_NC_Other",
    "group1/Tot_child_NC_Other_HH",
  ],

  absentTravel: [
    "group2/Tot_child_Abs_Travelling_OSH", "group2/Tot_child_Abs_Travelling_OH",
    "group2/Tot_child_Abs_Travelling_HH",
  ],
  absentSchool: [
    "group2/Tot_child_Abs_School_OSH", "group2/Tot_child_Abs_School_OH",
    "group2/Tot_child_Abs_School_HH",
  ],
  absentMarket: [
    "group2/Tot_child_Abs_Market_OSH", "group2/Tot_child_Abs_Market_OH",
    "group2/Tot_child_Abs_Market_HH",
  ],
  absentOther: [
    "group2/Tot_child_Abs_Other_OSH", "group2/Tot_child_Abs_Other_OH",
    "group2/Tot_child_Abs_Other_HH",
  ],

  rrRepeat: ["OHH", "personnes_rr"],
  numberAFP: ["afp_case_T", "Number_AFP"],
  numberMeasles: ["Number_Measles"],
  comment: ["summary1/comments", "comments"],
};

/** Retourne la 1re valeur trouvée parmi les clés candidates. */
export function pick<T = unknown>(record: Record<string, unknown>, candidates: Candidates): T | undefined {
  for (const key of candidates) {
    const v = record[key];
    if (v !== undefined && v !== null && v !== "") return v as T;
  }
  return undefined;
}

/** Idem mais retourne `string | null` en coerçant proprement. */
export function pickStr(record: Record<string, unknown>, candidates: Candidates): string | null {
  const v = pick(record, candidates);
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/** Idem mais retourne `number | null`. */
export function pickNum(record: Record<string, unknown>, candidates: Candidates): number | null {
  const v = pick(record, candidates);
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
