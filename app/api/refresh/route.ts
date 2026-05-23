import { NextResponse } from "next/server";
import { markCacheStale } from "@/lib/server/odk-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    markCacheStale();
    return NextResponse.json({ ok: true, staleAt: new Date().toISOString() }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (e: unknown) {
    console.error("[api/refresh] erreur:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  try {
    markCacheStale();
    return NextResponse.json({ ok: true, staleAt: new Date().toISOString() }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (e: unknown) {
    console.error("[api/refresh] erreur:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
