# Personnages — dossiers par rôle

Arborescence :

```
characters/
  {role}/                    # belle-mere, belle-fille, babysitter, collegue, ...
    {id}/                    # identifiant du personnage
      character.json         # fiche complète
      dialogue.json          # greeting, scenario, personality
      descriptif.md          # descriptif physique (format emoji)
      prompts/
        cloudflare.json      # champs fournis au moteur Cloudflare
        horde.json           # champs fournis au moteur AI Horde
      images/                # photos de référence du personnage
```

Les catalogues `public/characters*.js` restent chargés par l’application.
Les prompts d’image finaux sont composés dynamiquement par `public/native-api.js`.
