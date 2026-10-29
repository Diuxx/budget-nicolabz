# Marge v0.8.5 — Budget mensuel

Application de budget personnel en Eleventy, JavaScript et Web Awesome. Le fonctionnement reprend la partie Budget du projet `todo`, avec le thème sombre de Marge.

## Fonctionnement

- Chaque mois possède ses revenus et dépenses indépendants, avec montant et date prévus, montant et date réels.
- Les flèches parcourent le calendrier, y compris entre décembre et janvier. Consulter un mois absent ne crée aucune donnée.
- Le bouton « Préparer ce mois » propose de reprendre les prévisions du mois précédent. Les liens de financement sont conservés, les dates sont adaptées au nouveau mois et les montants réels restent à renseigner. Un mois existant n'est jamais écrasé.
- Les lignes sont rattachées à un compte. Une dépense peut être financée par un revenu ; un revenu peut provenir d'un autre revenu pour représenter un virement interne.
- La page Budget permet de filtrer les dépenses par **compte** ou par **revenu financeur**, comme dans Todo. Les montants disponibles prévus et réels sont affichés pour chaque revenu.
- Un récapitulatif annuel présente **prévu / réel** pour chaque type de revenu d’épargne. Il n’ajoute pas les dépenses d’épargne une seconde fois.
- Les synthèses distinguent revenus, dépenses, épargne et marge, en prévu et réel. Les virements internes ne sont pas comptés deux fois comme revenus.
- La vue Analyses récapitule les douze mois et leur marge disponible, sans objectif minimal ni ligne de seuil.
- Le Journal rassemble les opérations dont le réel est renseigné. Un montant réel nul est différent d'un montant non renseigné.
- Les projets restent de type Épargne ou Demande de financement. Le montant du prêt, sa durée et sa mensualité appartiennent au projet. Ils ne créent pas automatiquement des dépenses.
- Les paramètres permettent de gérer les catégories de dépenses, types de revenus et sauvegardes.

## Sauvegardes et migration

Le format v4 utilise des périodes `YYYY-MM`. Les anciennes sauvegardes v1/v2/v3 sont converties au chargement ou à l'import. Les mois sans montants sont ignorés, les prévisions sont reprises. Les anciens objectifs minimaux peuvent rester dans le JSON en tant que métadonnées historiques inactives ; ils ne sont plus utilisés ni affichés. Les anciens postes sont affectés à un compte « Budget importé · à affecter » pour permettre leur reclassement.

L'ancien journal est conservé en archive, sans être transformé automatiquement en montants réels afin d'éviter les doublons. Les anciens paramètres et soldes restent conservés dans l'export.

Avant la migration locale, une copie originale est enregistrée séparément et reste exportable dans Paramètres. La clé de stockage précédente est conservée. Une sauvegarde invalide affiche une récupération plutôt que d'être remplacée par des données d'exemple. Les exports v4 nécessitent cette nouvelle version de Marge.

## Démarrer et vérifier

Prérequis : Node.js 20+ et npm.

```bash
npm install
npm run dev
npm test
npm run build
```

Le site est disponible sur `http://localhost:8081` ; le build statique est produit dans `dist/`. `lancer.bat` et `lancer.sh` sont également fournis. Le budget fonctionne localement sans connexion Google. Les tests couvrent les calculs, copies de mois, migrations, validations, parcours d'interface et synchronisation simulée.

## Intégration avec Nicolabz Identity

1. Dans le dépôt de l'API, définir dans `.env` le `CLIENT_APPS_JSON` suivant (en conservant les autres applications déjà déclarées) :

   ```dotenv
   CLIENT_APPS_JSON=[{"id":"budget","origins":["http://localhost:8080","http://localhost:8081","https://budget.nicolabz.dev"]}]
   ```

   **Attention** : c'est un exemple si `budget.nicolabz.dev` est le domaine de Marge. Les origines doivent correspondre exactement à l'URL servie. Chaque origine ne peut être affectée qu'à un identifiant d'application.

