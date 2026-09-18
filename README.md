# Léa Studio

Chatbot roleplay **SFW / NSFW 18+** dans l’esprit RosyTalk / SpicyChat.

- Personnage de départ : **Léa Moreau** (18 ans, meilleure amie timide, scène de l’orage)
- **Gemini** + **OpenAI**, **plusieurs clés** avec rotation auto
- Mémoire long terme : faits, souvenirs épinglés, résumés, jauges
- App web + **APK Android**

## Web

```bash
cp .env.example .env
npm install
npm start
```

http://localhost:3000

## Application Android

WebView qui embarque l’UI. Les clés se saisissent dans **Clés & réglages** (mode natif, sans serveur).

Workflow GitHub : **Actions → Build APK Android → Run workflow**  
Artifact : `lea-studio-apk`

Repo : https://github.com/davidc2115/lea-studio

## Mémoire

Toutes les ~6 répliques : extraits de faits, résumés, proximité / confiance / tension.
