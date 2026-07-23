# 🎯 Quick Reference - Plans d'Appointment

## 🚀 Pour Démarrer

### 1. Appliquer la Migration
```bash
# Supabase Dashboard > SQL Editor > New query
# Coller: supabase/migrations/0025_appointment_plans.sql
# Run
```

### 2. Accéder à l'Interface
```
http://localhost:5178/admin → "Plans d'appointment"
```

### 3. Créer un Plan
```
1. Sélectionner prof (psychologue/kiné)
2. Cliquer "Nouveau plan"
3. Remplir le formulaire
4. Cliquer "Créer le plan"
```

---

## 📊 4 Types de Plans

| Type | Exemple | Cas d'usage |
|------|---------|-----------|
| **Séance unique** | Consultation initiale | Première visite |
| **Récurrent** | Suivi hebdo | Sessions répétées même créneau |
| **Abonnement** | Pack 4 séances/mois | Forfait prépayé |
| **Programme** | Kiné 8 séances | Rééducation/suivi intensif |

---

## 🔧 Configuration Rapide

```
Titre:          "Suivi psychologique mensuel"
Type:           Abonnement
Fréquence:      Mensuel
Séances:        4
Durée:          60 min
Prix/séance:    300 MAD
→ Total auto:   1.200 MAD
```

---

## 📁 Fichiers Clés

| Fichier | Rôle |
|---------|------|
| `PsychologistPlansManager.tsx` | Composant React |
| `0025_appointment_plans.sql` | Migration DB |
| `AdminPanel.tsx` | Intégration |
| `ADMIN_QUICK_GUIDE.md` | Guide admin |

---

## ✅ Checklist Avant Déploiement

- [ ] Migration appliquée en Supabase
- [ ] Build: `pnpm build` ✓
- [ ] Admin panel teste local
- [ ] Plans de test créés
- [ ] Code push: `git push origin main`
- [ ] Deploy sur production
- [ ] Vérification post-deploy

---

## 🆘 Troubleshooting Rapide

| Problème | Solution |
|----------|----------|
| "Table not found" | Appliquer migration |
| "Aucun pro" | Créer psychologue/kiné |
| "Component ne charge pas" | Rafraîchir page |
| "Erreur création" | Vérifier champs requis |

---

## 📞 Resources

- **Full Guide**: `docs/APPOINTMENT_PLANS.md`
- **Migration Help**: `docs/MIGRATION_APPOINTMENT_PLANS.md`
- **Admin Guide**: `docs/ADMIN_QUICK_GUIDE.md`
- **Architecture**: `docs/ARCHITECTURE_DIAGRAM.md`
- **Deployment**: `docs/DEPLOYMENT_CHECKLIST.md`

---

**Status**: ✅ Production Ready - Deploy Anytime!
