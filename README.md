# Monitorage indépendant Polio — RDC

Dashboard web d'aide à la décision pour le monitorage indépendant de la
campagne **Polio (nVPO2 + VPOb)** en République Démocratique du Congo.

Pages : Vue d'ensemble · Polio · Raisons & Refus · Cartographie ·
Surveillance épidémiologique · Performance moniteurs · Admin · Télécharger
le rapport.

## Source de données (ODK / ONA)

Le dashboard lit le formulaire de monitorage Polio via l'API ONA :

```
https://api.whonghub.org/api/v1/data/4498.json
```

La fenêtre de monitorage affichée est bornée par les variables
d'environnement (voir `.env.example`) : seules les soumissions datées du
**23/05/2026 au 10/06/2026** sont prises en compte.

## Configuration

Copier `.env.example` vers `.env.local` (en local) ou définir les variables
sur Vercel :

| Variable | Valeur |
|---|---|
| `ODK_TOKEN` | jeton API ONA |
| `ODK_HOUSEHOLDS_FORM_URL` | `https://api.whonghub.org/api/v1/data/4498.json` |
| `ODK_OUTSIDE_FORM_URL` | `https://api.whonghub.org/api/v1/data/4499.json` |
| `CAMPAIGN_START_DATE` | `2026-05-23` |
| `MONITORING_END_DATE` | `2026-06-10` |
| `CAMPAIGN_INCLUDE_PRE_START` | `false` |

## Développement

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de production
npm run typecheck
```

## Déploiement Vercel

1. Importer ce repo dans Vercel (Framework : **Next.js**, détecté automatiquement).
2. Renseigner les variables d'environnement ci-dessus dans
   *Settings → Environment Variables*.
3. Déployer.
