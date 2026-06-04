/**
 * Rapport de comparaison de campagnes AVS (Avril vs Mai 2026).
 *
 * Pour chaque formulaire ODK/ONA :
 *   - nombre de soumissions par fenêtre de campagne
 *   - répartition par "profil d'acteur" (= niveau / désignation du superviseur)
 *
 * Il n'existe pas de champ littéral `profil` ; le profil d'acteur est porté,
 * selon les formulaires, par un champ équivalent :
 *   - Designation_Supervisor (prioritaire si présent)
 *   - sinon Monitored_Level (quand il contient des codes de désignation)
 * Les formulaires "Formulaire A" (14850, 5645) ne portent qu'un niveau
 * administratif de rapportage (Admin_LvL_Rpt) — pas un profil d'acteur.
 *
 * Le script s'exécute dans GitHub Actions (le runner joint api.whonghub.org)
 * avec le secret ODK_TOKEN. Il imprime un rapport Markdown entre les marqueurs
 * REPORT_START / REPORT_END, relu depuis les logs Actions.
 */

const BASE = process.env.ODK_BASE_URL?.trim() || "https://api.whonghub.org";
const TOKEN = process.env.ODK_TOKEN?.trim();
if (!TOKEN) { console.error("ODK_TOKEN manquant"); process.exit(1); }

const FORMS = [
  { id: 4497, label: "Supervision des équipes de vaccination", profilField: "Monitored_Level" },
  { id: 14850, label: "Formulaire A pour VPOb", profilField: null },
  { id: 5645, label: "Formulaire A pour nVPO2", profilField: null },
  { id: 9442, label: "Inventaire des MCF (chaîne de froid)", profilField: null },
  { id: 5278, label: "Liste de contrôle des formations AVS", profilField: "Designation_Supervisor" },
  { id: 4501, label: "Liste de vérification validation préparatifs AVS", profilField: "Monitored_Level" },
  { id: 4498, label: "Monitorage indépendant dans les ménages", profilField: "Monitored_Level" },
];

const WINDOWS = [
  { key: "Avril 2026", gte: "2026-04-23", lte: "2026-04-30" },
  { key: "Mai 2026", gte: "2026-05-23", lte: "2026-06-10" },
];

// Mapping des codes de désignation vers les catégories du rapport narratif.
const PROFIL_MAP = {
  national_super: "Superviseurs nationaux",
  region_supervi: "Superviseurs provinciaux",
  District_sup: "Superviseurs d'axes (district)",
  subdistrict_sup: "Superviseurs d'axes (district)",
  team_sup: "Superviseurs d'équipes",
  Team_supervisor: "Superviseurs d'équipes",
  Indp_Monitor: "Moniteurs indépendants",
  // Toutes les agences / organisations sont regroupées dans "Consultants".
  IQVIA: "Consultants", AFINET: "Consultants", AFNET: "Consultants",
  McKing: "Consultants", APW_Staff: "Consultants", ESR_Staff: "Consultants",
  wcr_Staff: "Consultants", AfriCDC: "Consultants",
  WHO_Staff: "Consultants", UNICEF_Staff: "Consultants", CDC_Staff: "Consultants",
  BMGF_Staff: "Consultants", AFR_Staf: "Consultants", UN_other: "Consultants",
  "Red Cross Officers": "Consultants", Rotary: "Consultants", Oth_NGO: "Consultants",
  USAID: "Consultants",
};
// Reste en "Autres profils" : codes non-agences (Others, Stopper, NA, inconnus).
const FALLBACK_CAT = "Autres profils (non précisés)";
const CAT_ORDER = [
  "Superviseurs nationaux",
  "Superviseurs provinciaux",
  "Superviseurs d'axes (district)",
  "Superviseurs d'équipes",
  "Moniteurs indépendants",
  "Consultants",
  FALLBACK_CAT,
];

const PAGE = 2000;

