# Deployment GitHub Pages

Ce depot publie automatiquement une version statique du site via GitHub Pages.

## Ce qui est deploye

- Le contenu de `Web/pages/` est publie tel quel.
- Un `404.html` est genere automatiquement depuis `index.html` s'il manque.
- `Web/src/public/js/*` est copie dans `Web/dist-pages/js/`.
- Le resultat final est `Web/dist-pages/`.

## Activation (a faire une seule fois)

1. Ouvrir `Settings > Pages` dans le repo GitHub.
2. Dans `Build and deployment`, choisir `Source: GitHub Actions`.
3. Pousser sur `main` (ou lancer le workflow `Deploy GitHub Pages` manuellement).

## Notes de fonctionnement

- La version GitHub Pages est maintenant une SPA 100% front avec `localStorage`.
- Elle ne depend pas de PHP, Node/Express ni SQLite.
- Les donnees sont locales au navigateur: changer de navigateur/appareil repart de zero.
- La version backend historique (`node src/server.js`) peut continuer a etre utilisee en local ou sur un hebergement serveur.
