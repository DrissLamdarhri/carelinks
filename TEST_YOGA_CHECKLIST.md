# 🧪 Test Checklist - Yoga Sessions

## ✅ Vérifier Admin Panel

1. Ouvrez http://localhost:5173/admin
2. Yoga → Créer nouvelle séance
3. Testez:
   - [ ] **Titre** - Saisissez "Test Yoga 2024"
   - [ ] **Niveau** - Sélectionnez "Débutant"  
   - [ ] **Image** - Upload une image depuis PC
   - [ ] **Preview** - Vérifiez l'image s'affiche avant save
   - [ ] **Places max** - Entrez 8
   - [ ] **Prix** - Entrez 150 MAD
   - [ ] **Créer** - Cliquez le bouton

## ✅ Vérifier Patient View

4. Ouvrez **2ème navigateur** ou incognito
5. Allez à http://localhost:5173/patient
6. Yoga
7. Cherchez votre séance "Test Yoga 2024"
8. Vérifiez:
   - [ ] **Image** affichée ✅
   - [ ] **Niveau** affiche "Débutant" ✅
   - [ ] **Titre** correct ✅
   - [ ] **Prix** 150 MAD ✅

## ✅ Vérifier Real-time Sync

9. **Dans l'Admin** :
   - [ ] Modifiez le titre → "Test Yoga Modifié"
   - [ ] Sauvegardez

10. **Patient view** (navigateur 2):
    - [ ] Regardez sans rafraîchir
    - [ ] ⚡ Doit se mettre à jour automatiquement

## ✅ Vérifier Suppression

11. **Admin** :
    - [ ] Supprimez la séance "Test Yoga Modifié"

12. **Patient view** :
    - [ ] ⚡ Doit disparaître automatiquement

## 🎯 Résultats attendus

✅ Image affichée en patient view
✅ Niveau affiché correctement  
✅ Pas de données statiques
✅ Real-time sync fonctionne
✅ Suppression synchro instantanée

---

**Si tout passe :** 🎉 Problème RÉSOLU!
**Si erreur :** 📝 Notez et on va fixer