async function fetchPage(id, gte, lte, start) {
  const query = JSON.stringify({ _submission_time: { $gte: gte, $lte: lte } });
  const url = `${BASE}/api/v1/data/${id}.json?query=${encodeURIComponent(query)}&start=${start}&limit=${PAGE}`;
  const res = await fetch(url, { headers: { Authorization: `Token ${TOKEN}`, Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error(`Réponse non-tableau pour ${id}`);
  return data;
}

async function fetchAll(id, gte, lte) {
  const all = [];
  let start = 0;
  for (;;) {
    const page = await fetchPage(id, gte, lte, start);
    all.push(...page);
    if (page.length < PAGE) break;
    start += PAGE;
  }
  return all;
}

function inc(map, key, n = 1) { map.set(key, (map.get(key) || 0) + n); }

async function main() {
  const formRows = [];
  // par fenêtre : codes bruts + catégories mappées (sur les formulaires à profil)
  const rawByWindow = { "Avril 2026": new Map(), "Mai 2026": new Map() };
  const catByWindow = { "Avril 2026": new Map(), "Mai 2026": new Map() };
  const errors = [];

  for (const form of FORMS) {
    const row = { label: form.label, id: form.id, counts: {} };
    for (const w of WINDOWS) {
      try {
        const recs = await fetchAll(form.id, w.gte, w.lte);
        row.counts[w.key] = recs.length;
        if (form.profilField) {
          for (const r of recs) {
            const v = r[form.profilField];
            if (v == null || typeof v === "object") continue;
            const code = String(v).trim();
            if (!code) continue;
            inc(rawByWindow[w.key], code, 1);
            inc(catByWindow[w.key], PROFIL_MAP[code] || FALLBACK_CAT, 1);
          }
        }
      } catch (e) {
        row.counts[w.key] = "ERR";
        errors.push(`${form.label} (${form.id}) [${w.key}]: ${e.message}`);
      }
    }
    formRows.push(row);
    console.error(`done ${form.id} -> Avril=${row.counts["Avril 2026"]} Mai=${row.counts["Mai 2026"]}`);
  }

  const L = [];
  L.push("===REPORT_START===", "");
  L.push("### 1. Soumissions par formulaire — Avril vs Mai 2026", "");
  L.push("| Formulaire | ID | Avril 2026 | Mai 2026 |", "|---|---|---|---|");
  let tA = 0, tM = 0;
  for (const r of formRows) {
    const a = r.counts["Avril 2026"], m = r.counts["Mai 2026"];
    if (typeof a === "number") tA += a;
    if (typeof m === "number") tM += m;
    L.push(`| ${r.label} | ${r.id} | ${a} | ${m} |`);
  }
  L.push(`| **Total** | — | **${tA}** | **${tM}** |`, "");

  // Tableau profil mappé (catégories du rapport)
  L.push("### 2. Profil d'acteur (niveau/désignation du superviseur) — catégories du rapport", "");
  L.push("_Champ source : `Designation_Supervisor` (5278) ou `Monitored_Level` (4497, 4501, 4498). " +
    "Les Formulaires A (14850, 5645) et l'Inventaire MCF (9442) ne portent pas de profil d'acteur._", "");
  L.push("| Profil d'acteur | Avril 2026 | Mai 2026 |", "|---|---|---|");
  let cA = 0, cM = 0;
  for (const cat of CAT_ORDER) {
    const a = catByWindow["Avril 2026"].get(cat) || 0;
    const m = catByWindow["Mai 2026"].get(cat) || 0;
    cA += a; cM += m;
    L.push(`| ${cat} | ${a} | ${m} |`);
  }
  L.push(`| **Total renseigné** | **${cA}** | **${cM}** |`, "");

  // Distribution brute des codes (transparence)
  for (const w of WINDOWS) {
    L.push(`### 3. Distribution brute des codes de désignation — ${w.key}`, "");
    L.push("| Code (donnée brute ODK) | Nombre |", "|---|---|");
    const entries = [...rawByWindow[w.key].entries()].sort((a, b) => b[1] - a[1]);
    for (const [k, n] of entries) L.push(`| ${k} | ${n} |`);
    L.push("");
  }

  if (errors.length) { L.push("### Erreurs", ""); for (const e of errors) L.push(`- ${e}`); L.push(""); }
  L.push(`_Généré le ${new Date().toISOString()} — fenêtres : Avril 23–30/04, Mai 23/05–10/06 2026._`);
  L.push("===REPORT_END===");
  console.log(L.join("\n"));
}

main().catch((e) => { console.error(e); process.exit(1); });
