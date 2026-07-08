/**
 * CareLink — React Native i18n. Locales: en · ar · fr · dar.
 * Arabic (ar) is RTL — flipping requires an app reload (I18nManager.forceRTL).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { I18nManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

export type Locale = "en" | "ar" | "fr" | "dar";
export const RTL_LOCALES: Locale[] = ["ar"];

const STORAGE_KEY = "carelink_locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
  fr: "Français",
  dar: "Darija",
};

const DICT: Record<Locale, Record<string, string>> = {
  en: {
    welcome: "Welcome", booking: "Booking", bookings_mine: "My bookings", new_request: "New request",
    accept: "Accept", cancel: "Cancel", chat: "Messages", profile: "Profile", notifications: "Notifications",
    sign_out: "Sign out", pay_now: "Pay now", rate_pro: "Rate the professional", yoga: "Yoga",
    nurse: "Nurse", psychologist: "Psychologist", physio: "Physiotherapist", home: "Home", earnings: "Earnings",
    documents: "Documents", submit_bid: "Make an offer", my_bids: "My offers", available: "Available",
    unavailable: "Unavailable", bid_accepted: "Offer accepted", bid_rejected: "Offer declined", loading: "Loading…",
    error: "Error", retry: "Retry", budget: "Budget", address: "Address", notes: "Notes", schedule: "Schedule",
    urgency: "Urgency", normal: "Normal", urgent: "Urgent", emergency: "Emergency", confirm: "Confirm", send: "Send",
    message_placeholder: "Your message…", no_bids_yet: "No offers yet", waiting_for_bids: "Waiting for offers…",
    // nav / common
    missions: "Missions", revenue: "Revenue", requests: "Requests", explore: "Explore", my_appointments: "My appointments",
    settings: "Settings", account: "Account", preferences: "Preferences", support: "Support", language: "Language",
    security_privacy: "Security & Privacy", personal_info: "Personal information", saved_addresses: "Saved addresses",
    payment_wallet: "Payment & Wallet", patient_policy: "Patient policy", help_faq: "Help & FAQ", online: "Online", offline: "Offline",
    login: "Log in", signup: "Sign up", email: "Email", password: "Password", forgot_password: "Forgot password?",
    continue_google: "Continue with Google", continue_apple: "Continue with Apple", or_with_email: "or with email",
    welcome_back: "Welcome back!", login_subtitle: "Log in to access your care", saved: "Saved",
    request_sent: "Request sent", offer_accepted: "Offer accepted", payment_confirmed: "Payment confirmed",
  },
  ar: {
    welcome: "مرحبا", booking: "حجز", bookings_mine: "حجوزاتي", new_request: "طلب جديد", accept: "قبول",
    cancel: "إلغاء", chat: "المحادثة", profile: "الملف الشخصي", notifications: "الإشعارات", sign_out: "تسجيل الخروج",
    pay_now: "ادفع الآن", rate_pro: "قيِّم المهني", yoga: "يوغا", nurse: "ممرض", psychologist: "طبيب نفسي",
    physio: "أخصائي علاج طبيعي", home: "الرئيسية", earnings: "الأرباح", documents: "الوثائق", submit_bid: "تقديم عرض",
    my_bids: "عروضي", available: "متاح", unavailable: "غير متاح", bid_accepted: "تم قبول العرض", bid_rejected: "تم رفض العرض",
    loading: "جار التحميل…", error: "خطأ", retry: "إعادة المحاولة", budget: "الميزانية", address: "العنوان", notes: "ملاحظات",
    schedule: "جدولة", urgency: "الأولوية", normal: "عادي", urgent: "عاجل", emergency: "طارئ", confirm: "تأكيد", send: "إرسال",
    message_placeholder: "رسالتك…", no_bids_yet: "لا توجد عروض بعد", waiting_for_bids: "في انتظار العروض…",
    missions: "المهام", revenue: "المداخيل", requests: "الطلبات", explore: "استكشاف", my_appointments: "مواعيدي",
    settings: "الإعدادات", account: "الحساب", preferences: "التفضيلات", support: "الدعم", language: "اللغة",
    security_privacy: "الأمان والخصوصية", personal_info: "المعلومات الشخصية", saved_addresses: "العناوين المحفوظة",
    payment_wallet: "الدفع والمحفظة", patient_policy: "سياسة المريض", help_faq: "المساعدة والأسئلة", online: "متصل", offline: "غير متصل",
    login: "تسجيل الدخول", signup: "إنشاء حساب", email: "البريد الإلكتروني", password: "كلمة المرور", forgot_password: "نسيت كلمة المرور؟",
    continue_google: "المتابعة مع جوجل", continue_apple: "المتابعة مع آبل", or_with_email: "أو بالبريد الإلكتروني",
    welcome_back: "مرحبا بعودتك!", login_subtitle: "سجّل الدخول للوصول إلى خدماتك", saved: "تم الحفظ",
    request_sent: "تم إرسال الطلب", offer_accepted: "تم قبول العرض", payment_confirmed: "تم تأكيد الدفع",
    skip: "تخطّي", continue_btn: "متابعة", i_am_patient: "أنا مريض", i_am_pro: "أنا مهني صحّي",
    onb_s1_title: "رعاية في المنزل", onb_s1_sub: "ممرضون ومختصون في العلاج الطبيعي ومهنيو الصحة يأتون إليك في دقائق.",
    onb_s2_title: "أنت تحدّد السعر", onb_s2_sub: "مثل InDrive، اقترح سعرك. يقبل المهنيون أو يقدّمون عرضًا مضادًا.",
    onb_s3_title: "موثّقون ومعتمدون", onb_s3_sub: "جميع مهنيينا موثّقون: الشهادة والبطاقة الوطنية وآراء المرضى مُراقَبة.",
    pro_login_lead: "سجّل الدخول إلى حسابك المهني",
    pro_email_hint: "يسجّل المهنيون الدخول بالبريد الإلكتروني لحسابهم الموثّق (بدون تسجيل عبر جوجل).",
    signin_btn: "تسجيل الدخول", full_name: "الاسم الكامل", phone: "الهاتف", city: "المدينة",
    first_visit_hint: "💡 أول زيارة؟ أنشئ حسابًا عبر تبويب التسجيل.",
    espace_pro: "فضاء المهنيين", pro_specialties: "ممرض · طبيب نفسي · علاج طبيعي · يوغا",
    email_pro: "البريد الإلكتروني المهني", only_approved_pros: "يمكن فقط للمهنيين المعتمدين تسجيل الدخول",
    not_registered: "لم تسجّل بعد؟", create_pro_account: "إنشاء حساب مهني",
    reset_sent: "تم إرسال بريد إعادة التعيين ✓", enter_email_first: "أدخل بريدك الإلكتروني أولاً",
    pro_not_found: "لم يتم العثور على حساب مهني. يرجى التسجيل أولاً.",
    pro_not_verified: "لم يتم التحقق من حسابك بعد. أكمل التسجيل.",
    first_name: "الاسم الشخصي", last_name: "الاسم العائلي", confirm_password: "تأكيد كلمة المرور", create_my_account: "إنشاء حسابي",
    hello: "مرحبا 👋", what_care: "ما الرعاية التي تبحث عنها؟", choose_service: "اختر خدمتك",
    request_care_now: "اطلب رعاية الآن", next_appointment: "الموعد القادم", confirmed: "مؤكد", see_all: "عرض الكل",
    view_map: "عرض الخريطة", directions: "المسار", nearby_requests: "الطلبات القريبة", configure: "إعداد",
    setup_specialty_hint: "اختر تخصصك وموقعك لتصلك الطلبات.",
    no_appointments: "لا توجد مواعيد حاليًا.", patient: "المريض", navigate_to_patient: "التوجّه إلى المريض",
    your_request: "طلبك", home_rehab: "إعادة التأهيل في المنزل", care_type: "نوع الرعاية", date: "التاريخ", time_lbl: "الوقت",
    publish_request: "نشر طلبي", my_appointments_full: "مواعيدي", book_appointment: "حجز موعد",
  },
  fr: {
    welcome: "Bienvenue", booking: "Réservation", bookings_mine: "Mes réservations", new_request: "Nouvelle demande",
    accept: "Accepter", cancel: "Annuler", chat: "Messagerie", profile: "Profil", notifications: "Notifications",
    sign_out: "Se déconnecter", pay_now: "Payer maintenant", rate_pro: "Évaluer le pro", yoga: "Yoga", nurse: "Infirmier",
    psychologist: "Psychologue", physio: "Kinésithérapeute", home: "Accueil", earnings: "Revenus", documents: "Documents",
    submit_bid: "Proposer un prix", my_bids: "Mes offres", available: "Disponible", unavailable: "Indisponible",
    bid_accepted: "Offre acceptée", bid_rejected: "Offre refusée", loading: "Chargement…", error: "Erreur", retry: "Réessayer",
    budget: "Budget", address: "Adresse", notes: "Notes", schedule: "Planifier", urgency: "Urgence", normal: "Normal",
    urgent: "Urgent", emergency: "Urgence", confirm: "Confirmer", send: "Envoyer", message_placeholder: "Votre message…",
    no_bids_yet: "Aucune offre pour l'instant", waiting_for_bids: "En attente d'offres…",
    missions: "Missions", revenue: "Revenus", requests: "Demandes", explore: "Explorer", my_appointments: "Mes RDV",
    settings: "Paramètres", account: "Compte", preferences: "Préférences", support: "Support", language: "Langue",
    security_privacy: "Sécurité & Confidentialité", personal_info: "Informations personnelles", saved_addresses: "Adresses enregistrées",
    payment_wallet: "Paiement & Portefeuille", patient_policy: "Politique patient", help_faq: "Aide & FAQ", online: "En ligne", offline: "Hors ligne",
    login: "Connexion", signup: "Inscription", email: "Email", password: "Mot de passe", forgot_password: "Mot de passe oublié ?",
    continue_google: "Continuer avec Google", continue_apple: "Continuer avec Apple", or_with_email: "ou avec email",
    welcome_back: "Bon retour !", login_subtitle: "Connectez-vous pour accéder à vos soins", saved: "Enregistré",
    request_sent: "Demande envoyée", offer_accepted: "Offre acceptée", payment_confirmed: "Paiement confirmé",
    // onboarding + auth
    skip: "Passer", continue_btn: "Continuer", i_am_patient: "Je suis patient", i_am_pro: "Je suis professionnel",
    onb_s1_title: "Soins à domicile", onb_s1_sub: "Infirmiers, kinés, et professionnels de santé viennent chez vous en quelques minutes.",
    onb_s2_title: "Vous fixez le prix", onb_s2_sub: "Comme InDrive, proposez votre tarif. Les professionnels acceptent ou font une contre-offre.",
    onb_s3_title: "Vérifiés & certifiés", onb_s3_sub: "Tous nos professionnels sont vérifiés : diplôme, CIN et avis patients contrôlés.",
    pro_login_lead: "Connectez-vous à votre compte professionnel",
    pro_email_hint: "Les professionnels se connectent avec l'email de leur compte vérifié (pas de connexion Google).",
    signin_btn: "Se connecter", full_name: "Nom complet", phone: "Téléphone", city: "Ville",
    first_visit_hint: "💡 Première visite ? Créez un compte via l'onglet Inscription.",
    espace_pro: "Espace Pro", pro_specialties: "Infirmier · Psychologue · Kiné · Yoga",
    email_pro: "Email professionnel", only_approved_pros: "Seuls les professionnels approuvés peuvent se connecter",
    not_registered: "Pas encore inscrit ?", create_pro_account: "Créer un compte professionnel",
    reset_sent: "Email de réinitialisation envoyé ✓", enter_email_first: "Entrez votre email d'abord",
    pro_not_found: "Compte professionnel non trouvé. Veuillez d'abord vous inscrire.",
    pro_not_verified: "Votre compte n'est pas encore vérifié. Complétez l'inscription.",
    first_name: "Prénom", last_name: "Nom", confirm_password: "Confirmer mot de passe", create_my_account: "Créer mon compte",
    hello: "Bonjour 👋", what_care: "Quel soin recherchez-vous ?", choose_service: "Choisissez votre service",
    request_care_now: "Demander un soin maintenant", next_appointment: "Prochain rendez-vous", confirmed: "Confirmé", see_all: "Voir tout",
    view_map: "Voir la carte", directions: "Itinéraire", nearby_requests: "Demandes proches", configure: "Configurer",
    setup_specialty_hint: "Choisissez votre spécialité et votre position pour recevoir les demandes.",
    no_appointments: "Aucun rendez-vous pour le moment.", patient: "Patient", navigate_to_patient: "Naviguer vers le patient",
    your_request: "Votre demande", home_rehab: "Rééducation à domicile", care_type: "Type de soin", date: "Date", time_lbl: "Heure",
    publish_request: "Publier ma demande", my_appointments_full: "Mes rendez-vous", book_appointment: "Prendre un rendez-vous",
  },
  dar: {
    welcome: "Mer7ba", booking: "Reservation", bookings_mine: "Reservations dyali", new_request: "Talab jdid", accept: "Qbal",
    cancel: "Sale", chat: "Hadra", profile: "Profil dyali", notifications: "Tanbihat", sign_out: "Khrouj", pay_now: "Khelles daba",
    rate_pro: "Qaiyem l'pro", yoga: "Yoga", nurse: "Mmared", psychologist: "Psy", physio: "Kiné", home: "L'accueil",
    earnings: "Flous", documents: "Wara9", submit_bid: "3ared thaman", my_bids: "3ardati", available: "Mwjoud",
    unavailable: "Machi mwjoud", bid_accepted: "L3ard qboul", bid_rejected: "L3ard marfoud", loading: "Kan7mel…", error: "Ghalat",
    retry: "3awd", budget: "L'budget", address: "L'adresse", notes: "Notes", schedule: "Planning", urgency: "Darura",
    normal: "3adi", urgent: "Musta3jal", emergency: "Tari'", confirm: "A'kd", send: "Sifet", message_placeholder: "Message dyalek…",
    no_bids_yet: "Ma kayn 7ta 3ard", waiting_for_bids: "Kan t'senna l'3arod…",
    missions: "Missions", revenue: "Flous", requests: "Talabat", explore: "Chouf", my_appointments: "Mow3idi",
    settings: "Reglages", account: "L'compte", preferences: "Preferences", support: "Support", language: "L'logha",
    security_privacy: "L'aman", personal_info: "Ma3loumat", saved_addresses: "L'3anawin", payment_wallet: "Khlass",
    patient_policy: "Siyasat l mrid", help_faq: "Musa3ada", online: "Online", offline: "Offline", login: "Dkhoul", signup: "Tsjil", email: "Email",
    password: "L'password", forgot_password: "Nsiti l'password?", continue_google: "Kmml m3a Google", continue_apple: "Kmml m3a Apple",
    or_with_email: "wla b l'email", welcome_back: "Mer7ba bik!", login_subtitle: "Dkhol bach t'wsel l'services dyalek", saved: "Tsjjel",
    request_sent: "Tsifet t'talab", offer_accepted: "L3ard tqbel", payment_confirmed: "Khlass t'akked",
  },
};

interface Ctx {
  locale: Locale;
  setLocale: (l: Locale) => void; // instant — no reload needed (RTL flips live)
  t: (k: string) => string;
  dir: "ltr" | "rtl";
  hasChosen: boolean; // whether the user has picked a language (for the launch picker)
  ready: boolean;
}

const I18nContext = createContext<Ctx>({
  locale: "fr",
  setLocale: () => {},
  t: (k: string) => k,
  dir: "ltr",
  hasChosen: false,
  ready: false,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fr");
  const [hasChosen, setHasChosen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Keep I18nManager LTR globally — RTL is applied per-subtree via the `direction`
    // style, so switching is INSTANT and never needs an app restart.
    try { I18nManager.allowRTL(false); I18nManager.forceRTL(false); } catch { /* noop */ }
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved && saved in DICT) {
        setLocaleState(saved as Locale);
        setHasChosen(true);
      }
      setReady(true);
    });
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    setHasChosen(true);
    void AsyncStorage.setItem(STORAGE_KEY, l);
    void (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data.user) await supabase.from("profiles").update({ language: l }).eq("id", data.user.id);
      } catch { /* ignore */ }
    })();
  }, []);

  const dir = RTL_LOCALES.includes(locale) ? "rtl" : "ltr";

  const value = useMemo<Ctx>(
    () => ({
      locale,
      setLocale,
      dir,
      hasChosen,
      ready,
      t: (k: string) => DICT[locale]?.[k] ?? DICT.en[k] ?? DICT.fr[k] ?? k,
    }),
    [locale, dir, setLocale, hasChosen, ready]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
