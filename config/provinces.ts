/**
 * Provinces concernées par la campagne intégrée RR-Polio.
 *
 * Note : cette liste est ensuite utilisée comme FILTRE STRICT au niveau ETL.
 * Toute soumission dont la province normalisée n'est pas dans cette liste
 * est EXCLUE des analyses (elle reste lisible via /admin/raw).
 *
 * Pour modifier le périmètre de la campagne, éditer directement cette liste
 * (et les alias plus bas si l'orthographe ODK varie), puis redéployer.
 */
export const CAMPAIGN_PROVINCES = [
  "Kongo Central",
  "Kwango",
  "Kasai Central",
  "Kasai",
  "Lualaba",
] as const;

export type CampaignProvince = (typeof CAMPAIGN_PROVINCES)[number];

/**
 * Alias province (normalisation douce) pour absorber les variations courantes
 * dans les soumissions ODK.
 *
 * Clé = libellé normalisé (UPPER+strip), Valeur = province canonique.
 */
export const PROVINCE_ALIASES: Record<string, CampaignProvince> = {
  "KONGO CENTRAL": "Kongo Central",
  "KONGO-CENTRAL": "Kongo Central",
  "BAS CONGO": "Kongo Central",
  "BAS-CONGO": "Kongo Central",
  KWANGO: "Kwango",
  "KASAI CENTRAL": "Kasai Central",
  "KASAI-CENTRAL": "Kasai Central",
  KASAI: "Kasai",
  LUALABA: "Lualaba",
};
