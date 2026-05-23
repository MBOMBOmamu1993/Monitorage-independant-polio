/**
 * Utilitaires d'export Excel (SheetJS/xlsx).
 * Toutes les fonctions sont client-side uniquement.
 */

type Row = (string | number | null)[];

export async function exportToExcel(
  filename: string,
  sheets: { name: string; headers: string[]; rows: Row[] }[]
): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const wsData: Row[] = [sheet.headers, ...sheet.rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Largeur automatique des colonnes
    const colWidths = sheet.headers.map((h, i) => {
      const maxLen = Math.max(
        h.length,
        ...sheet.rows.map((r) => String(r[i] ?? "").length)
      );
      return { wch: Math.min(maxLen + 2, 40) };
    });
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ─── Helpers spécialisés ─────────────────────────────────────────────────────

export function excelFromSeries(
  title: string,
  units: string[],
  series: { name: string; data: number[] }[]
): { name: string; headers: string[]; rows: Row[] } {
  const headers = ["Unité organisationnelle", ...series.map((s) => s.name)];
  const rows: Row[] = units.map((cat, i) => [
    cat,
    ...series.map((s) => s.data[i] ?? 0),
  ]);
  return { name: title.slice(0, 31), headers, rows };
}

export function excelFromKpis(
  title: string,
  kpis: { label: string; value: string | number; sub?: string }[]
): { name: string; headers: string[]; rows: Row[] } {
  const headers = ["Indicateur", "Valeur", "Détail"];
  const rows: Row[] = kpis.map((k) => [k.label, k.value, k.sub ?? ""]);
  return { name: title.slice(0, 31), headers, rows };
}

export function excelFromPerformance(
  title: string,
  rows: {
    monitor: string;
    profile: string | null;
    province: string | null;
    antenne: string | null;
    zs: string | null;
    submissionsHousehold: number;
    submissionsOutside: number;
    submissionsTotal: number;
    daysActive: number;
    averageHouseholdPerDay: number;
    expectedHouseholdPerDay: number | null;
    averageOutsidePerDay: number;
    expectedOutsidePerDay: number | null;
    completenessPct: number | null;
    firstDate: string | null;
    lastDate: string | null;
  }[]
): { name: string; headers: string[]; rows: Row[] } {
  const headers = [
    "Moniteur",
    "Profil",
    "Province",
    "Antenne",
    "Zone de Santé",
    "Ménage",
    "Hors-ménage",
    "Total",
    "Jours actifs",
    "Moy. ménage/j",
    "Cible ménage/j",
    "Moy. HM/j",
    "Cible HM/j",
    "Complétude (%)",
    "1ère date",
    "Dernière date",
  ];
  const data: Row[] = rows.map((r) => [
    r.monitor,
    r.profile ?? "—",
    r.province ?? "—",
    r.antenne ?? "—",
    r.zs ?? "—",
    r.submissionsHousehold,
    r.submissionsOutside,
    r.submissionsTotal,
    r.daysActive,
    +r.averageHouseholdPerDay.toFixed(2),
    r.expectedHouseholdPerDay ?? "—",
    +r.averageOutsidePerDay.toFixed(2),
    r.expectedOutsidePerDay ?? "—",
    r.completenessPct !== null ? +r.completenessPct.toFixed(1) : "N/A",
    r.firstDate ?? "—",
    r.lastDate ?? "—",
  ]);
  return { name: title.slice(0, 31), headers, rows: data };
}

export function excelFromMonitorGeoPoints(
  title: string,
  rows: { monitor: string; locality: string; lat: number | null; lng: number | null; submissions: number }[]
): { name: string; headers: string[]; rows: Row[] } {
  const headers = ["Moniteur", "Localité", "Latitude", "Longitude", "Soumissions"];
  const data: Row[] = rows.map((r) => [
    r.monitor,
    r.locality,
    r.lat !== null ? +r.lat.toFixed(6) : "—",
    r.lng !== null ? +r.lng.toFixed(6) : "—",
    r.submissions,
  ]);
  return { name: title.slice(0, 31), headers, rows: data };
}

export function excelFromAggregates(
  title: string,
  rows: {
    orgUnit: string;
    evaluatedPolio: number;
    evaluatedRR: number;
    polioNotVax: number;
    rrNotVax: number;
    rrCovPct: number | null;
    polioCovPct: number | null;
  }[]
): { name: string; headers: string[]; rows: Row[] } {
  const headers = [
    "Unité organisationnelle",
    "Évalués Polio",
    "Évalués RR",
    "Non vaccinés Polio",
    "Non vaccinés RR",
    "Couverture RR (%)",
    "Couverture Polio (%)",
  ];
  const data: Row[] = rows.map((r) => [
    r.orgUnit,
    r.evaluatedPolio,
    r.evaluatedRR,
    r.polioNotVax,
    r.rrNotVax,
    r.rrCovPct !== null ? +r.rrCovPct.toFixed(1) : "N/A",
    r.polioCovPct !== null ? +r.polioCovPct.toFixed(1) : "N/A",
  ]);
  return { name: title.slice(0, 31), headers, rows: data };
}
