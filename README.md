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

### Versions des prochaines mises à jour

`android/version.properties` est la source du nom affiché (`versionName`),
commune aux builds locaux, aux push sur `main` et aux lancements manuels.
Pour une nouvelle livraison, augmenter ce nom dans le dépôt avant le build ;
le lancement manuel ne propose plus de nom indépendant.

En CI, `versionCode` reste le numéro du run GitHub Actions. Le fichier partagé
fixe son minimum à **667**, supérieur aux APK précédents (664 et 666).
Un run inférieur au minimum échoue avant compilation, au lieu de produire une
mise à jour rétrograde. Relancer le même run conserve son code ; démarrer un
nouveau run pour obtenir un nouveau code. Ne jamais diminuer le minimum ; le
relever après une livraison si nécessaire.

Un build local sans `-PversionCode` utilise ce minimum ; pour livrer après un
build CI plus récent, fournir un code supérieur au dernier code installé.
Le package et la clé de signature restent inchangés. Ces réglages ne modifient
pas les APK déjà livrés.

Contrôle des versions sans compiler d'APK :
`node --test tests/android-version.test.cjs`.

## Mémoire

Toutes les ~6 répliques : extraits de faits, résumés, proximité / confiance / tension.
