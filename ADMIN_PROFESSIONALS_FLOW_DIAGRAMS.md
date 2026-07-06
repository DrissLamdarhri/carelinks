# Admin Panel Professionals - Flow Diagrams

**Generated**: 2026-07-04

---

## 1. Component Load Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ AdminPanel Component                                             │
│ (Renders ProfessionalsManager when tab === "professionals")     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ ProfessionalsManager Component Mounts                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    ┌─────────┐    ┌──────────┐   ┌──────────────┐
    │ Initialize   │ Subscribe │   │ Load Initial │
    │ State (13)   │ to Real-  │   │ Data         │
    │ variables    │ time DB   │   │              │
    └─────────────┘ └──────────┘   └──────────────┘
                         │               │
                         └───────┬───────┘
                                 ▼
                    ┌────────────────────────┐
                    │ loadProfessionals()    │
                    │                        │
                    │ Step 1: Query          │
                    │ professionals table    │
                    │ (with filters)         │
                    └────────────┬───────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │ Step 2: Query          │
                    │ profiles table         │
                    └────────────┬───────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │ Step 3: Merge data     │
                    │ using Map (O(1))       │
                    └────────────┬───────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │ Update state:          │
                    │ setProfessionals()     │
                    │ setLoading(false)      │
                    └────────────────────────┘
```

---

## 2. List Rendering & Filtering

```
┌──────────────────────────────────────────────────────┐
│ Professional List Table (View)                       │
└────────────────────┬─────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
    ┌────────┐  ┌─────────┐  ┌──────────┐
    │Filter  │  │Search   │  │Specialty │
    │Status  │  │Name/    │  │Filter    │
    │        │  │Email    │  │          │
    └───┬────┘  └────┬────┘  └─────┬────┘
        │            │            │
        └────────────┼────────────┘
                     ▼
        ┌────────────────────────┐
        │ Client-side Filter     │
        │ (Array.filter())       │
        │                        │
        │ Result: filtered[]     │
        └─────────────┬──────────┘
                      │
        ┌─────────────┴──────────────┐
        ▼                            ▼
    ┌────────────┐        ┌──────────────────┐
    │ Show Table │        │ Show Empty State │
    │ with Rows  │        │ or Loading       │
    └────────────┘        └──────────────────┘
```

---

## 3. Approval Workflow

```
┌──────────────────────────────────────────────────────────────┐
│ Admin clicks Approve Button (Green Check ✓)                  │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │ handleApprovePro(pro)  │
        │                        │
        │ Save previous state    │
        │ for rollback           │
        └────────────┬───────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
    ┌─────────┐ ┌─────────┐ ┌──────────┐
    │Optimistic│ │Update  │ │Set Modal │
    │UI Update │ │selected│ │Pending   │
    │Status:  │ │pro to  │ │actionLoad│
    │approved │ │approved│ │(true)    │
    │(Green)  │ └─────────┘ └──────────┘
    └────┬────┘
         │
         ▼
    ┌──────────────────────────┐
    │ Try Database Update      │
    │                          │
    │ supabase               │
    │  .from("professionals") │
    │  .update({             │
    │    verification_status  │
    │    verified_at          │
    │  })                     │
    └──────────┬───────────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
    ┌────────┐   ┌─────────┐
    │Success │   │ Error   │
    │ ✓      │   │ ✗       │
    └───┬────┘   └────┬────┘
        │             │
        ▼             ▼
    ┌──────────┐  ┌──────────────┐
    │Show      │  │Rollback:     │
    │Success   │  │  - Revert    │
    │Toast     │  │    state     │
    │Success   │  │  - Show      │
    │Message   │  │    error     │
    └────┬─────┘  │    toast     │
         │        └──────────────┘
         ▼
    ┌────────────────────────┐
    │ Create In-App          │
    │ Notification           │
    │ kind: "approval"       │
    │ title: "Compte         │
    │ approuvé"              │
    └────────┬───────────────┘
             │
             ▼
    ┌────────────────────────┐
    │ Send Email via         │
    │ Edge Function          │
    │ (non-blocking)         │
    └────────┬───────────────┘
             │
             ▼
    ┌────────────────────────┐
    │ Refresh List (500ms)   │
    │                        │
    │ setTimeout(() =>       │
    │   loadProfessionals()  │
    │ , 500)                 │
    └────────┬───────────────┘
             │
             ▼
    ┌────────────────────────┐
    │ Close Details Modal    │
    │ setShowDetailsModal()  │
    │ setSelectedPro(null)   │
    └────────────────────────┘
