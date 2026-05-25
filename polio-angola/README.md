# Rapport — Campagne de vaccination polio synchronisée avec l'Angola

Application web à **deux pages** pour les 5 provinces de la RDC organisant la campagne
polio synchronisée avec l'Angola (co-administration **nVPO2** + **VPOb**).

1. **Importer le masque de saisie** — chaque niveau (province / antenne / zone de santé)
   importe son masque Excel. Les analyses sont calculées instantanément dans le
   navigateur. Réimporter remplace automatiquement l'ancienne version.
2. **Télécharger le rapport** — filtres en cascade (Province → Antenne → ZS → Aire de
   Santé) et génération d'un rapport **PowerPoint (.pptx)** reproduisant le modèle
   officiel (composante polio uniquement).

> Aucune donnée n'est envoyée à un serveur : tout le traitement se fait côté navigateur
> et le masque importé est conservé localement (localStorage).

## Développement

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de production
```

## Structure

- `app/import` — page d'import du masque de saisie.
- `app/rapport` — page de filtres + génération du rapport PPTX.
- `lib/parse-masque.ts` — lecture de la feuille « Synthèse » du masque (polio only).
- `lib/analytics.ts` — filtres en cascade + agrégation des indicateurs.
- `lib/export-report-pptx.ts` — génération du rapport PowerPoint.
- `public/cover-polio.png` — image de la page de garde ; `public/logo/pev.png` — logo PEV.

## Déploiement Vercel

1. Pousser ce dossier dans un dépôt GitHub.
2. Sur https://vercel.com → **Add New Project** → importer le dépôt.
3. Framework **Next.js** détecté automatiquement. Si l'application est dans un
   sous-dossier, définir **Root Directory** = `polio-angola`.
4. **Deploy**. Vercel fournit l'URL publique à partager à tous les niveaux.
