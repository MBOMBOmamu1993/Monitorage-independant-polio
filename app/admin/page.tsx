"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Grid } from "@/components/ui/Grid";
import { triggerRefresh } from "@/lib/client/api";

const STORAGE_KEY = "rrpolio-admin-unlocked";
const PUBLIC_HASH = process.env.NEXT_PUBLIC_ADMIN_PASSCODE_HASH ?? "";

async function sha256Hex(s: string): Promise<string> {
  const b = new TextEncoder().encode(s);
  const h = await crypto.subtle.digest("SHA-256", b);
  return Array.from(new Uint8Array(h))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}

function Gate({ onUnlock }: { onUnlock: () => void }) {
  const [v, setV] = useState("");
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const expected = PUBLIC_HASH || (await sha256Hex("mbombo-admin-2026"));
    const input = await sha256Hex(v.trim());
    if (input === expected) {
      sessionStorage.setItem(STORAGE_KEY, "1");
      onUnlock();
    } else {
      setErr("Code incorrect.");
    }
  }
  return (
    <div className="max-w-md mx-auto mt-10">
      <Card>
        <CardHeader title="🔒 Accès restreint" subtitle="Admin · Saisir le code d'accès" />
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            className="input"
            placeholder="Code admin"
            value={v}
            onChange={(e) => setV(e.target.value)}
            autoFocus
          />
          {err ? <div className="text-xs text-danger-600">{err}</div> : null}
          <button className="btn-primary w-full" type="submit">
            Déverrouiller
          </button>
        </form>
      </Card>
    </div>
  );
}

export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(STORAGE_KEY) === "1") {
      setUnlocked(true);
    }
  }, []);

  if (!unlocked) return <Gate onUnlock={() => setUnlocked(true)} />;

  async function callApi(url: string, label: string) {
    setBusy(true);
    setLog(`⏳ ${label}…`);
    try {
      const res = await fetch(url, { cache: "no-store" });
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `HTTP ${res.status} — réponse non-JSON (${ct || "type inconnu"}):\n${text.slice(0, 400)}`
        );
      }
      const data = await res.json();
      if (!res.ok) {
        setLog(`⚠️ HTTP ${res.status}\n` + JSON.stringify(data, null, 2));
      } else {
        setLog(JSON.stringify(data, null, 2));
      }
    } catch (e) {
      setLog(`❌ ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Admin — diagnostic & données brutes"
        subtitle="Réservé aux administrateurs · diagnostic ODK"
      />

      <Grid cols={3} className="mb-4">
        <Card>
          <CardHeader title="Rafraîchir le cache" />
          <p className="text-sm text-surface-700 mb-3">
            Vide le cache serveur puis recharge les données ODK.
          </p>
          <button
            disabled={busy}
            className="btn-primary"
            onClick={async () => {
              setBusy(true);
              setLog("⏳ Flush…");
              try {
                await triggerRefresh();
                setLog("✅ Cache vidé.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Vider le cache
          </button>
        </Card>

        <Card>
          <CardHeader title="Introspection schéma" />
          <div className="flex flex-col gap-2">
            <button
              disabled={busy}
              className="btn"
              onClick={() => callApi("/api/odk/introspect?form=households", "Introspection households")}
            >
              Introspection ménage
            </button>
            <button
              disabled={busy}
              className="btn"
              onClick={() => callApi("/api/odk/introspect?form=outside", "Introspection outside")}
            >
              Introspection hors-ménage
            </button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Données brutes" />
          <div className="flex flex-col gap-2">
            <button
              disabled={busy}
              className="btn"
              onClick={() => callApi("/api/odk/raw?form=households&limit=3", "Raw households (3)")}
            >
              Échantillon ménage
            </button>
            <button
              disabled={busy}
              className="btn"
              onClick={() => callApi("/api/odk/raw?form=outside&limit=3", "Raw outside (3)")}
            >
              Échantillon hors-ménage
            </button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Statut backfill" subtitle="Données historiques GitHub" />
          <div className="flex flex-col gap-2">
            <button
              disabled={busy}
              className="btn"
              onClick={() => callApi("/api/admin/backfill-status", "Statut backfill")}
            >
              Voir statut backfill
            </button>
            <p className="text-xs text-surface-500">
              Reconstruit via <code>npm run backfill:build</code>
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Diagnostic provinces"
            subtitle="Pourquoi le total dashboard < total backfill ?"
          />
          <div className="flex flex-col gap-2">
            <button
              disabled={busy}
              className="btn"
              onClick={() =>
                callApi("/api/admin/province-breakdown", "Répartition par province")
              }
            >
              Voir répartition
            </button>
            <p className="text-xs text-surface-500">
              Liste les soumissions exclues du dashboard (province hors campagne, vide ou non
              reconnue).
            </p>
          </div>
        </Card>
      </Grid>

      <Card>
        <CardHeader
          title="Sortie"
          subtitle="Résultat JSON de la dernière action"
          right={
            <button
              className="btn"
              onClick={() => {
                sessionStorage.removeItem(STORAGE_KEY);
                setUnlocked(false);
              }}
            >
              🔒 Verrouiller
            </button>
          }
        />
        <pre className="text-[11px] leading-relaxed bg-surface-100 rounded-md p-3 overflow-auto max-h-[520px] whitespace-pre-wrap">
          {log || "— Aucun appel pour le moment —"}
        </pre>
      </Card>
    </>
  );
}
