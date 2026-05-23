/**
 * Modèle de données du domaine (après ETL).
 * Ces types alimentent tous les indicateurs, tables et visualisations.
 */

export type Sex = "M" | "F" | "UNKNOWN";

export type MonitoringType = "InProcess" | "EndProcess" | "UNKNOWN";
export type MonitoringContext = "Household" | "Outside";

export type VaccinationResponse = "Oui" | "Non" | "Absent" | "Refus" | "Autre" | "Inconnu";

export interface OrgUnitRef {
  province: string;
  antenne: string | null;
  zs: string | null;
  as: string | null;
  locality: string | null;
  localityRaw?: string | null;
  localityNormKey?: string | null;
}

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy?: number | null;
}

/** Niveau de risque couverture (inspiré End-Process). */
export type CoverageRiskClass = "GREEN_GE_95" | "YELLOW_90_94" | "RED_LT_90" | "UNKNOWN";

export interface SubmissionStats {
  totU5: number;
  vacU5: number;
  nonVacU5: number;
  refusals: number;
  absences: number;
  notReachedTeam: number;
  alreadyRoutine: number;
  // Décomposition Non-vaccination (depuis group1)
  childAsleep: number;     // Endormi
  childHfTooFar: number;   // HF trop loin (assimilé "Non revisité")
  childOthers: number;     // Autres
  parentInformed: boolean | null;
  infoChannels: string[];
  // Refusals detail (group1/Tot_child_NC_* ou group4/Tot_child_NC_*)
  refusalReligion: number;
  refusalFearSideEffects: number;
  refusalTooManyDoses: number;
  refusalChildSick: number;
  refusalNotDecisionMaker: number;
  refusalNoTrust: number;
  refusalOther: number;
  refusalTradition: number; // Gardé pour compatibilité, souvent mappé à NotDecisionMaker
  // Absences detail (group2/Tot_child_Abs_*)
  absentFarm: number;         // Champ
  absentMarket: number;       // Marché
  absentPlayAreas: number;    // Terrain de jeu
  absentSchool: number;       // École
  absentSocialEvent: number;  // Événement social
  absentTravel: number;       // Voyage
  absentParentAbsent: number; // Parent absent
  absentOther: number;        // Autre
  numberAFP: number;
  numberMeasles: number;
}

export interface CleanSubmission {
  id: string;
  form: "households" | "outside";
  submissionTime: string;
  monitoringDate: string | null;
  monitoringType: MonitoringType;
  context: MonitoringContext;
  orgUnit: OrgUnitRef;
  geo: GeoPoint | null;
  monitorName: string | null;
  monitorNameRaw?: string | null;
  monitorNormKey?: string | null;
  monitorProfile: string | null;
  stats: SubmissionStats;
  raw: Record<string, unknown>;
}

export interface ChildRecord {
  submissionId: string;
  childIndex: number;
  ageMonths: number | null;
  ageYears: number | null;
  sex: Sex;
  orgUnit: OrgUnitRef;
  geo: GeoPoint | null;
  monitoringDate: string | null;
  monitoringType: MonitoringType;
  context: MonitoringContext;
  /** RR */
  rrReceived?: VaccinationResponse;
  rrEvidence?: string | null;
  /** Polio */
  polioReceived?: VaccinationResponse;
  polioEvidence?: string | null;
  /** Raison de non-vaccination (libre ou catégorisée) */
  reasonNonVaccination?: string | null;
  reasonCategory?: ReasonCategory | null;
  /** Raison de non-vaccination RR (code ODK + classification Offre/Demande). */
  rrReasonCode?: string | null;
  rrReasonLabel?: string | null;
  rrReasonGroup?: "OFFRE" | "DEMANDE" | null;
  /** Refus - Raison de refus Polio (texte libre ou code) */
  refusalReason?: string | null;
  /** Refus - Code de raison de refus (mapping RR 1-16, utilisé pour Polio aussi) */
  refusalReasonCode?: string | null;
  /** Refus - Catégorie de raison (OFFRE/DEMANDE) */
  refusalReasonGroup?: "OFFRE" | "DEMANDE" | null;
  /** Absence */
  absenceReason?: string | null;
  /** Communication */
  parentInformed?: "Oui" | "Non" | "Inconnu";
  informationChannels?: string[];
  raw?: Record<string, unknown>;
}

