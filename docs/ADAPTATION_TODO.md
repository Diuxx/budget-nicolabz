# Adaptation des principes Budget de Diuxx/todo à Marge

Référence étudiée : `Diuxx/todo`, branche `develop`, dossier `web-app/src/app/features/budget/` et modèle/service dans `web-app/src/app/shared/`.

## Convergences préexistantes dans ton 0.8.0

- Périodes indépendantes par mois (`YYYY-MM`) ; copie des prévisions du mois précédent.
- Comptes, catégories, types de revenus et dépenses fixes / variables / épargne.
- Prévu et réel enregistrés distinctement ; réel non renseigné = `null`.
- Liens entre revenus (transferts) et entre revenu et dépense (source de financement).
- Budgets locaux, import/export JSON, session et synchronisation via Nicolabz Identity.

## Apports de cette version 0.8.1

| Mécanisme Todo | Adaptation Marge |
| --- | --- |
| Filtre des dépenses par banque et par entrée d'argent | Sélecteur Web Awesome qui propose comptes puis leurs revenus ; filtres distincts (`account:` et `income:`) |
| Affichage du revenu disponible après déductions | Deux valeurs dans le tableau : disponible prévu et disponible réel ; avertissement visuel si négatif |
| Épargne annuelle par type de revenu | Bloc compact sous la page Budget avec prévu / réel par type `saving`, sans double cumul des dépenses d'épargne |
| Structure métier séparée des composants Angular | Fonctions métier pures dans `src/scripts/core/budget-insights.js`, sans Angular, puis rendu HTML-first |

## Invariants conservés

- Version du document JSON **4** : aucune migration des sauvegardes existantes requise.
- Aucune nouvelle dépendance front-end ; Web Awesome reste utilisé pour les contrôles.
- Les fonctions de synchronisation et les routes `/api/sync/budget` restent inchangées.
- Le code de ton ZIP `marge-v0.8.0.zip` est la base, pas le code de l'ancienne V9.

## Règles à connaître

Un revenu déduit d'un autre est un virement interne : il ne doit pas devenir une entrée externe supplémentaire dans les totaux. Le calcul de solde par revenu tient compte des revenus qui en sont issus et des dépenses qui lui sont rattachées.

Le graphique annuel par type d'épargne présente uniquement les revenus marqués `saving: true` ; les dépenses de type `savings` restent visibles dans le total budgétaire, mais ne sont pas additionnées une seconde fois dans ce graphique. Pour retrouver tous les versements d'épargne dans ce graphique, les enregistrer comme revenus d'épargne rattachés à une source de financement.

La notion de solde réel reste **une estimation à partir des écritures réellement renseignées**, pas une position bancaire récupérée depuis une API bancaire.
