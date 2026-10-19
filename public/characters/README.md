# Dossiers des personnages

Chaque personnage possède un dossier sous son rôle canonique. `character.json` rassemble la fiche complète; `dialogue.json` isole les champs utilisés pour démarrer et guider le roleplay; `prompts/cloudflare.json` et `prompts/horde.json` recensent les champs de profil fournis à chaque moteur. Les images réellement présentes et référencées par l’application sont dans `images/`.

Les prompts d’image finaux ne sont pas des textes statiques par personnage : `public/native-api.js` les compose à partir de ces champs, du fournisseur, de la scène, de la pose et de l’historique de génération. Les JSON de prompts documentent donc les sources d’entrée et les limites propres au fournisseur; ils ne prétendent pas être une capture d’une requête particulière.

Les catalogues `public/characters*.js` restent les index chargés par l’application. Leurs chemins d’images ont été migrés vers les dossiers ci-dessous, et la copie Android embarquée reprend les mêmes ressources.
