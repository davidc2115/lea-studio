# Léa Studio

Chatbot roleplay **SFW / NSFW 18+** dans l’esprit RosyTalk / SpicyChat.

- Personnage de départ : **Léa Moreau** (18 ans, meilleure amie timide, scène de l’orage)
- **Gemini** + **OpenAI**, **plusieurs clés** avec rotation auto (quota / erreur)
- Mémoire long terme : faits extraits, souvenirs épinglés, résumés, jauges relation
- UI découverte → fiche perso → chat → memory manager

## Lancer

```bash
cd lea-studio
cp .env.example .env
# remplis OPENAI_API_KEYS et/ou GEMINI_API_KEYS (virgules entre les clés)
npm install
npm start
```

Ouvre http://localhost:3000  
Tu peux aussi coller les clés dans **Clés & réglages** (stockées dans l’environnement du process).

## Pousser sur GitHub

Le connecteur actuel n’a pas le droit de créer une branche / un nouveau repo.  
Depuis ta machine :

```bash
# option A — nouveau repo propre
gh repo create lea-studio --public --source=. --remote=origin --push

# option B — même repo Naruto-chabot, nouvelle branche
git checkout --orphan lea-studio
git add .
git commit -m "Léa Studio — chatbot SFW/NSFW, multi-clés, mémoire LT"
git push -u origin lea-studio
```

## Mémoire

Toutes les ~6 répliques, le serveur extrait des faits JSON et met à jour :
- souvenirs (éditables / pinnables)
- résumés de relation
- proximité / confiance / tension

Le prompt de génération injecte le bloc mémoire + les 18 derniers messages + le mode SFW ou NSFW.
