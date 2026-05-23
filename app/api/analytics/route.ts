import { NextResponse } from "next/server";
import { fetchFormSubmissions } from "@/lib/server/odk-client";
import { buildAnalytics, type BuildOptions } from "@/lib/etl/pipeline";
import { ENV } from "@/lib/server/env";
import {
  getCachedBundle,
  setCachedBundle,
  makeFingerprint,
  makeSignature,
} from "@/lib/server/analytics-cache";
import { loadStaticProvinceAnalytics } from "@/lib/server/static-analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// Budget : on demande la durée max Pro (300s) pour absorber le cold start
// avec backfill complet (162k+ soumissions). Vercel applique le min entre
// ce flag et la limite du plan (Hobby 60s, Pro 300s, Enterprise 900s).
export const maxDuration = 300;

// Budget côté route : on abandonne le fetch ODK si on dépasse 150s, ce qui
// laisse ~2.5 min pour buildAnalytics + sérialisation JSON sur 162k+ records.
const ROUTE_FETCH_BUDGET_MS = 150_000;

function withBudget<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`Budget ${ms}ms dépassé pour ${label}`)),
      ms
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const start = ENV.CAMPAIGN_START_DATE;
  const requestedMin = searchParams.get("minDate");
  // Quand CAMPAIGN_INCLUDE_PRE_START=true (défaut), on honore le filtre date
  // de l'utilisateur sans plancher : les soumissions antérieures à la date
  // officielle de début (test runs, données arrivées en avance) sont incluses
  // pour refléter la situation réelle. Quand le flag est false, on applique
  // un plancher dur à CAMPAIGN_START_DATE.
  const minDate = ENV.CAMPAIGN_INCLUDE_PRE_START
    ? requestedMin || null
    : requestedMin && requestedMin > start
    ? requestedMin
    : start;
  // Plafond dur à MONITORING_END_DATE : aucune soumission datée après la fin
  // officielle du monitorage (30/04/2026 par défaut) n'est affichée. Si le
  // filtre utilisateur impose une date plus restrictive (avant le plafond),
  // on la garde.
  const monitoringEnd = ENV.MONITORING_END_DATE;
  const requestedMax = searchParams.get("maxDate");
  const maxDate =
    requestedMax && requestedMax < monitoringEnd ? requestedMax : monitoringEnd;
  const restrict = searchParams.get("restrict") !== "0";
  const force = searchParams.get("force") === "1";

  // Seuls les filtres qui réduisent matériellement le volume du bundle sont
  // appliqués serveur-side : restrict + dates + province. Tous les autres
  // filtres (antenne/ZS/AS/locality/type/profil/moniteur/contexte) sont
  // appliqués côté client via la FactTable retournée → filtrage instantané.
  const province = searchParams.get("province");

  const opts: BuildOptions = {
    restrictToCampaignProvinces: restrict,
    minDate: minDate ?? undefined,
    maxDate: maxDate ?? undefined,
    province: province ?? undefined,
  };

  // Fast path: serve pre-built static bundle (data/analytics/provinces/{slug}.json.gz).
  // Built by `npm run build:analytics` and committed to the repo / served via GitHub CDN.
  // Province switching becomes instant (<100ms) instead of 10-180s.
  if (!force) {
    const staticBundle = await loadStaticProvinceAnalytics(province);
    if (staticBundle) {
      console.log(`[api/analytics] STATIC HIT province=${province}`);
      const lean = {
        ...staticBundle,
        submissions: [] as typeof staticBundle.submissions,
        children: [] as typeof staticBundle.children,
      };
      return NextResponse.json(lean, { headers: cacheHeaders("static") });
    }
  }

  try {
    const t0 = Date.now();
    const [hh, osh] = await withBudget(
      Promise.all([
        fetchFormSubmissions("households", { force }),
        fetchFormSubmissions("outside", { force }),
      ]),
      ROUTE_FETCH_BUDGET_MS,
      "fetch ODK"
    );
    const tFetch = Date.now() - t0;

    // Cache lookup APRÈS le fetch ODK : le fingerprint dépend de hh/osh
    // (count + fetchedAt), donc dès que la donnée brute change, les bundles
    // mis en cache pour l'ancien dataset sont automatiquement ignorés
    // — pas de risque de servir un bundle obsolète.
    const fingerprint = makeFingerprint(hh, osh);
    const signature = makeSignature(opts);
    if (!force) {
      const cached = getCachedBundle(fingerprint, signature);
      if (cached) {
        const tCache = Date.now() - t0;
        console.log(
          `[api/analytics] CACHE HIT fetch=${tFetch}ms total=${tCache}ms sig=${signature.slice(0, 60)}…`
        );
        return NextResponse.json(cached, {
          headers: cacheHeaders("hit"),
        });
      }
    }

    const t1 = Date.now();
    const bundle = buildAnalytics(hh, osh, opts);
    const tBuild = Date.now() - t1;

    // submissions/children restent vides (volumineux et inutilisés client-side).
    // factTable est CONSERVÉE : son volume est désormais maîtrisé puisqu'elle
    // est calculée sur la province sélectionnée (~30k subs × ~10 dims agrégées
    // → quelques milliers de lignes ≪ 4.5 MB). Elle alimente le filtrage
    // client-side instantané pour tous les filtres non-géo et la cascade
    // dynamique des dropdowns.
    const t2 = Date.now();
    const lean = {
      ...bundle,
      submissions: [] as typeof bundle.submissions,
      children: [] as typeof bundle.children,
    };
    const tStrip = Date.now() - t2;

    setCachedBundle(fingerprint, signature, lean);

    console.log(
      `[api/analytics] CACHE MISS fetch=${tFetch}ms build=${tBuild}ms strip=${tStrip}ms ` +
        `subsRaw=${bundle.submissions.length} childrenRaw=${bundle.children.length} (omitted from response)`
    );

    return NextResponse.json(lean, {
      headers: cacheHeaders("miss"),
    });
  } catch (e: unknown) {
    console.error("[api/analytics] erreur:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: msg },
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  }
}

function cacheHeaders(state: "hit" | "miss" | "static"): Record<string, string> {
  // Static bundles are pre-built at deploy time → longer browser cache (5 min).
  // Dynamic bundles change with ODK data → short cache (30s + 60s stale).
  const maxAge = state === "static" ? 300 : 30;
  const swr = state === "static" ? 3600 : 60;
  return {
    "Cache-Control": `private, max-age=${maxAge}, stale-while-revalidate=${swr}`,
    "X-Analytics-Cache": state,
  };
}
