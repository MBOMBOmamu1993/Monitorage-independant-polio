import { NextResponse } from "next/server";
import { fetchFormSubmissions } from "@/lib/server/odk-client";
import { parseSubmission } from "@/lib/etl/parse-submission";
import { CAMPAIGN_PROVINCES } from "@/config/provinces";
import { ENV } from "@/lib/server/env";
import type { OdkSubmissionBase } from "@/lib/types/odk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Même budget que /api/analytics : charge tous les backfill (200k+ households)
// et parse chaque soumission. Sans cette borne, Vercel kill à 60s par défaut
// — le retry CDN n'a même pas le temps d'aboutir et le diagnostic timeout.
export const maxDuration = 300;

type FormBucket = { households: number; outside: number; total: number };

function emptyBucket(): FormBucket {
  return { households: 0, outside: 0, total: 0 };
}

function bumpBucket(b: FormBucket, formKey: "households" | "outside") {
  b[formKey]++;
  b.total++;
}

interface BucketContext {
  set: Set<string>;
  minDate: string | null;
  maxDate: string | null;
  included: FormBucket;
  excludedEmpty: FormBucket;
  excludedPreCampaign: FormBucket;
  excludedPostCampaign: FormBucket;
  excludedKnown: Map<string, FormBucket>;
}

function bucketSubmissions(
  submissions: OdkSubmissionBase[],
  context: "Household" | "Outside",
  formKey: "households" | "outside",
  ctx: BucketContext
) {
  for (const s of submissions) {
    const p = parseSubmission(s, context);
    const prov = p.submission.orgUnit.province;

    // 1. Province manquante / non normalisable → exclu (qualité de données)
    if (!prov || prov === "Inconnue") {
      bumpBucket(ctx.excludedEmpty, formKey);
      continue;
    }

    // 2. Province reconnue mais hors campagne (Tanganyika, Ituri…)
    if (!ctx.set.has(prov)) {
      let entry = ctx.excludedKnown.get(prov);
      if (!entry) {
        entry = emptyBucket();
        ctx.excludedKnown.set(prov, entry);
      }
      bumpBucket(entry, formKey);
      continue;
    }

    // 3. Province campagne mais date hors fenêtre de monitorage — c'est ce que
    //    l'analytics applique aussi (plancher minDate, plafond maxDate). Sans
    //    ces buckets, le diagnostic montrait toujours ~80 records de plus que
    //    le dashboard et l'utilisateur ne pouvait pas réconcilier.
    const date = p.submission.monitoringDate ?? p.submission.submissionTime.slice(0, 10);
    if (ctx.minDate && date < ctx.minDate) {
      bumpBucket(ctx.excludedPreCampaign, formKey);
      continue;
    }
    if (ctx.maxDate && date > ctx.maxDate) {
      bumpBucket(ctx.excludedPostCampaign, formKey);
      continue;
    }

    bumpBucket(ctx.included, formKey);
  }
}

export async function GET() {
  try {
    const [households, outside] = await Promise.all([
      fetchFormSubmissions("households"),
      fetchFormSubmissions("outside"),
    ]);

    // On reproduit la même logique que /api/analytics pour que `included.total`
    // matche exactement le KPI "Soumissions totales" du dashboard.
    const minDate = ENV.CAMPAIGN_INCLUDE_PRE_START ? null : ENV.CAMPAIGN_START_DATE;
    const maxDate = ENV.MONITORING_END_DATE || null;

    const ctx: BucketContext = {
      set: new Set(CAMPAIGN_PROVINCES as readonly string[]),
      minDate,
      maxDate,
      included: emptyBucket(),
      excludedEmpty: emptyBucket(),
      excludedPreCampaign: emptyBucket(),
      excludedPostCampaign: emptyBucket(),
      excludedKnown: new Map<string, FormBucket>(),
    };

    bucketSubmissions(households.submissions, "Household", "households", ctx);
    bucketSubmissions(outside.submissions, "Outside", "outside", ctx);

    const excludedKnownList = Array.from(ctx.excludedKnown.entries())
      .map(([province, counts]) => ({ province, ...counts }))
      .sort((a, b) => b.total - a.total);

    const excludedKnownTotal = excludedKnownList.reduce((acc, x) => acc + x.total, 0);
    const total =
      ctx.included.total +
      ctx.excludedEmpty.total +
      ctx.excludedPreCampaign.total +
      ctx.excludedPostCampaign.total +
      excludedKnownTotal;

    return NextResponse.json({
      total,
      filters: { minDate, maxDate, includePreStart: ENV.CAMPAIGN_INCLUDE_PRE_START },
      included: ctx.included,
      excludedEmpty: ctx.excludedEmpty,
      excludedPreCampaign: ctx.excludedPreCampaign,
      excludedPostCampaign: ctx.excludedPostCampaign,
      excludedKnown: excludedKnownList,
      excludedKnownTotal,
      campaignProvinces: CAMPAIGN_PROVINCES,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
