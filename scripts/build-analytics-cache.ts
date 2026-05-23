#!/usr/bin/env tsx
/**
 * Builds static analytics bundles for every campaign province and writes them to
 * data/analytics/provinces/{slug}.json.gz
 *
 * Usage:
 *   npm run build:analytics
 *
 * The bundles are committed to the repo and served directly by the API route
 * (fast path), bypassing the expensive ODK fetch + buildAnalytics on every
 * province switch. This mirrors the SNIS dashboard approach: pre-aggregate
 * server-side, filter client-side via FactTable.
 *
 * After running this script, commit the generated files and redeploy.
 * The API route reads them from the filesystem locally and from GitHub CDN
 * on Vercel (via lib/server/static-analytics.ts).
 */

import fs from "fs";
import path from "path";
import zlib from "zlib";
import { config as loadEnv } from "dotenv";

// Load env variables before importing server modules that read process.env
loadEnv({ path: ".env.local" });

import { CAMPAIGN_PROVINCES } from "../config/provinces";
import { fetchFormSubmissions } from "../lib/server/odk-client";
import { buildAnalytics } from "../lib/etl/pipeline";
import { provinceSlug } from "../lib/server/static-analytics";

const OUTPUT_DIR = path.join(process.cwd(), "data", "analytics", "provinces");

async function buildForProvince(
  province: string,
  hh: Awaited<ReturnType<typeof fetchFormSubmissions>>,
  osh: Awaited<ReturnType<typeof fetchFormSubmissions>>
): Promise<{ slug: string; sizeKB: number; factRows: number }> {
  const t0 = Date.now();
  const bundle = buildAnalytics(hh, osh, {
    restrictToCampaignProvinces: true,
    province,
  });

  const lean = {
    ...bundle,
    submissions: [] as typeof bundle.submissions,
    children: [] as typeof bundle.children,
  };

  const json = JSON.stringify(lean);
  const compressed = zlib.gzipSync(Buffer.from(json, "utf-8"), { level: 9 });

  const slug = provinceSlug(province);
  const outPath = path.join(OUTPUT_DIR, `${slug}.json.gz`);
  fs.writeFileSync(outPath, compressed);

  const elapsed = Date.now() - t0;
  const sizeKB = Math.round(compressed.length / 1024);
  const factRows = bundle.factTable?.length ?? 0;
  console.log(
    `  ✓ ${province} → ${slug}.json.gz (${sizeKB} KB, ${factRows} fact rows, ${elapsed}ms)`
  );
  return { slug, sizeKB, factRows };
}

async function main(): Promise<void> {
  console.log("=== build:analytics — Building static province bundles ===\n");

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("Fetching ODK data (backfill + incremental)...");
  const t0 = Date.now();
  const [hh, osh] = await Promise.all([
    fetchFormSubmissions("households"),
    fetchFormSubmissions("outside"),
  ]);
  console.log(
    `ODK fetch done in ${Date.now() - t0}ms: ${hh.count} households, ${osh.count} outside\n`
  );

  console.log(`Building ${CAMPAIGN_PROVINCES.length} province bundles...\n`);
  const results: Array<{ slug: string; sizeKB: number; factRows: number }> = [];
  for (const province of CAMPAIGN_PROVINCES) {
    const r = await buildForProvince(province, hh, osh);
    results.push(r);
  }

  const totalKB = results.reduce((s, r) => s + r.sizeKB, 0);
  console.log(`\nDone! ${results.length} bundles — ${totalKB} KB total`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(
    "\nNext steps:\n" +
      "  git add data/analytics/provinces/\n" +
      "  git commit -m 'chore: rebuild analytics bundles'\n" +
      "  git push"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
