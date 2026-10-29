# Correction d'affichage — Marge v0.8.4

La grille `.period-metrics` dans l'onglet Analytics ne prévoyait pas de séparation extérieure avant le panneau « Revenus et sorties prévus ».

Correction dans `src/styles/period-budget.css` :

- `margin-bottom: var(--card-gap)` sur `.period-metrics` pour garantir 10 px entre la rangée d'indicateurs et le graphique ;
- `min-width: 0` sur les cartes et les zones de valeurs pour éviter l'élargissement de la grille lors de montants longs ;
- `align-items: stretch` sur la grille pour que ses cellules suivent la hauteur de ligne en responsive.

Les règles existantes sont conservées : 4 colonnes sur écran large, 2 colonnes sous 1190 px, 1 colonne sous 590 px.

Vérifications : 73 tests Node réussis ; build Eleventy 3 réussi ; contrôle géométrique du composant dans Chromium sur 1920, 1366, 1200, 1024, 768 et 390 px. Le test de mise en page utilise des cartes représentatives sans charger l'application connectée ni Web Awesome depuis le CDN.
