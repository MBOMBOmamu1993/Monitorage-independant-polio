/**
 * Parse une soumission ODK brute en CleanSubmission + enfants (ChildRecord).
 */

import type { OdkSubmissionBase } from "@/lib/types/odk";
import type {
  CleanSubmission,
  ChildRecord,
  OrgUnitRef,
  GeoPoint,
  MonitoringType,
  MonitoringContext,
  Sex,
  SubmissionStats,
  VaccinationResponse,
} from "@/lib/types/domain";
import { HOUSEHOLD_FIELD_MAP, OUTSIDE_FIELD_MAP, pick, pickStr, pickNum } from "@/config/field-map";
import { normalizeLocality, normalizeMonitor, normalizeProvince, normalizeOrgLabel, normKey } from "./normalize";
import { resolveAntenne } from "@/config/rules-antenne";
import { resolveRrReason } from "@/config/reasons";

/** Annule tout compteur surveillance > seuil (faute de saisie). */
function clampSurveillance(n: number, max: number): number {
  return n > max ? 0 : n;
}

function parseGps(raw: string | null | undefined): GeoPoint | null {
  if (!raw) return null;
  const parts = raw.trim().split(/\s+/).map(Number);
  if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
  return {
    lat: parts[0],
    lng: parts[1],
    accuracy: Number.isFinite(parts[3]) ? parts[3] : null,
  };
}