export type ReasonCategory =
  | "REFUS"
  | "ABSENCE"
  | "ENFANT_MALADE"
  | "MANQUE_INFO"
  | "RUPTURE_STOCK"
  | "EQUIPE_NON_PASSEE"
  | "DEJA_VACCINE_AILLEURS"
  | "AUTRE"
  | "INCONNU";

export interface AggregatesOrgUnit {
  orgUnit: OrgUnitRef;
  submissions: number;
  childrenRR: number;
  childrenPolioHousehold: number;
  childrenPolioOutside: number;
  rrVaccinated: number;
  rrNotVaccinated: number;
  polioVaccinatedHousehold: number;
  polioNotVaccinatedHousehold: number;
  polioVaccinatedOutside: number;
  polioNotVaccinatedOutside: number;
  refusals: number;
  absences: number;
  numberAFP: number;
  numberMeasles: number;
  rrCoveragePct: number | null;
  polioCoverageHouseholdPct: number | null;
  polioCoverageOutsidePct: number | null;
  /** Couverture Polio globale (ménage + hors-ménage) — cohérente avec le KPI. */
  polioCoveragePct: number | null;
  coverageRiskRR: CoverageRiskClass;
  coverageRiskPolioHousehold: CoverageRiskClass;
  coverageRiskPolioOutside: CoverageRiskClass;
  coverageRiskPolio: CoverageRiskClass;
}

export interface ReasonBreakdown {
  reason: string;
  category: ReasonCategory;
  count: number;
  pct: number;
}

export interface PerformanceRow {
  monitor: string;
  monitorNormKey: string;
  profile: string | null;
  province: string | null;
  antenne: string | null;
  zs: string | null;
  submissionsTotal: number;
  submissionsHousehold: number;
  submissionsOutside: number;
  daysActive: number;
  firstDate: string | null;
  lastDate: string | null;
  expectedPerDay: number | null;
  expectedHouseholdPerDay: number | null;
  expectedOutsidePerDay: number | null;
  averagePerDay: number;
  averageHouseholdPerDay: number;
  averageOutsidePerDay: number;
  completenessPct: number | null;
  completenessHouseholdPct: number | null;
  completenessOutsidePct: number | null;
}

export interface CompletenessDayRow {
  date: string;
  level: "province" | "antenne" | "zs";
  unit: string;
  submissionsRequired: number;
  submissionsReceived: number;
  completenessPct: number;
}

export interface HotspotRow {
  orgUnit: OrgUnitRef;
  score: number;
  notVaccinated: number;
  refusals: number;
  absences: number;
  reasonsTop: ReasonBreakdown[];
  geo?: GeoPoint | null;
}

/**
 * Niveau d'agrégation pour les pré-calculs côté serveur.
 * Identique au DrillLevel côté client (lib/client/drill-level).
 */
export type AggregationLevel = "province" | "antenne" | "zs" | "as" | "locality";

/**
 * Série pré-calculée pour les graphiques 100% empilés.
 * Dupliqué de ByUnitSeries dans lib/client/derive pour éviter une dépendance
 * circulaire client→serveur.
 */
export interface PrecomputedByUnitSeries {
  units: string[];
  series: { name: string; data: number[]; color?: string }[];
}

export interface PrecomputedKpi {
  submissions: number;
  householdSubs: number;
  outsideSubs: number;
  childrenRR: number;
  childrenPolio: number;
  rrVaccinated: number;
  polioVaccinated: number;
  rrCoverage: number | null;
  polioCoverage: number | null;
  rrRisk: CoverageRiskClass;
  polioRisk: CoverageRiskClass;
  refusals: number;
  refusalsPolio: number;
  refusalsRR: number;
  absences: number;
  monitorsActive: number;
  daysCovered: number;
}

export interface PrecomputedTimeline {
  categories: string[];
  households: number[];
  outside: number[];
}

export interface PrecomputedReports {
  expected: number;
  submitted: number;
  completenessPct: number | null;
  daysCovered: number;
  distinctZs: number;
}

export interface PrecomputedReasonsByLevel {
  nonVaxPolio: PrecomputedByUnitSeries;
  rrReasons: PrecomputedByUnitSeries;
  polioRefusals: PrecomputedByUnitSeries;
  rrRefusals: PrecomputedByUnitSeries;
  absences: PrecomputedByUnitSeries;
  channels: PrecomputedByUnitSeries;
}

export interface PrecomputedParentInformedRow {
  label: string;
  pct: number;
  sample: number;
}

export interface PrecomputedCoverageByGroupRow {
  unit: string;
  groupA: number;
  groupB: number;
  sampleA: number;
  sampleB: number;
}

