/**
 * Introspection rapide : pour chaque formulaire, liste les clés contenant
 * "profil" (insensible à la casse) et un échantillon de valeurs distinctes.
 * Une seule petite page par formulaire → rapide.
 */
const BASE = process.env.ODK_BASE_URL?.trim() || "https://api.whonghub.org";
const TOKEN = process.env.ODK_TOKEN?.trim();
if (!TOKEN) { console.error("ODK_TOKEN manquant"); process.exit(1); }

const FORMS = [4497, 14850, 5645, 9442, 5278, 4501, 4498];

async function sample(id) {
  const query = JSON.stringify({ _submission_time: { $gte: "2026-04-23", $lte: "2026-06-10" } });
  const url = `${BASE}/api/v1/data/${id}.json?query=${encodeURIComponent(query)}&start=0&limit=50`;
  const res = await fetch(url, { headers: { Authorization: `Token ${TOKEN}`, Accept: "application/json" } });
  if (!res.ok) return { id, error: `HTTP ${res.status}` };
  const data = await res.json();
  if (!Array.isArray(data) || !data.length) return { id, error: "vide" };
  const profilKeys = new Map(); // key -> Set of sample values
  for (const rec of data) {
    for (const k of Object.keys(rec)) {
      if (k.toLowerCase().includes("profil")) {
        if (!profilKeys.has(k)) profilKeys.set(k, new Set());
        const s = profilKeys.get(k);
        if (s.size < 12) s.add(JSON.stringify(rec[k]));
      }
    }
  }
  return {
    id,
    sampleSize: data.length,
    profilKeys: [...profilKeys.entries()].map(([k, v]) => ({ key: k, values: [...v] })),
    allKeysSample: Object.keys(data[0]),
  };
}

async function main() {
  for (const id of FORMS) {
    const r = await sample(id);
    console.log("===FORM " + id + "===");
    console.log(JSON.stringify(r, null, 2));
  }
}
main().catch(e => { console.error(e); process.exit(1); });
