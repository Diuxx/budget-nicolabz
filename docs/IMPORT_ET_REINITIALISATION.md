# Import, patron et réinitialisation — Marge 0.8.5

## Patron téléchargeable

Dans **Paramètres → Données et sauvegardes** :

- **Télécharger le modèle JSON** : exemple de budget vierge valide (`marge-modele-import-v4.json`).
- **Télécharger le schéma de validation** : JSON Schema Draft 2020-12 (`marge-budget-v4.schema.json`).

Les deux fichiers sont également disponibles dans `src/assets/schemas/` et, après le build, dans `dist/assets/schemas/`.

### Structure minimale

Le modèle contient `version: 4`, `periods: []`, `accounts` (compte principal), `incomeTypes` (défauts), `expenseCategories` (défauts), `projects: []` et `legacyTransactions: []`.

À l'import :

1. Vérification de l'extension `.json` et de la taille (5 Mio maximum).
2. Parsing JSON ; les sauvegardes historiques v1/v2/v3 sont migrées avant contrôle.
3. Vérification avec le même schéma v4 que celui que l'utilisateur télécharge : champs obligatoires, types, énumérations, montants positifs, format des périodes et bornes.
4. Validation métier additionnelle : dates calendaires réelles, identifiants uniques, références aux comptes/catégories/types, cohérence des liens de financement, absence de cycles.
5. Confirmation explicite **avant** de remplacer le budget local. Une copie du budget précédent est créée dans `marge:backup:before-import:v4` (sauf en cas d'erreur de chargement préalable).

Le schéma public accepte les champs d'archives facultatifs pour ne pas perdre de données lors d'une migration.

## Réinitialisation

Cliquer sur **Réinitialiser toutes mes données** en bas de la section « Données et sauvegardes ». Lire le récapitulatif et saisir exactement `EFFACER` pour confirmer.

**Par défaut : navigateur uniquement.** Marge supprime les périodes, les revenus et dépenses, les comptes personnalisés, les projets, les archives, la période sélectionnée et les anciens fichiers de récupération de ce navigateur. Elle recrée un budget v4 vierge avec le compte principal, les catégories et types de revenus par défaut. Aucune clé d'une autre application n'est supprimée : `localStorage.clear()` n'est jamais utilisé.

**Option « Réinitialiser aussi ma sauvegarde Google Drive » :** active uniquement si une session Google et Drive sont confirmés. Marge lit la version distante et envoie le budget vierge via l'API Nicolabz Identity. L'écriture versionnée empêche de remplacer silencieusement un document modifié entre-temps (HTTP 409). Si Drive refuse la requête, le budget local est conservé. Le fichier distant est **remplacé** par un JSON vierge ; l'API actuelle ne prend pas en charge la suppression physique du fichier.

Après une réinitialisation locale uniquement, une future synchronisation peut proposer de récupérer les anciennes données de Drive : ne choisir le téléchargement que si c'est réellement souhaité.

**Ne supprime pas** la connexion Google ni les jetons du serveur. Pour une suppression irréversible partout, il faut également effacer les exports conservés ailleurs ; l'opération ne peut pas retirer des fichiers en dehors de Marge.
