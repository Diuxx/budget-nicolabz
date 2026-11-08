# Format des données Pécule v1

Le format courant utilise `version: 1` et des périodes mensuelles. La définition
unique est `src/scripts/core/budget-schema.js`. Les règles relationnelles
(comptes, financement, dates et identifiants) sont vérifiées dans `storage.js`.

`npm test` et `npm run build` régénèrent le schéma JSON public et le modèle
d'import dans `src/assets/schemas/`. Ne pas modifier ces fichiers générés.
Les exports, imports, sauvegardes locales et données envoyées à Drive utilisent
le même format v1. Le numéro de révision Drive reste indépendant du schéma.

Les anciennes sauvegardes sont converties à l'entrée vers v1. La présence de
`periods` distingue le nouveau format des sauvegardes historiques numérotées v1.
Les archives et champs supplémentaires existants sont conservés. Ces adaptateurs
de compatibilité ne constituent pas des formats d'écriture supplémentaires.

La clé active est `pecule:budget:v1`. Au premier chargement, une ancienne
sauvegarde est copiée et convertie sans supprimer sa clé d'origine. Une remise
à zéro explicite conserve uniquement le budget vierge et supprime les anciennes
copies de Pécule pour empêcher leur réapparition.

L'import de classeurs Excel n'est pas encore implémenté : l'import courant
accepte uniquement les fichiers JSON de moins de 5 Mo.