2. Vérifier `PUBLIC_BASE_URL=http://localhost:3000` en local, les identifiants Google et les URI de callback sur Google Cloud. Sur le NAS, utiliser `https://auth.nicolabz.dev` avec HTTPS.
3. Modifier au besoin `src/scripts/config/identity.js` (URL publique de l'API et identifiant `budget`). **Aucun Google Client Secret dans Marge**.
4. Recharger Marge et cliquer sur l'avatar en haut à droite → « Connexion Google ». Le serveur gère le login et ramène le navigateur sur Marge.
5. Cliquer sur « Autoriser Google Drive » (consentement séparé, une fois), puis sur « Synchroniser » pour sauvegarder le budget.

Si le login renvoie `INVALID_RETURN_URL` ou `ORIGIN_FORBIDDEN`, c'est presque toujours l'origine de Marge qui manque ou ne correspond pas à `CLIENT_APPS_JSON`. En local, utiliser **localhost partout** (pas `127.0.0.1`). La démo intégrée à l'API `/demo` n'autorise **pas** les routes Drive : utiliser `app=budget`, pas `app=demo`.

## Fonctionnement

- **Avatar Web Awesome** : lit `GET /api/session` (`name`, `email`, `picture`, `driveConnected`), accepte l’identifiant numérique de SQLite et met à jour l’avatar avec les attributs (`image`, `initials`, `label`) sûrs même avant le chargement du composant.
- **Actualisation de la session** : au chargement, au retour OAuth, à la réactivation de l’onglet et à l’ouverture du menu profil. Le badge indique « Google connecté », « Drive connecté », « À synchroniser », « Mode local » ou « Service indisponible ».
- **Retour OAuth** : `?auth=connected` est nettoyé dans l’URL ; seul `GET /api/session` valide réellement la session. Le menu dispose aussi d’une action « Actualiser la connexion ».
- **SSO centralisé** : `/auth/google/start?app=budget&return_to=...`; seul le serveur échange les codes OAuth. Cookie de session HttpOnly géré par le serveur, appels API avec `credentials:'include'`.
- **Google Drive** : `/auth/drive/start`, puis `GET /api/sync/budget` et `PUT /api/sync/budget` avec `{version, data}`. L'API conserve le JSON dans l'`appDataFolder` du Drive de l'utilisateur. Marge n'appelle plus Google Drive directement.
- **Conflits** : première connexion sur un appareil non reconnu → choix explicite entre local et Drive. Synchronisation ultérieure directionnelle si une seule version a changé. Lors d'un 409, l'application **ne réécrit pas** le cloud : elle invite à recommencer.
- **Sauvegarde locale** : conservée pendant toutes les étapes. Import/export JSON toujours disponibles, même déconnecté.
- **Déconnexion** : ferme la session centrale, sans effacer le budget local ni les données Drive.

**Important :** des comptes Google différents n'ont pas d'ancre de synchronisation partagée. Le JSON en `localStorage` reste cependant propre au **navigateur**, pas à l'utilisateur Google. Éviter de partager ce navigateur entre plusieurs personnes si les données financières doivent rester privées : une authentification n'est pas un mécanisme de protection du `localStorage`.

## Architecture

```text
_data/                         Données au build
_includes/                     Layouts et composants Nunjucks
content/                       Contenus
src/styles/                    Styles natifs et Web Awesome
src/scripts/config/identity.js Paramètres publics API centrale
src/scripts/core/              Données, budget, validation, stockage
src/scripts/services/
  identity-api.js              Client HTTP Nicolabz Identity
  identity-sync.js             Versions, snapshots, conflit
src/scripts/ui/                Écrans, interactions, profil et graphiques
scripts/*.test.js              Tests Node.js natifs
index.html                     Page principale
 eleventy.config.js            Build vers dist/
```

Le budget reste une application **statique** : le backend `nodjs-google-auth` est déployé séparément (Node.js, SQLite, Podman). Un `npm run build` de Marge produit uniquement des fichiers statiques.

### Sécurité et limites

- Publier Marge et l'API en **HTTPS** sur des sous-domaines du même site pour faciliter le SSO par cookie SameSite=Lax.
- Ne jamais insérer de secrets OAuth dans Marge ou commiter les fichiers JSON contenant tes finances.
- Les données Google Drive sont stockées dans un dossier applicatif privé, **pas** dans `Mon Drive` visible.
- La synchronisation est **manuelle**, pas une réplication temps réel. Pas de fusion automatique de JSON.
- Le serveur plafonne les requêtes JSON à 1 Mio. Garder des sauvegardes exportées et sécurisées.
- Pour publier au grand public, vérifier consentement et restrictions OAuth Google, et mettre en place les protections applicatives de production du dépôt API.

Détails de mise en place : [`docs/GOOGLE_DRIVE.md`](docs/GOOGLE_DRIVE.md).

## Changements 0.8.1 (depuis ton 0.8.0)

- Filtre de dépense par compte et sous-compte de financement inspiré de `Diuxx/todo`.
- Solde disponible (prévu / réel) par revenu, avec indication des valeurs négatives.
- Épargne annuelle par type de revenu, avec barres prévues/réelles compactes.
- Ajout du module pur `src/scripts/core/budget-insights.js` et de tests métier spécifiques.
- Aucune migration du JSON v4 ; les projets, la connexion Google, Drive et l'import/export restent inchangés.

**Note de calcul :** un virement interne est un revenu lié à un autre, pas un revenu externe supplémentaire ; une dépense d'épargne ne doit pas être saisie une seconde fois pour le même virement si l'on veut éviter une représentation double. La somme « épargne annuelle par type » porte uniquement sur les types de revenus marqués comme épargne.

## Changement v0.8.5

Le réglage de marge minimale mensuelle, la colonne « Objectif minimal » de la vue annuelle et la ligne de seuil dans le graphique sont retirés. La marge disponible reste calculée comme avant. Une ancienne propriété `minMargin` présente dans une sauvegarde v4 reste acceptée sans être utilisée, ce qui évite une migration destructrice et permettra éventuellement une réintégration ultérieure. Les nouveaux mois n'ont plus cette propriété.


## v0.8.5 — Mise en page centrée et compacte

Toutes les vues utilisent désormais un conteneur commun de largeur maximale **1240 px**, centré par `margin-inline: auto`. Les marges latérales diminuent automatiquement sur tablette et mobile. Le tableau de bord conserve trois colonnes à partir de **1200 px de largeur d'écran**, deux entre **881 et 1199 px**, puis une seule sur mobile. Les CSS concernés se trouvent dans `src/styles/compact.css` ; aucune donnée budgétaire ou API n'est modifiée.


## Correction v0.8.5 — Vue annuelle

- Séparation verticale des quatre cartes de synthèse et de la carte du graphique avec `margin-bottom: var(--card-gap)`.
- Les cartes gardent une hauteur naturelle, même lorsque les montants se répartissent sur plusieurs lignes.
- Grille conservée : quatre colonnes sur grand écran, deux colonnes sous 1190 px et une colonne sur mobile.
- Aucune modification des calculs, du stockage local ni de la synchronisation Drive.


## Remise à zéro et format JSON (v0.8.5)

Dans **Paramètres → Données et sauvegardes**, deux téléchargements sont disponibles :

- `marge-modele-import-v4.json` : budget vierge, prêt à être importé, contenant les catégories et types de revenus initiaux ainsi qu’un compte principal.
- `marge-budget-v4.schema.json` : schéma JSON Schema Draft 2020-12 décrivant le format d’échange. Des exemplaires sont fournis dans `src/assets/schemas/`.

Les imports utilisent **ce schéma** avant les validations métier (identifiants uniques, dates calendaires, comptes et financements cohérents). Les sauvegardes des versions 1 à 3 sont toujours acceptées via le convertisseur historique, puis contrôlées selon la v4. Les erreurs affichent le chemin du champ concerné.

**Réinitialiser toutes mes données** exige la saisie du mot `EFFACER`. Par défaut, seule cette application dans le navigateur est remise à zéro ; les anciennes copies locales sont également supprimées pour empêcher une restauration automatique. La case optionnelle Drive réinitialise aussi le JSON distant **avec contrôle de version**. Sur un conflit 409 ou un échec d’écriture, rien n’est supprimé localement. Cela ne supprime pas physiquement le fichier Drive (il est remplacé par un budget vierge), ni ne révoque la connexion Google. Il est conseillé d’exporter les données avant toute suppression.
