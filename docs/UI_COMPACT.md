# Marge. — UI compacte (v0.8.3)

## Objectif

Afficher un maximum d'informations sur un écran desktop sans rendre la saisie inconfortable. Une page mobile reste naturellement défilante.

## Répartition des styles

- `main.css` : structure et apparence native de la V3.
- `webawesome.css` : palette vert sauge, variantes de boutons, badges/progression et statut Drive.
- `compact.css` : hauteur de navigation, densité des cartes, habillage des `wa-select`, `wa-input`, `wa-dialog` et points de rupture.

## Composants

| Usage | Composant |
|---|---|
| Mois, année, catégories, type de compte | `wa-select` + `wa-option` |
| Actions, navigation, édition/suppression | `wa-button` |
| Indications au survol | `wa-tooltip` |
| Formulaires courts | `wa-input` |
| Texte libre | `wa-textarea` |
| Édition et synchronisation concurrente | `wa-dialog` |
| Progression des projets | `wa-progress-bar` |

La grande grille annuelle conserve des `input` HTML : la multiplication des Web Components pour 12 colonnes × de nombreux postes coûterait en performances et en lisibilité. Les graphiques SVG et les lignes de liste sont conservés comme HTML/CSS natifs.

## Écrans

- Desktop ≥1200px : 3 colonnes, sections sur trois rangées, aperçu des 4 dernières transactions du mois.
- Tablette 881–1199px : 2 colonnes, navigation en seconde ligne.
- Mobile ≤880px : 1 colonne, composants compacts mais touchables ; défilement normal.

## Accessibilité et gestion des données

Chaque bouton icône porte un nom accessible. Les contrôles ont des labels ; les montants éditables gardent la validation d'origine. Les changements de UI ne changent ni le schéma de données, ni la logique d'import/export, ni les opérations Google Drive.

## Retouches V5

Les champs Web Awesome utilisent une bordure intérieure sauge au focus, sans ombre/anneau externe. Les actions et liens conservent un indicateur de focus clavier. La courbe de marge annuelle est un SVG responsive à 12 points avec axe zéro, sans bibliothèque tierce. Les valeurs exactes figurent dans les infobulles SVG et la description accessible du graphique.

## Retouches v0.8.3 : conteneur centré

La classe `.app-shell` enveloppe l’en-tête, le contenu principal et le pied de page. Elle utilise `max-width: 1240px`, `width: 100%` et `margin-inline: auto`. Les paddings horizontaux restent fluides (`clamp(12px, 1.8vw, 22px)`). Le tableau de bord reprend trois colonnes sur les écrans d’au moins 1200 px, malgré l’ancien breakpoint à 1400 px défini dans `main.css`, pour préserver la densité recherchée. Les autres vues restent dans le même conteneur.