```

---

## 4. Rejection Workflow

```
┌──────────────────────────────────────────────────────────────┐
│ Admin clicks Reject Button (Red X ✕)                         │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │ setShowRejectModal(true)   │
        │                            │
        │ Rejection Reason Modal     │
        │ Opens                      │
        └────────────┬───────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │ Admin enters rejection     │
        │ reason in textarea         │
        │                            │
        │ setRejectReason(value)     │
        └────────────┬───────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │ Admin clicks Confirm       │
        │                            │
        │ Validation Check:          │
        │ !rejectReason.trim()       │
        └────────────┬───────────────┘
                     │
             ┌───────┴────────┐
             ▼                ▼
         ┌────────┐        ┌──────────┐
         │Empty   │        │Has Text  │
         │ ✗      │        │ ✓        │
         │Show    │        │          │
         │Error   │        └────┬─────┘
         │Toast   │             │
         └────────┘             ▼
                    ┌────────────────────────┐
                    │ handleRejectPro()      │
                    │                        │
                    │ Save previous state    │
                    │ for rollback           │
                    └────────────┬───────────┘
                                 │
                 ┌───────────────┼───────────────┐
                 ▼               ▼               ▼
            ┌─────────┐     ┌──────────┐   ┌──────────┐
            │Optimistic│    │Update    │   │Set Modal │
            │UI Update │    │selected  │   │Pending   │
            │Status:  │    │pro to    │   │actionLoad│
            │rejected │    │rejected  │   │(true)    │
            │(Red)    │    │Reason:   │   │          │
            └────┬────┘    │value     │   └──────────┘
                 │         └──────────┘
                 │
                 ▼
            ┌──────────────────────────┐
            │ Try Database Update      │
            │                          │
            │ supabase               │
            │  .from("professionals") │
            │  .update({             │
            │    verification_status  │
            │    rejection_reason     │
            │  })                     │
            └──────────┬───────────────┘
                       │
                ┌──────┴──────┐
                ▼             ▼
            ┌────────┐   ┌─────────┐
            │Success │   │ Error   │
            │ ✓      │   │ ✗       │
            └───┬────┘   └────┬────┘
                │             │
                ▼             ▼
            ┌──────────┐  ┌──────────────┐
            │Show      │  │Rollback:     │
            │Success   │  │  - Revert    │
            │Toast     │  │    state     │
            │          │  │  - Show      │
            │          │  │    error     │
            └────┬─────┘  │    toast     │
                 │        └──────────────┘
                 ▼
            ┌────────────────────────┐
            │ Create In-App          │
            │ Notification           │
            │ kind: "rejection"      │
            │ title: "Compte rejeté" │
            │ body: reason           │
            └────────┬───────────────┘
                     │
                     ▼
            ┌────────────────────────┐
            │ Send Email via         │
            │ Edge Function with     │
            │ rejection reason       │
            │ (non-blocking)         │
            └────────┬───────────────┘
                     │
                     ▼
            ┌────────────────────────┐
            │ Refresh List (500ms)   │
            └────────┬───────────────┘
                     │
                     ▼
            ┌────────────────────────┐
            │ Close Both Modals      │
            │  - setShowRejectModal()│
            │  - setShowDetailsModal│
            │  - setRejectReason("")│
            └────────────────────────┘
```

---

## 5. Real-time Synchronization

```
┌─────────────────────────────────────────────────────────────┐
│ Admin A approves professional X                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
            ┌──────────────────┐
            │ Database Update  │
            │ professionals[X] │
            │ status = approved│
            └────────┬─────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
    ┌─────────┐ ┌─────────┐ ┌─────────┐
    │Admin A  │ │Supabase │ │Admin B  │
    │UI       │ │Real-    │ │UI       │
    │Updates  │ │time Sub │ │Updates  │
    │Immedi-  │ │         │ │Auto-    │
    │ately    │ │Triggers│ │magically│
    │         │ │event   │ │         │
    └─────────┘ └────┬────┘ └─────────┘
                     │
                     ▼
            ┌──────────────────────┐
            │ Subscription Handler │
            │ in Admin B           │
            │                      │
            │ loadProfessionals()  │
            │ Refresh entire list  │
            └──────────────────────┘

