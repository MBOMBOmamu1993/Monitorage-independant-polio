/**
 * Rapport de comparaison de campagnes AVS (Avril vs Mai 2026).
 *
 * Pour chaque formulaire ODK/ONA :
 *   - nombre de soumissions par fenêtre de campagne
 *   - répartition par "profil d'acteur" (champ `profil`)
 *
 * Le script s'exécute dans GitHub Actions (le runner peut joindre
 * api.whonghub.org) avec le secret ODK_TOKEN. Il n'écrit rien : il imprime
 * un rapport Markdown entre les marqueurs REPORT_START / REPORT_END que
 * l'on relit depuis les logs Actions.
 */

const BASE = process.env.ODK_BASE_URL?.trim() || "https://api.whonghub.org";
const TOKEN = process.env.ODK_TOKEN?.trim();
if (!TOKEN) {
  console.error("ODK_TOKEN manquant");
  process.exit(1);
}

const FORMS = [
  { id: 4497, label: "Supervision des équipes de vaccination" },
  { id: 14850, label: "Formulaire A pour VPOb" },
  { id: 5645, label: "Formulaire A pour nVPO2" },
  { id: 9442, label: "Inventaire des MCF" },
  { id: 5278, label: "Liste de contrôle des formations AVS" },
  { id: 4501, label: "Liste de vérification validation préparatifs AVS" },
  { id: 4498, label: "Monitorage indépendant dans les ménages" },
];

const WINDOWS = [
  { key: "Avril 2026", gte: "2026-04-23", lte: "2026-04-30" },
  { key: "Mai 2026", gte: "2026-05-23", lte: "2026-06-10" },
];

const PAGE = 2000;

async function fetchPage(id, gte, lte, start) {
  const query = JSON.stringify({ _submission_time: { $gte: gte, $lte: lte } });
  const url =
    `${BASE}/api/v1/data/${id}.json?query=${encodeURIComponent(query)}` +
    `&start=${start}&limit=${PAGE}`;
  const res = await fetch(url, {
    headers: { Authorization: `Token ${TOKEN}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${await res.text().then(t => t.slice(0, 200))}`);
  }
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

/** Trouve la valeur du champ `profil` (potentiellement préfixé par un groupe). */
function getProfil(rec) {
  for (const k of Object.keys(rec)) {
    const seg = k.split("/").pop().toLowerCase();
    if (seg === "profil" || seg.startsWith("profil")) {
      const v = rec[k];
      if (v == null || typeof v === "object") continue;
      const s = String(v).trim();
      if (s) return s;
    }
  }
  return "(non renseigné)";
}

function tallyInc(map, key, n = 1) {
  map.set(key, (map.get(key) || 0) + n);
}

async function main() {
  // counts[formIdx][windowKey] = number ; profByWindow[windowKey] = Map
  const formRows = [];
  const profByWindow = { "Avril 2026": new Map(), "Mai 2026": new Map() };
  const errors = [];

  for (const form of FORMS) {
    const row = { label: form.label, id: form.id, counts: {} };
    for (const w of WINDOWS) {
      try {
        const recs = await fetchAll(form.id, w.gte, w.lte);
        row.counts[w.key] = recs.length;
        for (const r of recs) tallyInc(profByWindow[w.key], getProfil(r), 1);
      } catch (e) {
        row.counts[w.key] = "ERR";
        errors.push(`${form.label} (${form.id}) [${w.key}]: ${e.message}`);
      }
    }
    formRows.push(row);
    console.error(`done ${form.id} ${form.label} -> Avril=${row.counts["Avril 2026"]} Mai=${row.counts["Mai 2026"]}`);
  }

  // --- Markdown ---
  const lines = [];
  lines.push("===REPORT_START===");
  lines.push("");
  lines.push("### 1. Soumissions par formulaire — Avril vs Mai 2026");
  lines.push("");
  lines.push("| Formulaire | ID | Avril 2026 | Mai 2026 |");
  lines.push("|---|---|---|---|");
  let totA = 0, totM = 0;
  for (const r of formRows) {
    const a = r.counts["Avril 2026"], m = r.counts["Mai 2026"];
    if (typeof a === "number") totA += a;
    if (typeof m === "number") totM += m;
    lines.push(`| ${r.label} | ${r.id} | ${a} | ${m} |`);
  }
  lines.push(`| **Total** | — | **${totA}** | **${totM}** |`);
  lines.push("");

  for (const w of WINDOWS) {
    lines.push(`### 2. Répartition par profil d'acteur — ${w.key} (tous formulaires)`);
    lines.push("");
    lines.push("| Profil d'acteur | Nombre de soumissions |");
    lines.push("|---|---|");
    const entries = [...profByWindow[w.key].entries()].sort((x, y) => y[1] - x[1]);
    let tot = 0;
    for (const [k, n] of entries) { lines.push(`| ${k} | ${n} |`); tot += n; }
    lines.push(`| **Total** | **${tot}** |`);
    lines.push("");
  }

  if (errors.length) {
    lines.push("### Erreurs");
    lines.push("");
    for (const e of errors) lines.push(`- ${e}`);
    lines.push("");
  }
  lines.push(`_Généré le ${new Date().toISOString()} — fenêtres : Avril 23–30/04, Mai 23/05–10/06 2026._`);
  lines.push("===REPORT_END===");

  console.log(lines.join("\n"));
}

main().catch((e) => { console.error(e); process.exit(1); });
