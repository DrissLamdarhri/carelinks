Design a premium mobile healthcare app called "CareLink" 
for iOS and Android (375×812px, iPhone 14 frame).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DESIGN SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Primary color: #0F6E56 (deep teal)
Secondary color: #1D9E75 (medium teal)
Accent: #D85A30 (coral orange)
Background: #F9FAFB
Card surface: #FFFFFF
Text primary: #1A1A1A
Text secondary: #888780
Success: #1D9E75 | Warning: #BA7517 | Error: #E24B4A

Typography:
- Display / Headings: "DM Serif Display" or "Fraunces"
- Body / UI: "DM Sans" or "Plus Jakarta Sans"
- Sizes: H1=28px bold, H2=22px semibold, Body=15px regular, 
  Caption=12px medium
  
Border radius: 16px cards, 12px buttons, 50% pills/avatars
Shadows: soft — 0px 4px 16px rgba(0,0,0,0.06)
Spacing grid: 8px base unit

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCREENS TO GENERATE (8 screens)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCREEN 1 — ONBOARDING / SPLASH
- Full screen with soft teal gradient background (#0F6E56 → #1D9E75)
- Large white "CareLink" wordmark centered
- Tagline below: "Soins à domicile, à portée de main"
- Abstract wave or organic shape at bottom in lighter teal
- Two CTA buttons: "Je suis patient" (filled white) 
  and "Je suis professionnel" (outlined white)
- Bottom: "Déjà inscrit ? Se connecter" in small white text

SCREEN 2 — PATIENT HOME DASHBOARD
- White background, status bar teal
- Top: greeting "Bonjour, Driss 👋" with avatar circle 
  + notification bell icon (top right)
- Search bar: "Chercher un soin..." with search icon, 
  rounded, light gray bg
- Section "Nos services" — horizontal scroll with 4 cards:
  Card 1: "Infirmier" — teal icon (syringe/bandage), 
    label below, teal bg tint
  Card 2: "Yoga" — coral icon (lotus), label below, 
    coral bg tint
  Card 3: "Psychologue" — blue icon (brain/chat), 
    label below, blue bg tint
  Card 4: "Urgence" — red icon (cross), label below, 
    red bg tint
- Section "Réservations récentes" — vertical list of 
  2 appointment cards, each showing: service type badge, 
  provider name, date/time, status pill 
  (Confirmé=green, En attente=amber)
- Bottom navigation bar: Home | Réserver | Mes RDV | Chat | Profil

SCREEN 3 — NURSE BOOKING (InDrive style)
- Header: "Réserver un infirmier" with back arrow
- Map view (top half, 45% height) showing user location 
  pin in teal + nearby nurse pins in coral
- Bottom sheet (55% height, white, top rounded corners 32px):
  - Title "Votre demande" bold
  - Field 1: dropdown "Type de soin" 
    (Pansement / Injection / Perfusion / Bilan sanguin...)
  - Field 2: "Adresse de soin" with location pin icon
  - Field 3: "Date & heure" with calendar icon — pill selector 
    showing 5 date chips in horizontal scroll
  - Field 4: "Votre prix proposé (MAD)" — large number input 
    centered with − and + buttons, teal color
  - Primary button full-width: "Publier ma demande" teal filled
  - Small text below: "Les infirmiers de votre zone verront 
    votre offre"

SCREEN 4 — NURSE OFFERS LIST (InDrive response screen)
- Header "3 offres reçues" with back arrow + filter icon
- Subtitle: "Pansement — 15 Avr. 14h00 — Fès Médina"
- List of 3 offer cards, each card:
  - Left: circular avatar with nurse photo placeholder 
    + verified badge (teal checkmark)
  - Center: name, rating stars (4.8 ⭐), distance "1.2 km"
  - Right: price in large teal text "120 MAD" 
    + "Accepter" teal button (small, rounded pill)
  - Bottom of card: small chips for specialties 
    (Pansement, Injections)
- Each card has a subtle left border in teal (4px)
- At bottom: "Faire une contre-offre" outlined button

SCREEN 5 — YOGA SESSION CATALOG
- Header "Séances de Yoga" with back arrow
- Filter chips row: Tous | Débutant | Intermédiaire | Avancé
  (first chip selected = teal fill)
- Vertical list of 3 session cards (full width):
  Each card:
  - Top: color gradient thumbnail (coral to amber) 
    with session type label in white pill
  - Body: session name bold, instructor name with 
    small avatar, duration badge "60 min", 
    price "80 MAD / séance"
  - Footer: date row with calendar icon, 
    spots left "4 places restantes" in amber,
    "Réserver" teal button right-aligned
- Cards have 16px radius and soft shadow

SCREEN 6 — PSYCHOLOGIST APPOINTMENT BOOKING
- Header "Prendre un RDV" with back arrow
- Doctor profile card at top: 
  large avatar (circular, 64px), name "Dr. Dalila Mansouri", 
  specialty "Psychologue Clinicienne", 
  rating 4.9 ⭐ (42 avis), 
  online status dot (green) "Disponible"
- Section "Choisir une date" — horizontal calendar scroll 
  showing 7 days as pill cards 
  (day abbreviated + date number, available=teal fill, 
  unavailable=gray, selected=teal with white text)
- Section "Créneaux disponibles" — grid 3 columns of 
  time slot chips: 09:00, 10:30, 14:00, 15:30, 16:00, 17:30
  (available=white border, taken=strikethrough gray, 
  selected=teal fill)
- Bottom: "Confirmer le rendez-vous" full-width teal button 
  (disabled state until date + slot selected)

SCREEN 7 — CHAT WITH PSYCHOLOGIST
- Header: doctor avatar + name "Dr. Mansouri" + 
  "En ligne" green dot + video call icon + back arrow
- Chat bubbles:
  - Doctor (left): white bubble, gray text, 
    "Bonjour, comment puis-je vous aider ?" 
    + timestamp
  - Patient (right): teal bubble, white text, 
    "Je voudrais confirmer mon RDV du 16 avril" 
    + timestamp
  - System message centered: "RDV 16 Avr. 10h30 — 
    En attente de confirmation" (amber pill centered)
  - Doctor (left): "Je confirme votre rendez-vous. 
    À bientôt !" + timestamp
- Bottom input bar: text field "Votre message..." 
  + attachment icon + send button (teal circle, white arrow)

SCREEN 8 — NURSE REGISTRATION (KYC Upload)
- Header "Créer mon profil" with step indicator "Étape 2/3"
- Progress bar: 66% filled teal
- Title "Vos documents officiels" bold 22px
- Subtitle "Les informations doivent correspondre 
  exactement entre votre CIN et votre diplôme" 
  in amber warning box with ⚠️ icon
- Two upload zones (dashed border teal, rounded 16px):
  Upload 1: diplôme icon + "Déposer votre diplôme 
    (recto/verso)" + "PDF ou image, max 5MB"
  Upload 2: ID card icon + "Carte d'Identité Nationale 
    (recto/verso)"
- Below: verification fields (read-only, auto-filled by OCR):
  - "Nom extrait" field
  - "Prénom extrait" field  
  - "N° CIN extrait" field
  - Green checkmark or red X next to each 
    (matching state)
- Bottom: "Soumettre pour vérification" teal button 
  (active only if all 3 fields match)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GLOBAL UI RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Use Auto Layout throughout (vertical + horizontal stacks)
- Consistent 16px horizontal screen padding
- All icons: 24×24px, stroke style (Lucide or Phosphor set)
- Teal bottom nav bar with white active icon + label
- Status bar: dark content on light screens, 
  light content on teal headers
- Micro-interactions: button press = scale 0.97 + 
  teal ripple, card tap = subtle shadow increase
- Empty states: centered illustration + message + CTA
- Loading states: teal skeleton shimmer on cards
- All form fields: 52px height, 16px radius, 
  1px border #E0E0E0, focus border #0F6E56
- Verified badge: teal circle with white checkmark 
  (16px, positioned bottom-right of avatar)