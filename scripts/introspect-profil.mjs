/**
 * Introspection v2 : pour chaque formulaire, dump des valeurs distinctes
 * (avec comptes) des champs candidats susceptibles de contenir le "profil
 * d'acteur" (niveau de supervision : national / provincial / axe / équipe /
 * consultant). On cible les clés dont le nom évoque un niveau / une fonction.
 */
const BASE = process.env.ODK_BASE_URL?.trim() || "https://api.whonghub.org";
const TOKEN = process.env.ODK_TOKEN?.trim();
if (!TOKEN) { console.error("ODK_TOKEN manquant"); process.exit(1); }

const FORMS = [4497, 14850, 5645, 9442, 5278, 4501, 4498];

// Mots-clés indiquant un champ "profil / niveau / fonction d'acteur".
const CANDIDATE = /(profil|level|niveau|lvl|superviseur|supervisor|designation|acteur|fonction|qualif|qualite|titre|role|monitored|admin_lvl|reporting|cadre|categorie)/i;

async function fetchAll(id, gte, lte) {
  const all = [];
  let start = 0;
  for (;;) {
    const query = JSON.stringify({ _submission_time: { $gte: gte, $lte: lte } });
    const url = `${BASE}/api/v1/data/${id}.json?query=${encodeURIComponent(query)}&start=${start}&limit=2000`;
    const res = await fetch(url, { headers: { Authorization: `Token ${TOKEN}`, Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const page = await res.json();
    if (!Array.isArray(page)) break;
    all.push(...page);
    if (page.length < 2000) break;
    start += 2000;
  }
  return all;
}

async function main() {
  for (const id of FORMS) {
    // Avril + Mai combinés pour avoir le maximum de variété de valeurs.
    let recs = [];
    try { recs = await fetchAll(id, "2026-04-23", "2026-06-10"); }
    catch (e) { console.log(`===FORM ${id}=== ERROR ${e.message}`); continue; }

    const fieldVals = new Map(); // key -> Map(value -> count)
    for (const r of recs) {
      for (const k of Object.keys(r)) {
        if (!CANDIDATE.test(k)) continue;
        const v = r[k];
        if (v == null || typeof v === "object") continue;
        const val = String(v).trim();
        if (!val) continue;
        if (!fieldVals.has(k)) fieldVals.set(k, new Map());
        const m = fieldVals.get(k);
        m.set(val, (m.get(val) || 0) + 1);
      }
    }

    console.log(`===FORM ${id}=== (n=${recs.length})`);
    for (const [k, m] of fieldVals) {
      const entries = [...m.entries()].sort((a, b) => b[1] - a[1]);
      // n'imprimer que les champs avec un nombre raisonnable de modalités
      // (un vrai champ "profil" est catégoriel, pas du texte libre unique).
      if (entries.length > 40) {
        console.log(`  [${k}] (${entries.length} valeurs distinctes — vraisemblablement texte libre, ignoré)`);
        continue;
      }
      console.log(`  [${k}] ${entries.length} modalités:`);
      for (const [val, n] of entries) console.log(`      ${n.toString().padStart(6)}  ${val}`);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
