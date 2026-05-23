/**
 * Provinces concernées par la campagne intégrée RR-Polio.
 *
 * Note : cette liste est ensuite utilisée comme FILTRE STRICT au niveau ETL.
 * Toute soumission dont la province normalisée n'est pas dans cette liste
 * est EXCLUE des analyses (elle reste lisible via /admin/raw).
 *
 * La liste peut être étendue par l'utilisateur via le fichier
 * config/campaign.config.json sans redéploiement.
 */
export const CAMPAIGN_PROVINCES = [
  "Kongo Central",
  "Kwango",
  "Kwilu",
  "Maindombe",
  "Mongala",
  "Nord Ubangi",
  "Sud Ubangi",
  "Tshopo",
  "Tshuapa",
  "Kinshasa",
  "Equateur",
] as const;

export type CampaignProvince = (typeof CAMPAIGN_PROVINCES)[number];

/**
 * Province sélectionnée par défaut au chargement du dashboard.
 *
 * Pour éviter de charger toute la campagne en une seule réponse Vercel,
 * on démarre sur une seule province : la première par ordre alphabétique
 * dans la liste des provinces de campagne. L'utilisateur peut ensuite
 * changer de province depuis le filtre Province.
 */
export const DEFAULT_DASHBOARD_PROVINCE = [...CAMPAIGN_PROVINCES].sort((a, b) =>
  a.localeCompare(b, "fr"),
)[0] as CampaignProvince;

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
  KWILU: "Kwilu",
  MAINDOMBE: "Maindombe",
  "MAI NDOMBE": "Maindombe",
  "MAI-NDOMBE": "Maindombe",
  "MAÏ-NDOMBE": "Maindombe",
  MONGALA: "Mongala",
  "NORD UBANGI": "Nord Ubangi",
  "NORD-UBANGI": "Nord Ubangi",
  "SUD UBANGI": "Sud Ubangi",
  "SUD-UBANGI": "Sud Ubangi",
  TSHOPO: "Tshopo",
  TSHUAPA: "Tshuapa",
  KINSHASA: "Kinshasa",
  EQUATEUR: "Equateur",
  ÉQUATEUR: "Equateur",
};