Alternative Path (Custom Event):
┌─────────────────────────────────────────┐
│ Admin A approval completes              │
└────────────────────┬────────────────────┘
                     │
                     ▼
    ┌─────────────────────────────────┐
    │ Dispatch Custom Event:          │
    │ pro-status-changed              │
    │ detail: {id, status}            │
    └────────────┬────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────┐
    │ Admin B Event Listener          │
    │ Hears event                     │
    │ Updates local state             │
    │ Refreshes list                  │
    └─────────────────────────────────┘
```

---

## 6. Professional Details Modal Structure

```
┌───────────────────────────────────────────────────────────────┐
│ Details Modal (max-width-2xl, scrollable)                     │
├───────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Header (sticky)                                            │ │
│ │ ┌──────┐  Jean Dupont        [X]                          │ │
│ │ │ Avatar│  Infirmier                                       │ │
│ │ └──────┘                                                   │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Status Section (sticky top)                               │ │
│ │ ┌────────────────────────────────────────────────────┐   │ │
│ │ │ Statut Actuel: [Approuvé]  │  Inscrit: 4 jul 2026 │   │ │
│ │ └────────────────────────────────────────────────────┘   │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Rejection Reason (if rejected)                             │ │
│ │ ┌────────────────────────────────────────────────────┐   │ │
│ │ │ Motif de Rejet                                     │   │ │
│ │ │ Documents incomplets, diplômes manquants          │   │ │
│ │ └────────────────────────────────────────────────────┘   │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Contact Information (2-column grid)                        │ │
│ │ ┌─────────────────┐  ┌─────────────────┐                 │ │
│ │ │ Email           │  │ Téléphone       │                 │ │
│ │ │ jean@email.com  │  │ +212 612345678  │                 │ │
│ │ └─────────────────┘  └─────────────────┘                 │ │
│ │ ┌─────────────────┐  ┌─────────────────┐                 │ │
│ │ │ Ville           │  │ Expérience      │                 │ │
│ │ │ Casablanca      │  │ 5 ans           │                 │ │
│ │ └─────────────────┘  └─────────────────┘                 │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Documents Section                                          │ │
│ │ ┌────────────────────────────────────────────────────┐   │ │
│ │ │ Diplôme            4 juillet 2026  [Ouvrir]      │   │ │
│ │ │ Assurance Pro      3 juillet 2026  [Ouvrir]      │   │ │
│ │ │ Référence médicale 2 juillet 2026  [Ouvrir]      │   │ │
│ │ └────────────────────────────────────────────────────┘   │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Rating & Verification (2-column)                          │ │
│ │ ┌──────────────────┐  ┌──────────────────┐               │ │
│ │ │ Évaluation       │  │ Statut Vérif     │               │ │
│ │ │ 4.5 ⭐          │  │ Approuvé         │               │ │
│ │ │ (45 avis)        │  │                  │               │ │
│ │ └──────────────────┘  └──────────────────┘               │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Biography                                                  │ │
│ │ ┌────────────────────────────────────────────────────┐   │ │
│ │ │ Diplômé de l'École de Médecine de Casablanca      │   │ │
│ │ │ avec 5 ans d'expérience clinique...                │   │ │
│ │ └────────────────────────────────────────────────────┘   │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Action Buttons (if pending)                               │ │
│ │ ┌──────────────────────┐  ┌────────────────────────┐     │ │
│ │ │ ✓ Approuver         │  │ ✕ Rejeter             │     │ │
│ │ └──────────────────────┘  └────────────────────────┘     │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 7. Rejection Reason Modal

