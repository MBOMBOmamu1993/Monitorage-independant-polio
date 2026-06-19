/**
 * Provinces concernées par la campagne Polio (2e passage — juin 2026).
 *
 * Ce passage couvre les 21 provinces de la RDC AUTRES que les 5 provinces
 * du 1er passage (Kongo Central, Kwango, Kasai Central, Kasai, Lualaba).
 *
 * Note : cette liste est ensuite utilisée comme FILTRE STRICT au niveau ETL.
 * Toute soumission dont la province normalisée n'est pas dans cette liste
 * est EXCLUE des analyses (elle reste lisible via /admin/raw).
 *
 * Pour modifier le périmètre de la campagne, éditer directement cette liste
 * (et les alias plus bas si l'orthographe ODK varie), puis redéployer.
 */
export const CAMPAIGN_PROVINCES = [
  "Bas Uele",
  "Equateur",
  "Haut Katanga",
  "Haut Lomami",
  "Haut Uele",
  "Ituri",
  "Kasai Oriental",
  "Kinshasa",
  "Kwilu",
  "Lomami",
  "Mai-Ndombe",
  "Maniema",
  "Mongala",
  "Nord Kivu",
  "Nord Ubangi",
  "Sankuru",
  "Sud Kivu",
  "Sud Ubangi",
  "Tanganyika",
  "Tshopo",
  "Tshuapa",
] as const;

export type CampaignProvince = (typeof CAMPAIGN_PROVINCES)[number];

/**
 * Alias province (normalisation douce) pour absorber les variations courantes
 * dans les soumissions ODK.
 *
 * Clé = libellé normalisé (UPPER+strip diacritiques+espaces, voir normKey),
 * Valeur = province canonique.
 *
 * La plupart des provinces n'ont pas besoin d'alias : `normalizeProvince`
 * applique `toHuman(normKey(raw))` qui produit déjà la forme Title Case
 * attendue (ex. "Haut-Katanga" → "Haut Katanga", "Kasaï-Oriental" →
 * "Kasai Oriental"). On ne déclare ici que les cas où la forme ODK ne
 * correspond pas mécaniquement au libellé canonique (ex. Mai-Ndombe écrit
 * tantôt "Maindombe", tantôt "Mai-Ndombe").
 */
export const PROVINCE_ALIASES: Record<string, CampaignProvince> = {
  MAINDOMBE: "Mai-Ndombe",
  "MAI NDOMBE": "Mai-Ndombe",
};
