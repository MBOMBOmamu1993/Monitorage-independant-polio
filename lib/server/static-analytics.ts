import fs from "fs";
import path from "path";
import zlib from "zlib";
import type { AnalyticsBundle } from "@/lib/types/domain";

const ANALYTICS_DIR = path.join(process.cwd(), "data", "analytics", "provinces");
const CACHE = new Map<string, AnalyticsBundle>();

const REPO_OWNER =
  process.env.BACKFILL_REPO_OWNER ?? process.env.VERCEL_GIT_REPO_OWNER ?? "";
const REPO_SLUG =
  process.env.BACKFILL_REPO_SLUG ?? process.env.VERCEL_GIT_REPO_SLUG ?? "";
const REPO_REF =
  process.env.BACKFILL_REPO_REF ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.VERCEL_GIT_COMMIT_REF ??
  "main";
const GITHUB_TOKEN = process.env.BACKFILL_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN ?? "";

export function provinceSlug(province: string): string {
  return province
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseBundle(buf: Buffer, label: string): AnalyticsBundle | null {
  try {
    const isGzip = buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b;
    const text = isGzip ? zlib.gunzipSync(buf).toString("utf-8") : buf.toString("utf-8");
    return JSON.parse(text) as AnalyticsBundle;
  } catch (e) {
    console.warn(`[static-analytics] parse failed for ${label}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

function readLocal(slug: string): AnalyticsBundle | null {
  for (const ext of ["json.gz", "json"]) {
    const p = path.join(ANALYTICS_DIR, `${slug}.${ext}`);
    if (!fs.existsSync(p)) continue;
    const parsed = parseBundle(fs.readFileSync(p), p);
    if (parsed) return parsed;
  }
  return null;
}

async function fetchRemote(rel: string): Promise<Buffer | null> {
  if (!REPO_OWNER || !REPO_SLUG) return null;

  const urls = [
    `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_SLUG}/${REPO_REF}/${rel}`,
    `https://cdn.jsdelivr.net/gh/${REPO_OWNER}/${REPO_SLUG}@${REPO_REF}/${rel}`,
  ];

  if (GITHUB_TOKEN) {
    urls.push(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_SLUG}/contents/${rel}?ref=${encodeURIComponent(REPO_REF)}`
    );
  }

  for (const url of urls) {
    const isApi = url.includes("api.github.com/repos/");
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: isApi ? "application/vnd.github.raw" : "application/json,application/octet-stream",
          "User-Agent": "RR-Polio-Dashboard/0.1",
          ...(GITHUB_TOKEN && (url.includes("githubusercontent.com") || isApi)
            ? { Authorization: `Bearer ${GITHUB_TOKEN}` }
            : {}),
        },
        next: { revalidate: 3600 },
      });
      if (!res.ok) continue;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      // Try next source.
    } finally {
      clearTimeout(tid);
    }
  }
  return null;
}

export async function loadStaticProvinceAnalytics(
  province: string | null | undefined
): Promise<AnalyticsBundle | null> {
  if (!province) return null;
  const slug = provinceSlug(province);
  const hit = CACHE.get(slug);
  if (hit) return hit;

  const local = readLocal(slug);
  if (local) {
    CACHE.set(slug, local);
    return local;
  }

  for (const ext of ["json.gz", "json"]) {
    const rel = `data/analytics/provinces/${slug}.${ext}`;
    const buf = await fetchRemote(rel);
    if (!buf) continue;
    const parsed = parseBundle(buf, rel);
    if (parsed) {
      CACHE.set(slug, parsed);
      return parsed;
    }
  }

  return null;
}
