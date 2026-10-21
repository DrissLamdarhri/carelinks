# OCR dans le navigateur

Application React (Vite + TypeScript) qui extrait le texte d'une image avec
[tesseract.js](https://github.com/naptha/tesseract.js), entièrement côté client :
l'image n'est jamais envoyée à un serveur.

## Fonctionnalités

- Import d'image par bouton ou glisser-déposer (JPG, PNG, WEBP, 15 Mo max) avec aperçu.
- Capture par webcam (`react-webcam`, caméra arrière par défaut sur mobile).
- Langues : français, anglais, arabe et combinaisons (`fra+ara`, `fra+eng`, `fra+eng+ara`).
- Prétraitement sur canvas : niveaux de gris, contraste renforcé, agrandissement
  des petites images (et réduction des très grandes). L'image prétraitée est visible dans l'aperçu.
- Barre de progression alimentée par le `logger` du worker Tesseract.
- Texte extrait modifiable (`dir="auto"`, arabe de droite à gauche) avec score de confiance.
- Copier, télécharger en `.txt`, recommencer.
- Le worker est réutilisé tant que la langue ne change pas, et terminé au changement
  de langue, après une erreur et au démontage du composant.

## Installation et lancement

Ce dossier fait partie du monorepo pnpm CareLink. **Toujours installer depuis la racine du dépôt**
(un `npm install` ou `pnpm install` lancé seul dans ce dossier crée un second arbre de dépendances) :

```bash
# depuis la racine du dépôt (C:\carelinks)
pnpm install

# serveur de développement → http://localhost:5180
pnpm -C ocr-app dev

# vérification des types + build de production (dossier ocr-app/dist)
pnpm -C ocr-app build

# prévisualiser le build
pnpm -C ocr-app preview
```

## Notes

- **Première utilisation :** tesseract.js télécharge son moteur WASM et les données de langue
  (`*.traineddata`, ~2 à 15 Mo par langue) depuis un CDN, puis les met en cache dans le navigateur
  (IndexedDB). Une connexion est donc nécessaire la première fois pour chaque langue ; la
  reconnaissance elle-même se fait localement.
- **Webcam :** les navigateurs n'autorisent la caméra qu'en HTTPS ou sur `localhost`.
- **Qualité :** une photo nette, bien éclairée et prise de face donne les meilleurs résultats.
  Un score de confiance inférieur à ~55 % indique un texte probablement mal lu.

## Structure

```
src/
  App.tsx                    orchestration (image, langue, webcam, erreurs)
  hooks/useOcr.ts            cycle de vie du worker Tesseract, progression, résultat
  lib/preprocess.ts          prétraitement canvas
  components/
    UploadZone.tsx           bouton + glisser-déposer, validation du fichier
    WebcamCapture.tsx        capture webcam
    ImagePreview.tsx         aperçu (original / prétraité)
    LanguageSelect.tsx       choix de la langue
    ResultPanel.tsx          texte modifiable, confiance, copier / télécharger / recommencer
```
