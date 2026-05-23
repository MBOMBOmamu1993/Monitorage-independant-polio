/**
 * Script CLI : introspection de schéma pour chaque formulaire.
 * Usage : `npm run etl:introspect`
 *
 * Affiche les clés top-level observées et les clés de groupes/repeats,
 * afin de vérifier et ajuster `config/field-map.ts` si besoin.
 */
import { fetchFormSubmissions, introspectKeys } from "@/lib/server/odk-client";

async function main() {
  for (const form of ["households", "outside"] as const) {
    const data = await fetchFormSubmissions(form, { force: false });
    const info = introspectKeys(data.submissions);
    console.log(`\n=== ${form} (count=${data.count}) ===`);
    console.log("top-level keys:");
    for (const k of info.topLevelKeys) console.log("  -", k);
    for (const [rk, keys] of Object.entries(info.repeatKeys)) {
      console.log(`repeat "${rk}":`);
      for (const ck of keys) console.log("  -", ck);
    }
  }
}

main().catch((err) => {
  console.error("[introspect] error:", err);
  process.exit(1);
});
