"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "rrpolio-site-unlocked";
const PUBLIC_HASH = process.env.NEXT_PUBLIC_SITE_PASSCODE_HASH ?? "";
const DEFAULT_PASSCODE = "mbombo-rrpolio-2026";

async function sha256Hex(s: string): Promise<string> {
  const b = new TextEncoder().encode(s);
  const h = await crypto.subtle.digest("SHA-256", b);
  return Array.from(new Uint8Array(h))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}

export default function SiteGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [v, setV] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(STORAGE_KEY) === "1") {
      setUnlocked(true);
    }
    setReady(true);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const expected = PUBLIC_HASH || (await sha256Hex(DEFAULT_PASSCODE));
    const input = await sha256Hex(v.trim());
    if (input === expected) {
      sessionStorage.setItem(STORAGE_KEY, "1");
      setUnlocked(true);
    } else {
      setErr("Code incorrect.");
    }
  }

  if (!ready) return null;
  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 p-6">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
        <h1 className="text-lg font-semibold mb-1">🔒 Accès restreint</h1>
        <p className="text-sm text-surface-700 mb-4">
          Polio · Saisir le code d'accès pour consulter le dashboard.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            className="input"
            placeholder="Code d'accès"
            value={v}
            onChange={(e) => setV(e.target.value)}
            autoFocus
          />
          {err ? <div className="text-xs text-danger-600">{err}</div> : null}
          <button className="btn-primary w-full" type="submit">
            Déverrouiller
          </button>
        </form>
      </div>
    </div>
  );
}
