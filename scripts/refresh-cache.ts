/**
 * Script CLI : purge le cache ODK et pré-charge les deux formulaires.
 * Usage : `npm run etl:refresh`
 *
 * Utile pour pré-chauffer l'instance avant un déploiement, ou via un cron.
 */
import { fetchFormSubmissions, flushCache } from "@/lib/server/odk-client";

async function main() {
  flushCache();
  const [hh, osh] = await Promise.all([
    fetchFormSubmissions("households", { force: true }),
    fetchFormSubmissions("outside", { force: true }),
  ]);
  console.log(
    `[refresh] households=${hh.count} outside=${osh.count} @ ${new Date().toISOString()}`
  );
}

main().catch((err) => {
  console.error("[refresh] error:", err);
  process.exit(1);
});
