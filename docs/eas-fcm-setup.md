Configuration FCM (Firebase) + EAS build — Android

But: ces étapes permettent de construire un dev/prod client Android incluant les identifiants FCM (google-services.json) pour que Firebase soit initialisé et que les push FCM fonctionnent dans le client.

Prérequis
- Compte Firebase + projet (créé) et application Android (package name doit être ma.carelink.app).
- Accès au compte Expo / EAS (eas-cli, https://expo.dev).
- EAS CLI installé localement (npm i -g eas-cli) ou token EAS pour CI.

Résumé rapide
1) Créer l'application Android dans Firebase -> télécharger google-services.json.
2) Ne PAS committer google-services.json dans le repo. Stocker dans GitHub Secrets (base64) ou copier localement.
3) Construire un dev-client via EAS (profile `development` dans mobile-app/eas.json) — le build inclura google-services.json.

Détails — local (développement)
1. Dans Firebase console: Project settings → Add app → Android. Package name = `ma.carelink.app`.
2. télécharger `google-services.json`.
3. Placer le fichier en local (ne pas committer) à: `mobile-app/google-services.json`.
4. Installer eas-cli et se connecter:
   - npm i -g eas-cli
   - eas login
5. Lancer le build dev-client (profile `development`):
   - cd mobile-app
   - pnpm install
   - npx eas build --platform android --profile development
6. Installer l'APK généré sur l'appareil (depuis la page Expo/EAS ou via adb):
   - adb install <downloaded-apk>.apk

Détails — CI / GitHub Actions (recommandé)
- Stocker deux secrets GitHub:
  - EAS_TOKEN: token d'accès EAS (create via https://expo.dev/accounts/<your-account>/settings/tokens or `eas token:create`).
  - GOOGLE_SERVICES_JSON: contenu de mobile-app/google-services.json encodé en base64.

Comment encoder google-services.json en base64
- macOS / Linux:
  - base64 -w 0 mobile-app/google-services.json
- macOS (alternative):
  - base64 mobile-app/google-services.json
- Windows PowerShell:
  - [Convert]::ToBase64String([IO.File]::ReadAllBytes("mobile-app\\google-services.json"))

Exemple GitHub Actions
- Exemple de workflow prêt à l'emploi est placé dans `.github/workflows/eas-android-fcm-build.yml`.
- Il écrit le secret base64 en `mobile-app/google-services.json` puis lance `eas build --profile development`.

Notes importantes
- Les push NE FONCTIONNENT PAS sur Expo Go. Il faut installer le dev-client construit par EAS.
- N'ajoutez PAS google-services.json dans le repo public — stockez la version dans un secret CI et écrivez-le au moment du build.
- Si vous voulez envoyer des notifications depuis votre serveur via FCM (et pas via le service Expo), configurez la clef serveur Firebase côté backend.

Besoin d'aide
- Je peux: 1) ajouter le workflow GitHub Actions (créé ici) et un petit script pour écrire le secret, 2) générer les commandes PowerShell exactes pour encoder et ajouter un secret GitHub.
- Voulez-vous que je crée aussi le secret d'exemple dans le pipeline (workflow prêt à déclencher) ?
