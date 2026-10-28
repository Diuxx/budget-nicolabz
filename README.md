# Marge V9 — Correction de la session Google dans Chromium

Cette version corrige le message « Service indisponible » affiché à tort alors que `GET /api/session` renvoie une session Google valide. La cause était un appel de `window.fetch` avec le mauvais `this` dans `src/scripts/services/identity-api.js`.

**Changement ciblé :** `fetchFunction.bind(globalThis)` afin de conserver le contexte attendu par Chromium. La cause des erreurs réseau reste accessible dans la console via `IdentityApiError.cause`.

Aucune modification de Nicolabz Identity, des variables OAuth, du format des données, de la sauvegarde locale, des endpoints Drive ou des composants Web Awesome n'est nécessaire.

## Vérification locale

1. Démarre Nicolabz Identity sur `http://localhost:3000`.
2. Vérifie que son `.env` autorise bien l'origine utilisée par Marge, par exemple `http://localhost:8081`.
3. Dans Marge, exécute `npm install` puis `npm run dev -- --port=8081`.
4. Recharge la page en vidant le cache si nécessaire. Le statut doit passer à « Drive connecté » et la photo du compte doit s'afficher.
5. Ouvre le menu de profil pour vérifier le nom, l'email et l'action de synchronisation.

Les données restent dans `localStorage`; l'authentification n'effectue aucune synchronisation automatiquement. Utilise le bouton Cloud pour synchroniser après vérification.

---

# Marge. V8 — Budget Eleventy + Nicolabz Identity

Application statique de budget personnel, créée avec **Eleventy 3**, **HTML/CSS natifs**, **JavaScript ES Modules** et **Web Awesome**. Cette version remplace le flux OAuth Google exécuté directement par Marge par l'API centralisée [`Diuxx/nodjs-google-auth`](https://github.com/Diuxx/nodjs-google-auth) (branche `develop`, consultée le 28/10/2026).

## Démarrer Marge

Prérequis : Node.js 20+ et npm. Dans ce dossier :

```bash
npm install
npm run dev
```

Ouvrir **http://localhost:8080** (ou le port réel utilisé par Eleventy, par exemple **http://localhost:8081**). Le budget est utilisable sans connexion Google : les modifications sont enregistrées dans `localStorage`. Pour la connexion et la synchronisation, il faut en plus démarrer et configurer **nodjs-google-auth** sur `http://localhost:3000` (voir ci-dessous et `docs/GOOGLE_DRIVE.md`).

```bash
npm test        # Tests métier / intégration API simulée
npm run build   # Site statique dans dist/
```

Le script `lancer.bat` ou `lancer.sh` est également fourni (exécute Eleventy).

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
