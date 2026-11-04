# Architecture de Pécule

Application web **100 % statique** (Eleventy + JavaScript natif), sans backend propre. Les données restent dans le `localStorage` du navigateur ; l'identité et la sauvegarde Google Drive passent par l'API externe « Nicolabz Identity ».

## Structure

```
.
├── index.html             # Page unique (Nunjucks), point d'entrée
├── _includes/             # Layout et composants Nunjucks (header, footer)
├── _data/site.json        # Données globales Eleventy
├── eleventy.config.js     # Copie src/styles, src/scripts, src/assets vers dist/
├── src/
│   ├── scripts/
│   │   ├── core/          # Logique métier pure et persistance
│   │   ├── services/      # API Identity, synchronisation
│   │   ├── ui/            # Rendu, formulaires, événements, contrôleurs
│   │   └── config/        # Configuration publique (URL API, identifiant d'application)
│   ├── styles/            # CSS
│   └── assets/            # Logo, schéma JSON, modèle d'import
├── scripts/               # Tests (node --test), non publiés
├── docs/                  # Documentation
├── deploy.sh              # Déploiement Nginx + HTTPS
└── dist/                  # Sortie de build (ignorée par git)
```

### Couches et dépendances
- `ui` → `services` → `core`, et `ui` → `core`. `core` ne dépend d'aucune autre couche.
- `core/` : modèle du budget, calculs, validation par schéma, migrations, plan de synchronisation (`decideSync`, fonction pure). Seul `storage.js` accède à `localStorage` (jamais de `localStorage.clear()`).
- `services/` : appels HTTP à l'API Identity et orchestration de la synchronisation. Ne dépend pas de `ui/`.
- `ui/` : `app.js` assemble les modules (`create…`). Les vues rendent, la logique métier reste dans `core/`. Toute donnée utilisateur injectée dans le HTML est échappée (`esc`).
- `config/identity.js` : valeurs publiques, aucun secret.
- Pas de dépendance circulaire.

### Données
- Schéma versionné : `src/assets/schemas/pecule-budget-v4.schema.json`.
- Les imports sont validés avant acceptation ; une évolution du format ajoute une migration dans `core/` et conserve l'ancienne sauvegarde.

## Déploiement
- `npm run build` produit `dist/` ; `deploy.sh` le publie dans `/var/www/pecule/releases/<horodatage>` et bascule le lien `current` (atomique, retour arrière possible).
- Sans option, `bash deploy.sh` met à jour la release actuelle ; `--release` en crée une nouvelle.
- Nginx sert les fichiers statiques de `/var/www/pecule/current` ; `--nginx` génère la configuration, `--ssl` demande le certificat avec certbot (`--domain=…`, `--email=…`).
- Une configuration Nginx déjà en HTTPS pour le domaine n'est pas réécrite (le bloc certbot est conservé) : les changements Nginx ultérieurs se font à la main.
- Fichiers non hachés : `Cache-Control: no-cache` pour que les navigateurs récupèrent la dernière version.
- Détails et prérequis : voir le README.

## Authentification
- Le login Google est entièrement géré par l'API Identity : `https://auth.nicolabz.dev/auth/google/start?app=pecule&return_to=<url du site>` (`http://localhost:3000` en local).
- L'identifiant d'application est `IDENTITY_APP_ID = 'pecule'` dans `src/scripts/config/identity.js`.
- Côté API, `CLIENT_APPS_JSON` doit déclarer `{"id":"pecule","origins":["https://<domaine>", "http://localhost:8081"]}`. Les origines doivent correspondre exactement à l'URL servie ; chaque origine n'appartient qu'à un seul identifiant. L'API doit être redémarrée après modification.
- Aucun Client ID/secret Google, jeton ou clé de chiffrement dans Pécule.
- Autorisation Drive : consentement séparé, puis synchronisation via `/api/sync/pecule`.
- Synchronisation : empreintes SHA-256 locale/distante comparées à une ancre locale ; en cas de conflit, rien n'est écrasé silencieusement.
- En local, utiliser `localhost` partout (pas `127.0.0.1`).
- Erreurs courantes : `ORIGIN_FORBIDDEN` / `INVALID_RETURN_URL` = origine absente de `CLIENT_APPS_JSON`.

## Changements d'architecture
- Préserver les frontières entre `core`, `services` et `ui`.
- Mettre à jour ce document quand la structure, le déploiement ou l'authentification changent.
