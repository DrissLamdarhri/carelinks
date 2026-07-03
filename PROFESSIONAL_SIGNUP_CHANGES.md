# Modifications - Formulaire d'Inscription Professionnel

## 📋 Résumé des changements

Le formulaire d'inscription des professionnels a été amélioré pour ajouter:
1. **Sélection du type de profession** (Psychologue, Infirmier, Kinésithérapeute)
2. **Types de services conditionnels** - affichés uniquement pour Infirmier et Kinésithérapeute
3. **Services spécifiques par profession:**
   - **Infirmier**: Pansement, Injection, Perfusion, Bilan sanguin, Soins post-op, Sonde urinaire
   - **Kinésithérapeute**: Rééducation motrice, Traitement anti-douleur, Traitement de l'arthrose, Drainage lymphatique, Traumatologie

## 🔧 Fichiers modifiés

### 1. `mobile-app/app/auth/pro-registration.tsx`
- Ajout de constantes pour les professions et services:
  ```typescript
  const professions = ["Psychologue", "Infirmier", "Kinésithérapeute"];
  const infirmierServices = ["Pansement", "Injection", "Perfusion", ...];
  const kineServices = ["Rééducation motrice", "Traitement anti-douleur", ...];
  ```
- État pour gérer profession et services sélectionnés
- Fonction `getAvailableServices()` pour obtenir les services selon la profession
- Fonction `getProfessionSpecialty()` pour convertir le nom en code (nurse, physiotherapist, psychologist)
- Fonction `getDiplomaTitle()` pour personnaliser le titre du diplôme selon la profession
- Interface utilisateur conditionnelle pour l'affichage des services
- Mise à jour du résumé final avec les informations de profession et services

### 2. `mobile-app/lib/auth-context.tsx`
- Mise à jour de la signature de `signUpWithEmail()` pour accepter profession et services
- Ajout du stockage de profession et services dans Supabase lors de la création du compte professionnel
- Mappage: 
  - "Infirmier" → "nurse"
  - "Kinésithérapeute" → "physiotherapist"  
  - "Psychologue" → "psychologist"

### 3. `shared/auth-context.tsx`
- Synchronisation de la signature de `signUpWithEmail()` avec les mêmes paramètres optionnels

## ✅ Logique du formulaire

### Étape 0 - Informations personnelles
1. Saisie classique (nom, email, téléphone, ville, etc.)
2. **Nouveau**: Sélection de la profession (obligatoire)
3. **Nouveau**: Sélection des types de service (affichée seulement si profession = Infirmier ou Kinésithérapeute)
   - Psychologue: pas de services à sélectionner
   - Infirmier: choix parmi 6 services
   - Kinésithérapeute: choix parmi 5 services

### Étape 1 - Documents
- Le titre du diplôme s'adapte à la profession sélectionnée

### Étape 3 - Récapitulatif
- Affiche la profession et les services sélectionnés

## 🚀 Points clés

✅ **Validation stricte**: La profession ET les services doivent être sélectionnés avant de continuer  
✅ **Affichage conditionnel**: Les services n'apparaissent que pour Infirmier et Kinésithérapeute  
✅ **Services distincts**: Chaque profession a sa propre liste de services  
✅ **Intégration DB**: Les données sont sauvegardées dans la table `professionals` (colonne `specialty`)  
✅ **Type-safe**: Toutes les modifications passent la vérification TypeScript

## 🔌 Intégration avec Supabase

Les données sont envoyées à Supabase:
- `professionals.specialty` = valeur mappée (nurse, physiotherapist, psychologist)
- Services sélectionnés: envoyés via les options de signup (pour tracking/audit)
- Les services peuvent être utilisés pour populer la table `pro_services` ultérieurement si nécessaire

## 🧪 Tests manuels recommandés

1. Sélectionner "Psychologue" → Vérifier que le champ services ne s'affiche pas
2. Sélectionner "Infirmier" → Vérifier que 6 services apparaissent
3. Sélectionner "Kinésithérapeute" → Vérifier que 5 services différents apparaissent
4. Changer de profession → Les services sélectionnés doivent se réinitialiser
5. Compléter le formulaire → Vérifier que le résumé affiche profession et services corrects
