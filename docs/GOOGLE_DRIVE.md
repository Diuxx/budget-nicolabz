# Connexion Google et synchronisation JSON — Marge V8

## Architecture : un seul fournisseur Google pour toutes les applications

```text
Navigateur Marge (Eleventy, HTML/CSS/JS)
  ├── localStorage (automatique)
  ├── JSON export/import (manuel)
  └── GET /api/session, GET|PUT /api/sync/budget
             │  credentials: include (cookie HttpOnly)
             ▼
      nodjs-google-auth (Node/Fastify, port 3000)
         ├── Authentification Google + OAuth Drive
         ├── SQLite (sessions / jetons chiffrés / index)
         └── Google Drive du compte → appDataFolder → JSON budget
```

La V6 appelait directement les API Google depuis le navigateur. **La V7 n'utilise plus ces modules** : `src/scripts/config/google.js`, `services/google-auth.js`, `services/drive-api.js` et `services/cloud-sync.js` ont été remplacés par `config/identity.js`, `services/identity-api.js` et `services/identity-sync.js`.

## A. Lancer l'API Nicolabz Identity

Dans https://github.com/Diuxx/nodjs-google-auth (branche `develop`) :

```bash
cp .env.example .env
npm install
npm run secret
npm run dev
```

Renseigner les variables **côté serveur** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY_BASE64`, et :

```dotenv
PUBLIC_BASE_URL=http://localhost:3000
CLIENT_APPS_JSON=[{"id":"budget","origins":["http://localhost:8080"]}]
```

Conserver les entrées `todo`, etc. si elles sont utilisées. Vérifier `GET http://localhost:3000/health` et `http://localhost:3000/demo` (test d'auth seulement). Les callbacks Google Cloud de l'API sont **`/auth/google/callback` et `/auth/drive/callback` sur l'origine de l'API**, jamais l'URL de Marge.

## B. Lancer Marge

```bash
npm install
npm run dev
```

Ouvrir `http://localhost:8080`, cliquer sur l'avatar (coin supérieur droit), puis **Connexion Google**. Une fois revenu sur Marge, **Autoriser Google Drive**, puis **Synchroniser**.

La première sauvegarde est créée explicitement. Sur un autre appareil, en l'absence d'une ancre locale, Marge te demande si tu souhaites conserver le budget local ou récupérer le budget Drive ; elle ne supprime rien automatiquement.

### Production recommandée

- Marge sur `https://budget.nicolabz.dev` (ou ton domaine exact).
- API sur `https://auth.nicolabz.dev`, servie derrière Nginx et Podman.
- Ajouter **l'origine exacte de Marge** à `CLIENT_APPS_JSON` de l'API, sous l'app ID `budget`. Ne réutilise pas une origine déjà attribuée à `todo` ou une autre application.
- S'assurer que les DNS, certificats TLS, redirect URIs Google Cloud et `PUBLIC_BASE_URL` correspondent.
- Adapter `src/scripts/config/identity.js` si l'adresse de l'API diffère.
- Ne pas utiliser HTTP en production : le cookie de session est `Secure`.

Le backend demeure l'autorité pour la session et les versions Drive. Les appels `PUT` contiennent la version lue et peuvent renvoyer `409 SYNC_CONFLICT` après une écriture concurrente.

## C. Diagnostic

| Erreur | Action |
|---|---|
| `INVALID_RETURN_URL` | Enregistrer l'origine exacte de Marge dans `CLIENT_APPS_JSON` ; vérifier HTTP/HTTPS et port. |
| `ORIGIN_FORBIDDEN` | Même vérification, plus l'identifiant `budget`. |
| `UNAUTHENTICATED` | Utiliser `localhost` des deux côtés en local ; vérifier les cookies et CORS avec credentials. |
| `DRIVE_NOT_CONNECTED` | Avatar → Autoriser Google Drive. |
| `DRIVE_RECONNECT_REQUIRED` | Refaire le consentement Drive. |
| `SYNC_CONFLICT` | Relancer la synchronisation : lire la nouvelle version, choisir, puis réessayer. |
| `NETWORK_ERROR` | Vérifier que l'API répond sur `IDENTITY_BASE_URL`. |

## D. Données et limites

Le format du JSON Marge reste `version:2` **à l'intérieur** du champ `data` envoyé à l'API. Ce numéro de format budgétaire est distinct du numéro de **révision distante** (`version` à la racine du PUT de l'API).

La sauvegarde précédente en `localStorage` reste lisible. L'ancien fichier privé Drive éventuellement créé par la V6 avec un Client ID Google distinct **ne sera pas automatiquement retrouvé** par l'API centralisée. Pour migrer, ouvrir la V6, exporter le JSON, puis l'importer dans la V7 avant sa première synchronisation.

L'API backend limite la taille du document à 1 Mio. Le fichier JSON de budget doit être sauvegardé manuellement en lieu sûr. Ne pas exposer tes données financières dans un dépôt Git public.

## E. Affichage du profil Google (V8)

Marge appelle automatiquement `GET /api/session` après chargement et au retour d'OAuth.
Le champ `user.id` est un **entier SQLite** dans Nicolabz Identity ; il est accepté et conservé.
Les attributs `image`, `initials` et `label` de `wa-avatar` sont modifiés sans supposer que le Web Component est déjà initialisé.

L'en-tête distingue les situations suivantes :

- **Vérification…** : appel à l'API en cours.
- **Mode local** : API accessible, session non authentifiée.
- **Google connecté** : session active, Drive non autorisé.
- **Drive connecté** : session active et Drive autorisé ; **cela ne prouve pas que le JSON est synchronisé**.
- **À synchroniser** : données locales modifiées depuis la dernière synchronisation par cette page.
- **Service indisponible** : impossible d'obtenir l'état du service (les données locales sont conservées).

Le bouton « Actualiser la connexion » du menu profil permet de relancer `GET /api/session`.
La session se rafraîchit aussi lors du retour dans l'onglet. Aucun polling périodique n'est nécessaire.

Exemple de vérification manuelle depuis Marge :

```js
fetch('http://localhost:3000/api/session', { credentials: 'include' })
  .then(response => response.json())
  .then(console.log);
```

Si tu utilises **http://localhost:8081**, renseigne précisément cette origine dans `CLIENT_APPS_JSON` côté API et redémarre l'API.
Cette correction n'effectue pas d'appel Google direct depuis le navigateur : toutes les sessions et les sauvegardes Drive passent par le service Node centralisé.
