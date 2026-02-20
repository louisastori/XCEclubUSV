# Deployment GitHub Pages

Ce depot publie automatiquement une version statique du site via GitHub Pages.

## Ce qui est deploye

- `Web/index.php` est copie en `index.html`.
- `Web/src/public/js/*` est copie dans `js/`.
- Le resultat est publie depuis `Web/dist-pages`.

## Activation (a faire une seule fois)

1. Ouvrir `Settings > Pages` dans le repo GitHub.
2. Dans `Build and deployment`, choisir `Source: GitHub Actions`.
3. Pousser sur `main` (ou lancer le workflow `Deploy GitHub Pages` manuellement).

## Limite importante

GitHub Pages est statique: il ne peut pas executer le serveur Node/Express ni SQLite.
La version complete de l'application (`node src/server.js`) doit etre hebergee sur une plateforme backend (Render, Railway, VPS, etc.).
