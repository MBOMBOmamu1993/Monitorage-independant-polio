/**
 * Génération de la Fact Table (Cube) pour le filtrage client rapide.
 */
import type { CleanSubmission, ChildRecord, FactRow, OrgUnitRef } from "@/lib/types/domain";
import { orgUnitKey } from "./aggregate";

export function buildFactTable(
  submissions: CleanSubmission[],
  children: ChildRecord[]
): FactRow[] {
  // Map indexée par la clé unique de dimension
  const cube = new Map<string, FactRow>();

  // 1. Traitement des soumissions (KPIs Polio, Raisons Polio, Canaux, Surveillance)
  for (const s of submissions) {
    const date = s.monitoringDate ?? s.submissionTime.slice(0, 10);
    const u = s.orgUnit;
    const type = s.monitoringType;
    const context = s.context;
    const profile = s.monitorProfile;
    const monitor = s.monitorName;

    // Clé de dimension : Date | Province | Antenne | ZS | AS | Localité | Type | Contexte | Moniteur
    // On utilise les noms simples pour les dimensions de la FactRow pour gagner de la place
    const dimKey = `${date}|${u.province}|${u.antenne}|${u.zs}|${u.as}|${u.locality}|${type}|${context}|${monitor}`;

    let row = cube.get(dimKey);
    if (!row) {
      row = {
        d: date,
        p: u.province,
        a: u.antenne,
        z: u.zs,
        as: u.as,
        l: u.locality,
        t: type,
        c: context,
        pr: profile,
        m: monitor,
        subs: 0,
        evP: 0, vaP: 0, nvP: 0, rfP: 0, abP: 0,
        evR: 0, vaR: 0, nvR: 0, rfR: 0, abR: 0,
        nv_nr: 0, nv_as: 0, nv_tf: 0, nv_ro: 0, nv_ot: 0,
        rf_re: 0, rf_se: 0, rf_tm: 0, rf_si: 0, rf_de: 0, rf_tr: 0, rf_ot: 0,
        ab_fa: 0, ab_ma: 0, ab_pl: 0, ab_sc: 0, ab_so: 0, ab_tv: 0, ab_pa: 0, ab_ot: 0,
        rr_re: {},
        ch: {},
        inf_y: 0, inf_t: 0,
        rr_u5: 0, rr_o5: 0, rr_m: 0, rr_f: 0,
        afp: 0, mea: 0,
        rr_ev: {},
        gLat: 0, gLng: 0, gN: 0,
      };
      cube.set(dimKey, row);
    }

    const st = s.stats;
    row.subs += 1;
    row.evP += st.totU5;
    row.vaP += st.vacU5;
    row.nvP += st.nonVacU5;
    row.rfP += st.refusals;
    row.abP += st.absences;

    // Raisons Non-Vaccination Polio
    row.nv_nr += st.notReachedTeam;
    row.nv_as += st.childAsleep;
    row.nv_tf += st.childHfTooFar;
    row.nv_ro += st.alreadyRoutine;
    row.nv_ot += st.childOthers;

    // Détail Refus Polio
    row.rf_re += st.refusalReligion;
    row.rf_se += st.refusalFearSideEffects;
    row.rf_tm += st.refusalTooManyDoses;
    row.rf_si += st.refusalChildSick;
    row.rf_de += st.refusalNotDecisionMaker;
    row.rf_tr += st.refusalNoTrust;
    row.rf_ot += st.refusalOther;

    // Détail Absences Polio
    row.ab_fa += st.absentFarm;
    row.ab_ma += st.absentMarket;
    row.ab_pl += st.absentPlayAreas;
    row.ab_sc += st.absentSchool;
    row.ab_so += st.absentSocialEvent;
    row.ab_tv += st.absentTravel;
    row.ab_pa += st.absentParentAbsent;
    row.ab_ot += st.absentOther;

    // Canaux d'information
    for (const rawChan of st.infoChannels) {
      const chan = rawChan.replace(/_/g, " ");
      row.ch[chan] = (row.ch[chan] ?? 0) + 1;
    }

    // Info parents
    if (st.parentInformed !== null) {
      row.inf_t += 1;
      if (st.parentInformed) row.inf_y += 1;
    }

    // Surveillance
    row.afp += st.numberAFP;
    row.mea += st.numberMeasles;

    // GPS pour mapPoints : on accumule lat/lng (sommes) sur la dimension
    // pour pouvoir recalculer le centroide par locality après filtrage.
    if (s.geo && Number.isFinite(s.geo.lat) && Number.isFinite(s.geo.lng)) {
      row.gLat += s.geo.lat;
      row.gLng += s.geo.lng;
      row.gN += 1;
    }
  }

  // 2. Traitement des enfants (KPIs RR, Raisons RR, Démographie)
  // Note: On indexe les enfants par leur soumission parente pour retrouver les dimensions
  const subDims = new Map<string, { date: string; u: OrgUnitRef; type: string; context: string; profile: string | null; monitor: string | null }>();
  for (const s of submissions) {
    subDims.set(s.id, {
      date: s.monitoringDate ?? s.submissionTime.slice(0, 10),
      u: s.orgUnit,
      type: s.monitoringType,
      context: s.context,
      profile: s.monitorProfile,
      monitor: s.monitorName
    });
  }

  for (const c of children) {
    const dim = subDims.get(c.submissionId);
    if (!dim) continue;

    const dimKey = `${dim.date}|${dim.u.province}|${dim.u.antenne}|${dim.u.zs}|${dim.u.as}|${dim.u.locality}|${dim.type}|${dim.context}|${dim.monitor}`;
    let row = cube.get(dimKey);
    if (!row) {
      // Cas rare : enfant sans soumission parente dans le filtrage (ne devrait pas arriver avec applyFilters)
      continue;
    }

    if (c.rrReceived !== undefined) {
      row.evR += 1;
      if (c.rrReceived === "Oui") {
        row.vaR += 1;
        // Source de preuve (carnet / verbal / autre / null).
        const src = c.rrEvidence ?? "Inconnu";
        row.rr_ev[src] = (row.rr_ev[src] ?? 0) + 1;
      } else {
        row.nvR += 1;
        if (c.rrReasonGroup === "DEMANDE") row.rfR += 1;
        if (c.rrReceived === "Absent") row.abR += 1;
      }

      // Raison RR (code 1-16) : on n'inclut que les codes résolus dans la
      // taxonomie (rrReasonGroup défini), comme l'original rrReasonsByUnit.
      // Sinon les libellés bruts non mappés bruitent les graphiques empilés.
      if (c.rrReasonCode && c.rrReasonGroup && c.rrReceived !== "Oui") {
        row.rr_re[c.rrReasonCode] = (row.rr_re[c.rrReasonCode] ?? 0) + 1;
      }

      // Démographie
      if (c.sex === "M") row.rr_m += 1;
      else if (c.sex === "F") row.rr_f += 1;

      const ageMo = c.ageMonths ?? (c.ageYears !== null && c.ageYears !== undefined ? c.ageYears * 12 : null);
      if (ageMo !== null) {
        if (ageMo < 60) row.rr_u5 += 1;
        else row.rr_o5 += 1;
      }
    }
  }

  return Array.from(cube.values());
}