```
┌─────────────────────────────────────────────────────────┐
│ Rejection Reason Modal (max-width-md, centered)          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Motif de Rejet                                         │
│                                                          │
│  Justifiez le rejet de la candidature de Jean Dupont   │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Ex: Documents incomplets, informations incorrectes│  │
│  │ ...                                                │  │
│  │                                                    │  │
│  │                                                    │  │
│  └───────────────────────────────────────────────────┘  │
│  (Textarea - 4 rows, autofocus)                        │
│                                                          │
│  ┌──────────────────────┐  ┌──────────────────────┐   │
│  │ Annuler              │  │ ✕ Confirmer         │   │
│  │ (Gray background)    │  │ (Red background)    │   │
│  │                      │  │ (Disabled if empty)  │   │
│  └──────────────────────┘  └──────────────────────┘   │
│                                                          │
│  [Loading state shows spinner and "En cours..."]       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 8. State Management

```
Component State Variables (13 total):

┌──────────────────────────────────────────────────┐
│ Data State                                        │
│                                                  │
│ professionals: Professional[]  ← Main data       │
│ selectedPro: Professional | null                │
│ proDocuments: any[]          ← Documents        │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ UI State                                          │
│                                                  │
│ showDetailsModal: boolean                        │
│ showRejectModal: boolean                         │
│ showFilterDropdown: boolean                      │
│ sidebarCollapsed: boolean                        │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ Loading State                                     │
│                                                  │
│ loading: boolean         ← Initial list load    │
│ docsLoading: boolean     ← Document fetch      │
│ actionLoading: boolean   ← Approve/reject      │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ Form State                                        │
│                                                  │
│ rejectReason: string     ← Rejection reason    │
│ searchQ: string          ← Search query        │
│ filter: Status | "all"   ← Status filter      │
│ specialtyFilter: string  ← Specialty filter   │
└──────────────────────────────────────────────────┘
```

---

## 9. Error Handling Flow

```
┌──────────────────────────────────────────┐
│ Operation Initiated                       │
│ (Approve/Reject/Load)                     │
└────────────┬─────────────────────────────┘
             │
             ▼
        ┌─────────────┐
        │ Try Block   │
        │ Execute     │
        │ operation   │
        └────┬────────┘
             │
        ┌────┴─────┐
        ▼          ▼
     ┌──────┐  ┌────────┐
     │Success│  │Error   │
     └───┬──┘  └───┬────┘
         │         │
         ▼         ▼
    ┌────────┐ ┌─────────────────┐
    │Continue│ │ Catch Block     │
    │to next │ │                 │
    │step    │ │ 1. Log error    │
    └────────┘ │ 2. Show toast   │
              │    "Erreur..."   │
              │ 3. Rollback UI   │
              │ 4. Return        │
              └─────────────────┘
```

---

## 10. Data Flow Diagram

```
User Input (Admin)
    │
    ├─→ Approve/Reject Button Click
    ├─→ Filter/Search Change
    ├─→ Modal Open/Close
    └─→ Document Open Click
         │
         ▼
    ┌──────────────────────┐
    │ Component Handler    │
    │ handleApprovePro()   │
    │ handleRejectPro()    │
    │ handleFilterChange() │
    │ etc.                 │
    └──────────┬───────────┘
               │
         ┌─────┴─────┐
         ▼           ▼
    ┌─────────┐  ┌──────────────┐
    │Supabase │  │Local State   │
    │Database │  │Update        │
    │Update   │  │(Optimistic)  │
    │         │  │              │
    │ Update  │  │ Immediate UI │
    │ Status  │  │ Feedback     │
    └────┬────┘  └──────────────┘
         │
         ▼
    ┌──────────────────┐
    │ Additional       │
    │ Effects          │
    │ - Send Email     │
    │ - Create Notif   │
    │ - Dispatch Event │
    └─────────┬────────┘
               │
               ▼
          ┌─────────────┐
          │ UI Updates  │
          │ - Badge     │
          │ - Toast     │
          │ - Modal     │
          └─────────────┘
```

---

## Summary

These diagrams illustrate:

1. ✅ **Component Lifecycle** - How the component initializes and loads data
2. ✅ **User Workflows** - Approval and rejection processes
3. ✅ **Real-time Sync** - Cross-admin synchronization
4. ✅ **UI Structure** - Modal layouts and components
5. ✅ **State Management** - All state variables and their purposes
6. ✅ **Error Handling** - Exception handling flow
7. ✅ **Data Flow** - Information flow through the application

All flows support error recovery, optimistic updates, and real-time synchronization.

