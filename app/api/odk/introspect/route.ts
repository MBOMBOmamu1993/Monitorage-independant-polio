import { NextResponse } from "next/server";
import { fetchFormSubmissions, introspectKeys } from "@/lib/server/odk-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 55;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const form = (searchParams.get("form") ?? "households") as "households" | "outside";
  const force = searchParams.get("force") === "1";

  console.log(`[api/odk/introspect] requête pour ${form}, force=${force}`);

  try {
    const data = await fetchFormSubmissions(form, { force });
    console.log(`[api/odk/introspect] ${data.count} soumissions récupérées`);
    const info = introspectKeys(data.submissions);
    return NextResponse.json({
      form,
      count: data.count,
      fetchedAt: data.fetchedAt,
      ...info,
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (e: unknown) {
    console.error("[api/odk/introspect] erreur:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, details: msg }, {
      status: 502,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