function geoFromGeolocation(v: unknown): GeoPoint | null {
  if (!Array.isArray(v) || v.length < 2) return null;
  const lat = typeof v[0] === "number" ? v[0] : Number(v[0]);
  const lng = typeof v[1] === "number" ? v[1] : Number(v[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function parseMonitoringType(raw: string | null): MonitoringType {
  if (!raw) return "UNKNOWN";
  const k = raw.trim().toLowerCase();
  if (k === "inprocess") return "InProcess";
  if (k === "endprocess") return "EndProcess";
  return "UNKNOWN";
}

function parseSex(raw: string | null): Sex {
  if (!raw) return "UNKNOWN";
  const k = raw.trim().toLowerCase();
  if (k.startsWith("m") || k === "masculin" || k === "male" || k === "garcon" || k === "garçon") return "M";
  if (k.startsWith("f") || k === "feminin" || k === "féminin" || k === "female" || k === "fille") return "F";
  return "UNKNOWN";
}

function parseStatutRR(raw: string | null): VaccinationResponse {
  if (!raw) return "Inconnu";
  const k = raw.trim().toLowerCase();
  if (k === "vaccine" || k === "vacciné" || k === "oui" || k === "yes") return "Oui";
  if (k === "non_vaccine" || k === "non_vaccinee" || k === "non_vacciné" || k === "non" || k === "no") return "Non";
  if (k === "absent") return "Absent";
  if (k === "refus" || k === "refusal") return "Refus";
  return "Autre";
}

export interface ParsedSubmission {
  submission: CleanSubmission;
  children: ChildRecord[];
}

export function parseSubmission(
  raw: OdkSubmissionBase,
  context: MonitoringContext
): ParsedSubmission {
  const map = context === "Household" ? HOUSEHOLD_FIELD_MAP : OUTSIDE_FIELD_MAP;
  const r = raw as Record<string, unknown>;

  const provinceRaw = pickStr(r, map.province);
  const province = normalizeProvince(provinceRaw) ?? provinceRaw ?? "Inconnue";
  const antenneRaw = pickStr(r, map.antenne);
  const antenne =
    normalizeOrgLabel(antenneRaw) ??
    normalizeOrgLabel(resolveAntenne(province, pickStr(r, map.zs)));
  const zs = normalizeOrgLabel(pickStr(r, map.zs));
  const as = normalizeOrgLabel(pickStr(r, map.as));
  const localityParsed = normalizeLocality(pickStr(r, map.locality));

  const orgUnit: OrgUnitRef = {
    province,
    antenne,
    zs,
    as,
    locality: localityParsed.canonical,
    localityRaw: localityParsed.raw,
    localityNormKey: localityParsed.norm,
  };

  const geo =
    parseGps(pickStr(r, map.gpsString)) ??
    geoFromGeolocation(pick(r, map.geolocation));

  const monitorRaw = pickStr(r, map.monitorName);
  const monitor = normalizeMonitor(monitorRaw, zs);
  const profile = pickStr(r, map.monitorProfile);

  const monitoringDate =
    pickStr(r, map.monitoringDate) ??
    (pickStr(r, ["today"]) as string | null);
  const submissionTime = pickStr(r, map.submissionTime) ?? new Date().toISOString();
  const type = parseMonitoringType(pickStr(r, map.monitoringType));

  const id = String(pick(r, ["_uuid", "meta/instanceID", "_id"]) ?? submissionTime);
  const form = context === "Household" ? "households" : "outside";

  // Pre-extract RR children from personnes_rr repeat
  const tempSubmission = { id, orgUnit, geo, monitoringDate, submissionTime, monitoringType: type, context } as CleanSubmission;
  const children = extractChildren(r, map.rrRepeat, tempSubmission);

  // Aggrégats POLIO depuis les champs calculés du formulaire
  const aggTotU5 = pickNum(r, map.totU5Present);
  const aggVacU5 = pickNum(r, map.u5VacFM);

  // Pour le HORS-MÉNAGE : lire les données du repeat OHH (Child_Checked / Child_FMD)
  // C'est la source de vérité pour Polio hors-ménage, indépendante de personnes_rr (qui est pour RR)
  let ohhTotU5: number | null = null;
  let ohhVacU5: number | null = null;

  if (context === "Outside") {
    const ohh = r["OHH"];
    if (Array.isArray(ohh) && ohh.length > 0) {
      // Format : repeat group OHH avec objets imbriqués
      let sumChecked = 0;
      let sumFMD = 0;
      for (const item of ohh) {
        const obj = item as Record<string, unknown>;
        const checked = pickNum(obj, ["Child_Checked", "child_checked", "OHH/Child_Checked"]);
        const fmd = pickNum(obj, ["Child_FMD", "child_fmd", "OHH/Child_FMD"]);
        if (checked) sumChecked += checked;
        if (fmd) sumFMD += fmd;
      }
      if (sumChecked > 0 || sumFMD > 0) {
        ohhTotU5 = sumChecked;
        ohhVacU5 = sumFMD;
      }
    } else {
      // Format aplati (CSV/Excel) : colonnes avec préfixe OHH/
      const flatChecked = pickNum(r, ["OHH/Child_Checked", "OHH_count", "Child_Checked", "child_checked"]);
      const flatFMD = pickNum(r, ["OHH/Child_FMD", "Child_FMD", "child_fmd"]);
      if (flatChecked !== null || flatFMD !== null) {
        ohhTotU5 = flatChecked ?? 0;
        ohhVacU5 = flatFMD ?? 0;
      }
    }
  }

  // Pour le MÉNAGE : utiliser le repeat personnes_rr ou les agrégats
  const childTotU5 = children.length;
  const childVacU5 = children.filter(c => c.rrReceived === "Oui").length;

  // Calcul final de totU5 et vacU5
  let totU5: number;
  let vacU5: number;

  if (context === "Outside") {
    // Hors-ménage : priorité aux données OHH (Polio), fallback aux agrégats
    if (ohhTotU5 !== null && ohhTotU5 > 0) {
      totU5 = ohhTotU5;
      vacU5 = ohhVacU5 ?? 0;
    } else if (aggTotU5 !== null && aggTotU5 > 0) {
      totU5 = aggTotU5;
      vacU5 = aggVacU5 ?? 0;
    } else {
      totU5 = childTotU5;
      vacU5 = childVacU5;
    }
  } else {
    // Ménage : priorité aux agrégats, fallback au repeat personnes_rr
    if (aggTotU5 !== null && aggTotU5 > 0) {
      totU5 = aggTotU5;
      vacU5 = aggVacU5 ?? 0;
    } else if (childTotU5 > 0) {
      totU5 = childTotU5;
      vacU5 = childVacU5;
    } else {
      totU5 = 0;
      vacU5 = 0;
    }
  }

  // Outlier guard Polio :
  //  - Ménage : >10 enfants 0-59m dans un seul ménage = faute de saisie → record annulé
  //  - Hors-ménage : >50 enfants évalués par visite = aberrant → record annulé
  const maxU5 = context === "Household" ? 10 : 50;
  if (totU5 > maxU5) {
    totU5 = 0;
    vacU5 = 0;
  }
  vacU5 = Math.min(vacU5, totU5);
  const informedNum = pickNum(r, map.parentInformed);
  const rawChannels = pickStr(r, map.infoChannels);

  // Refus Polio : on prend le champ agrégé du formulaire
  const aggregateRefusals = pickNum(r, map.childNonCompliance);
  const finalRefusals = aggregateRefusals ?? 0;

  const aggregateAbsences = pickNum(r, map.childAbsentTotal);
  const finalAbsences = aggregateAbsences ?? 0;

  const stats: SubmissionStats = {
    totU5,
    vacU5,
    nonVacU5: Math.max(0, totU5 - vacU5),
    refusals: finalRefusals,
    absences: finalAbsences,
    notReachedTeam: pickNum(r, map.childNoHwPresent) ?? 0,
    alreadyRoutine: pickNum(r, map.childVaccinatedRoutine) ?? 0,
    // Décomposition Non-vaccination (group1)
    childAsleep: pickNum(r, map.childAsleep) ?? 0,
    childHfTooFar: pickNum(r, map.childHfTooFar) ?? 0,
    childOthers: pickNum(r, map.childOthers) ?? 0,
    parentInformed: informedNum === null ? null : informedNum >= 1,
    infoChannels: rawChannels ? rawChannels.split(/\s+/).filter(Boolean) : [],
    // Détail Refus
    refusalReligion: pickNum(r, map.refusalReligion) ?? (children.filter(c => c.rrReceived === "Refus" && (c.refusalReasonCode === "9" || c.refusalReasonCode === "1")).length),
    refusalTradition: pickNum(r, map.refusalTradition) ?? 0,
    refusalNoTrust: pickNum(r, map.refusalNoTrust) ?? (children.filter(c => c.rrReceived === "Refus" && c.refusalReasonCode === "13").length),
    refusalFearSideEffects: pickNum(r, map.refusalFearSideEffects) ?? (children.filter(c => c.rrReceived === "Refus" && c.refusalReasonCode === "11").length),
    refusalTooManyDoses: pickNum(r, map.refusalTooManyDoses) ?? 0,
    refusalChildSick: pickNum(r, map.refusalChildSick) ?? 0,
    refusalNotDecisionMaker: pickNum(r, map.refusalNotDecisionMaker) ?? 0,
    refusalOther: pickNum(r, map.refusalOther) ?? 0,
    // Détail Absence (group2)
    absentFarm: pickNum(r, map.absFarm) ?? 0,
    absentMarket: pickNum(r, [...map.absMarket, ...map.absentMarket]) ?? 0,
    absentPlayAreas: pickNum(r, map.absPlayAreas) ?? 0,
    absentSchool: pickNum(r, [...map.absSchool, ...map.absentSchool]) ?? 0,
    absentSocialEvent: pickNum(r, map.absSocialEvent) ?? 0,
    absentTravel: pickNum(r, [...map.absTravelling, ...map.absentTravel]) ?? 0,
    absentParentAbsent: pickNum(r, map.absParentAbsent) ?? 0,
    absentOther: pickNum(r, [...map.absOther, ...map.absentOther]) ?? 0,
    // Surveillance : un moniteur en porte-à-porte ne devrait pas remonter
    // des dizaines de cas par formulaire. Plafonds anti-saisie aberrante
    // (cas observés : 90M cas rougeole agrégés à cause de typos massives).
    numberAFP: clampSurveillance(pickNum(r, map.numberAFP) ?? 0, 20),
    numberMeasles: clampSurveillance(pickNum(r, map.numberMeasles) ?? 0, 50),
  };

  const submission: CleanSubmission = {
    id,
    form,
    submissionTime,
    monitoringDate,
    monitoringType: type,
    context,
    orgUnit,
    geo,
    monitorName: monitor.canonical,
    monitorNameRaw: monitor.raw,
    monitorNormKey: monitor.norm,
    monitorProfile: profile,
    stats,
    raw: r,
  };

  return { submission, children };
}

function extractChildren(
  r: Record<string, unknown>,
  repeatCandidates: string[],
  sub: CleanSubmission
): ChildRecord[] {
  const repeat = repeatCandidates.map((k) => r[k]).find((v) => Array.isArray(v)) as
    | Array<Record<string, unknown>>
    | undefined;
  if (!repeat?.length) return [];

  return repeat.map((c, idx) => {
    const prefix = "personnes_rr";
    const ageYears = pickNum(c, [`${prefix}/age_annee_rr`, "age_annee_rr", "age_rr"]);
    const ageMonths =
      pickNum(c, [`${prefix}/age_mois_rr`, "age_mois_rr"]) ??
      (ageYears !== null ? Math.round(ageYears * 12) : null);
    const sex = parseSex(pickStr(c, [`${prefix}/sexe_personne_rr`, "sexe_personne_rr"]));

    const statut = pickStr(c, [
      `${prefix}/statut_global_rr_grp/statut_vaccinal_rr`,
      "statut_global_rr_grp/statut_vaccinal_rr",
      "statut_vaccinal_rr",
    ]);
    const rrAdmin = pickStr(c, [
      `${prefix}/statut_vaccinal_rr_grp/rr_admin_rr`,
      "statut_vaccinal_rr_grp/rr_admin_rr",
      "rr_admin_rr",
    ]);
    const rrEvidence = pickStr(c, [
      `${prefix}/statut_vaccinal_rr_grp/source_rr`,
      "statut_vaccinal_rr_grp/source_rr",
      "source_rr",
    ]);

    const received = parseStatutRR(statut ?? rrAdmin);

    const rrReasonRaw = pickStr(c, [
      `${prefix}/statut_global_rr_grp/raison_non_vacc_rr`,
      "statut_global_rr_grp/raison_non_vacc_rr",
      "raison_non_vacc_rr",
    ]);
    const rrReasonDef = resolveRrReason(rrReasonRaw);

    // Raisons de refus Polio (par enfant dans le repeat group si présentes)
    const polioReligion = pickStr(c, [`${prefix}/statut_global_rr_grp/religion_rr`, "statut_global_rr_grp/religion_rr", "religion_rr"]);
    const polioTradition = pickStr(c, [`${prefix}/statut_global_rr_grp/tradition_rr`, "statut_global_rr_grp/tradition_rr", "tradition_rr"]);
    const polioConfiance = pickStr(c, [`${prefix}/statut_global_rr_grp/confiance_rr`, "statut_global_rr_grp/confiance_rr", "confiance_rr"]);
    const polioPeur = pickStr(c, [`${prefix}/statut_global_rr_grp/peur_rr`, "statut_global_rr_grp/peur_rr", "peur_rr"]);
    const polioMalade = pickStr(c, [`${prefix}/statut_global_rr_grp/malade_rr`, "malade_rr"]); // Hypothèse pour l'enfant était malade

    const refusalReasonText = polioReligion ?? polioTradition ?? polioConfiance ?? polioPeur ?? polioMalade ?? null;
    
    // Mapping vers les nouveaux codes Polio
    let polioReasonCode: string | null = null;
    if (polioReligion) polioReasonCode = "religion";
    else if (polioPeur) polioReasonCode = "side_effects";
    else if (polioTradition) polioReasonCode = "not_decision_maker";
    else if (polioConfiance) polioReasonCode = "other";
    else if (polioMalade) polioReasonCode = "child_sick";
    else if (refusalReasonText) polioReasonCode = "other";

    return {
      submissionId: sub.id,
      childIndex: idx + 1,
      ageMonths,
      ageYears,
      sex,
      orgUnit: sub.orgUnit,
      geo: sub.geo,
      monitoringDate: sub.monitoringDate,
      monitoringType: sub.monitoringType,
      context: sub.context,
      rrReceived: received,
      rrEvidence,
      rrReasonCode: rrReasonDef?.code ?? rrReasonRaw ?? null,
      rrReasonLabel: rrReasonDef?.label ?? null,
      rrReasonGroup: rrReasonDef?.category ?? null,
      refusalReason: refusalReasonText,
      refusalReasonCode: polioReasonCode,
      refusalReasonGroup: "DEMANDE",
      raw: c,
    } satisfies ChildRecord;
  });
}