export interface PrecomputedSurveillanceRow {
  unit: string;
  submissions: number;
  numberAFP: number;
  numberMeasles: number;
}

export interface PrecomputedPolioBreakdown {
  householdEval: number;
  householdVac: number;
  outsideEval: number;
  outsideVac: number;
  refusals: number;
  absences: number;
}

export interface PrecomputedPolioReasonsSummary {
  refusals: number;
  absences: number;
  notReachedTeam: number;
  alreadyRoutine: number;
  otherNonVax: number;
  total: number;
}

export interface PrecomputedRrReasonDetail {
  code: string;
  label: string;
  category: "OFFRE" | "DEMANDE";
  count: number;
  pct: number;
  color: string;
}

export interface PrecomputedRrNonVaxReasonsBreakdown {
  total: number;
  offre: { count: number; pct: number };
  demande: { count: number; pct: number };
  details: PrecomputedRrReasonDetail[];
}

export interface PrecomputedRrEvidenceSource {
  source: string;
  count: number;
  pct: number;
}

/** Point GPS agrégé par localité pour la carte satellite. */
export interface PrecomputedMapPoint {
  lat: number;
  lng: number;
  locality: string;
  nonVaxPolio: number;
  nonVaxRR: number;
}

/** Point GPS par moniteur et localité pour l'export Excel des traces. */
export interface PrecomputedMonitorGeoPoint {
  monitor: string;
  locality: string;
  lat: number | null;
  lng: number | null;
  submissions: number;
}

/**
 * Ligne de la "Fact Table" (Cube de données).
 * Agrégation par (Jour, Province, Antenne, ZS, AS, Localité, Type, Contexte, Moniteur).
 * Permet de tout recalculer côté client instantanément.
 */
export interface FactRow {
  // Dimensions (clés courtes pour le JSON)
  d: string;  // date
  p: string;  // province
  a: string | null; // antenne
  z: string | null; // zs
  as: string | null; // as
  l: string | null; // locality
  t: MonitoringType;
  c: MonitoringContext;
  pr: string | null; // profile
  m: string | null;  // monitor

  // Métriques KPIs
  subs: number;
  evP: number;  // éval polio
  vaP: number;  // vac polio
  nvP: number;  // non-vac polio
  rfP: number;  // refus polio
  abP: number;  // absents polio
  evR: number;  // éval RR
  vaR: number;  // vac RR
  nvR: number;  // non-vac RR
  rfR: number;  // refus RR
  abR: number;  // absents RR

  // Raisons Non-Vaccination Polio (détail pour stacked bar)
  // nv_... : not reached, asleep, too far, routine, others
  nv_nr: number; nv_as: number; nv_tf: number; nv_ro: number; nv_ot: number;
  // Refus Polio (détail)
  // rf_... : religion, side effects, too many, sick, decision, trust, other
  rf_re: number; rf_se: number; rf_tm: number; rf_si: number; rf_de: number; rf_tr: number; rf_ot: number;
  // Absences Polio (détail)
  // ab_... : farm, market, play, school, social, travel, parent, other
  ab_fa: number; ab_ma: number; ab_pl: number; ab_sc: number; ab_so: number; ab_tv: number; ab_pa: number; ab_ot: number;

  // Raisons RR (Map de codes 1-16 -> count)
  rr_re: Record<string, number>;
  // Canaux info (Map de noms -> count)
  ch: Record<string, number>;
  // Info parents
  inf_y: number; // yes
  inf_t: number; // total renseigné

  // Démographie RR (Age/Sexe)
  rr_u5: number; // < 5 ans
  rr_o5: number; // >= 5 ans
  rr_m: number;  // masculin
  rr_f: number;  // féminin

  // Surveillance
  afp: number;
  mea: number;

  // Sources de preuve RR (vaccinés uniquement) — Map source -> count.
  // Permet de recalculer rrEvidenceSources sous filtres.
  rr_ev: Record<string, number>;

  // Centroide GPS de la dimension : sommes brutes (lat/lng) et compteur
  // de soumissions avec GPS valide. mapPoints regroupe par locality
  // côté client en agrégeant ces sommes sur la vue filtrée.
  gLat: number;
  gLng: number;
  gN: number;
}

