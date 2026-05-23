import { NextResponse } from "next/server";
import { fetchFormSubmissions } from "@/lib/server/odk-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 55;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const form = (searchParams.get("form") ?? "households") as "households" | "outside";
  const force = searchParams.get("force") === "1";
  const limit = Number(searchParams.get("limit") ?? "0");

  console.log(`[api/odk/raw] requête pour ${form}, force=${force}, limit=${limit}`);

  try {
    const data = await fetchFormSubmissions(form, { force });
    console.log(`[api/odk/raw] ${data.count} soumissions récupérées`);
    const out = limit ? { ...data, submissions: data.submissions.slice(0, limit), count: Math.min(limit, data.count) } : data;
    return NextResponse.json(out, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (e: unknown) {
    console.error("[api/odk/raw] erreur:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, details: msg }, {
      status: 502,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
