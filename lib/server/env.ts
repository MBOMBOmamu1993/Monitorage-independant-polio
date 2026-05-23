/**
 * Centralise l'accès aux variables d'environnement serveur.
 * Ne JAMAIS importer ce fichier depuis un composant client.
 */

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) {
    // On préfère un throw clair au runtime qu'un comportement silencieux.
    throw new Error(`[env] variable ${name} manquante — vérifier .env.local`);
  }
  return v;
}

function opt(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const ENV = {
  ODK_BASE_URL: opt("ODK_BASE_URL", "https://api.whonghub.org"),
  ODK_TOKEN: opt("ODK_TOKEN"),
  ODK_USERNAME: opt("ODK_USERNAME"),
  ODK_PASSWORD: opt("ODK_PASSWORD"),
  ODK_HOUSEHOLDS_FORM_URL: opt(
    "ODK_HOUSEHOLDS_FORM_URL",
    "https://api.whonghub.org/api/v1/data/4498.json"
  ),
  ODK_OUTSIDE_FORM_URL: opt(
    "ODK_OUTSIDE_FORM_URL",
    "https://api.whonghub.org/api/v1/data/4499.json"
  ),
  ODK_HOUSEHOLDS_FORM_ID: Number(opt("ODK_HOUSEHOLDS_FORM_ID", "4498")),
  ODK_OUTSIDE_FORM_ID: Number(opt("ODK_OUTSIDE_FORM_ID", "4499")),
  CAMPAIGN_START_DATE: opt("CAMPAIGN_START_DATE", "2026-05-23"),
  CAMPAIGN_INCLUDE_PRE_START:
    (opt("CAMPAIGN_INCLUDE_PRE_START", "false") || "").toLowerCase() === "true",
  MONITORING_END_DATE: opt("MONITORING_END_DATE", "2026-06-10"),
  CACHE_TTL_SECONDS: Number(opt("CACHE_TTL_SECONDS", "3600")) || 3600, // 1 heure par défaut
};

export function odkAuthHeader(): Record<string, string> {
  if (ENV.ODK_TOKEN) {
    return { Authorization: `Token ${ENV.ODK_TOKEN}` };
  }
  if (ENV.ODK_USERNAME && ENV.ODK_PASSWORD) {
    const credentials = `${ENV.ODK_USERNAME}:${ENV.ODK_PASSWORD}`;
    // Compatibilité Edge Runtime (btoa) et Node.js (Buffer)
    const b64 = typeof btoa !== "undefined" ? btoa(credentials) : Buffer.from(credentials).toString("base64");
    return { Authorization: `Basic ${b64}` };
  }
  throw new Error("[env] Aucune authentification ODK configurée (ODK_TOKEN ou ODK_USERNAME/ODK_PASSWORD).");
}

/** Utilitaire pour logs côté serveur (évite d'exposer le token). */
export function sanitizeLog(obj: unknown): unknown {
  try {
    const s = JSON.stringify(obj);
    return JSON.parse(s.replace(/Token\s+[^"]+/gi, "Token ***").replace(/Basic\s+[^"]+/gi, "Basic ***"));
  } catch {
    return obj;
  }
}

export { req };
