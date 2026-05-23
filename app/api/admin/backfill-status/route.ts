import { NextResponse } from "next/server";
import { loadBackfillMeta, getBackfillLoadStats } from "@/lib/server/backfill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Lecture seule de meta.json : généralement <1s. On lève quand même la borne
// pour absorber un cold start lent ou un fetch GitHub temporairement saturé.
export const maxDuration = 60;

export async function GET() {
  try {
    const meta = await loadBackfillMeta();
    const ready = meta.households.count > 0 || meta.outside.count > 0;

    // Diagnostic env : aide à comprendre pourquoi le backfill peut être vide
    // en prod (repo privé sans GITHUB_TOKEN, REPO_OWNER manquant, etc.).
    const hasGithubToken = Boolean(
      process.env.BACKFILL_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN
    );
    const repoOwner =
      process.env.BACKFILL_REPO_OWNER ?? process.env.VERCEL_GIT_REPO_OWNER ?? null;
    const repoSlug =
      process.env.BACKFILL_REPO_SLUG ?? process.env.VERCEL_GIT_REPO_SLUG ?? null;
    const repoRef =
      process.env.BACKFILL_REPO_REF ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.VERCEL_GIT_COMMIT_REF ??
      "main";

    const hint = !ready
      ? !hasGithubToken && repoOwner
        ? "Backfill vide : si le repo est PRIVÉ, ajouter GITHUB_TOKEN (PAT avec Contents: read) sur Vercel."
        : !repoOwner
        ? "Backfill vide : VERCEL_GIT_REPO_OWNER non défini."
        : "Backfill vide : meta.json introuvable sur le ref distant. Vérifier les logs Vercel."
      : null;

    const loadStats = getBackfillLoadStats();
    const totalLoaded =
      (loadStats.households?.recordsLoaded ?? 0) + (loadStats.outside?.recordsLoaded ?? 0);
    const totalFailed =
      (loadStats.households?.filesFailed ?? 0) + (loadStats.outside?.filesFailed ?? 0);
    const loadHint = totalFailed
      ? `⚠️ ${totalFailed} fichier(s) snapshot ont échoué — ${
          (meta.households.count + meta.outside.count) - totalLoaded
        } soumissions manquantes. Cliquer "Vider le cache" puis recharger pour retenter.`
      : null;

    return NextResponse.json({
      backfill: {
        households: {
          count: meta.households.count,
          latestSubmissionTime: meta.households.latestSubmissionTime,
          lastUpdated: meta.households.lastUpdated,
          files: meta.households.files.length,
        },
        outside: {
          count: meta.outside.count,
          latestSubmissionTime: meta.outside.latestSubmissionTime,
          lastUpdated: meta.outside.lastUpdated,
          files: meta.outside.files.length,
        },
      },
      totalRecords: meta.households.count + meta.outside.count,
      ready,
      loadStats,
      totalLoaded,
      env: {
        repoOwner,
        repoSlug,
        repoRef: repoRef.slice(0, 12),
        hasGithubToken,
      },
      ...(loadHint ? { loadHint } : {}),
      ...(hint ? { hint } : {}),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