export interface AnalyticsBundle {
  meta: {
    generatedAt: string;
    householdCount: number;
    outsideCount: number;
    minDate: string | null;
    maxDate: string | null;
    filteredByProvince: string[];
  };
  /**
   * Table de faits pour le filtrage client multi-dimensionnel.
   * Remplace avantageusement l'envoi des soumissions brutes.
   */
  factTable?: FactRow[];
  /**
   * Tableaux bruts. Vides dans les réponses /api/analytics depuis avril 2026
   * (la limite Vercel de 4.5 MB de réponse ne permet pas de les sérialiser
   * pour 160k+ records). Conservés dans le type pour les ETL locaux et pour
   * compatibilité descendante avec les pages qui les filtrent encore.
   */
  submissions: CleanSubmission[];
  children: ChildRecord[];
  aggregates: {
    byProvince: AggregatesOrgUnit[];
    byAntenne: AggregatesOrgUnit[];
    byZs: AggregatesOrgUnit[];
    byAs: AggregatesOrgUnit[];
    byLocality: AggregatesOrgUnit[];
  };
  reasons: {
    nonVaccination: ReasonBreakdown[];
    refusals: ReasonBreakdown[];
    absences: ReasonBreakdown[];
  };
  information: {
    parentInformedPct: number | null;
    channels: ReasonBreakdown[];
  };
  performance: PerformanceRow[];
  completeness: CompletenessDayRow[];
  hotspots: HotspotRow[];
  /**
   * Pré-calculs côté serveur — utilisés par la page d'accueil pour éviter
   * l'envoi des 160k+ soumissions au client (limite réponse Vercel 4.5 MB).
   * Les filtres orgUnit drill-down restent appliqués côté client via les
   * `aggregates`. Les autres filtres (date, monitor) ne s'appliquent pas
   * sur ces pré-calculs et sont ignorés sur la home.
   */
  precomputed: {
    kpi: PrecomputedKpi;
    timeline: PrecomputedTimeline;
    reports: PrecomputedReports;
    reasonsByLevel: Record<AggregationLevel, PrecomputedReasonsByLevel>;
    parentInformedByLevel: Record<AggregationLevel, PrecomputedParentInformedRow[]>;
    /** Décomposition Polio globale (toutes provinces, hors filtres). */
    polioBreakdown: PrecomputedPolioBreakdown;
    /** Récap raisons Polio (refus/absent/non revisité/routine/autre). */
    polioReasonsSummary: PrecomputedPolioReasonsSummary;
    /** Décomposition raisons RR globale (Offre/Demande + 16 codes). */
    rrNonVaxReasonsBreakdown: PrecomputedRrNonVaxReasonsBreakdown;
    /** Sources de preuve RR (Carnet/Bracelet/...) — pour le donut /rr. */
    rrEvidenceSources: PrecomputedRrEvidenceSource[];
    /** Couverture RR par âge (<5/≥5) par niveau orgUnit. */
    rrCoverageByAgeByLevel: Record<AggregationLevel, PrecomputedCoverageByGroupRow[]>;
    /** Couverture RR par sexe (M/F) par niveau orgUnit. */
    rrCoverageBySexByLevel: Record<AggregationLevel, PrecomputedCoverageByGroupRow[]>;
    /** Surveillance épidémio (AFP, Rougeole) par niveau, formulaires Household. */
    surveillanceByLevel: Record<AggregationLevel, PrecomputedSurveillanceRow[]>;
    /** Centroïdes GPS par localité avec enfants non-vaccinés (Polio + RR). */
    mapPoints: PrecomputedMapPoint[];
    /** Centroïdes GPS par moniteur × localité pour l'export Excel des traces. */
    monitorGeoPoints: PrecomputedMonitorGeoPoint[];
  };
  /**
   * Options pour les dropdowns du FilterBar — calculées AVANT application
   * des filtres dimensionnels, donc indépendantes de la sélection courante.
   * Permet une cascade géo + monitor sans avoir à transporter `submissions`.
   */
  filterOptions: {
    provinces: string[];
    antennesByProvince: Record<string, string[]>;
    zsByAntenne: Record<string, string[]>;
    asByZs: Record<string, string[]>;
    localitiesByAs: Record<string, string[]>;
    profiles: string[];
    monitorsByProfile: Record<string, string[]>;
    allMonitors: string[];
    hasInProcess: boolean;
    hasEndProcess: boolean;
    hasHouseholds: boolean;
    hasOutside: boolean;
    /** Cascade Type ↔ Profil ↔ Moniteur */
    monitorsByType: Record<string, string[]>;
    profilesByType: Record<string, string[]>;
    typesByProfile: Record<string, string[]>;
  };
}
