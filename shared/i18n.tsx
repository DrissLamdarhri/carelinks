/**
 * CareLink — React Native–safe i18n.
 *
 * Differences from src/lib/i18n.tsx (web):
 *   • localStorage → AsyncStorage
 *   • document.documentElement.dir → I18nManager.forceRTL
 *   • RTL change requires app restart (handled with expo-updates)
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { I18nManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

export type Locale = "fr" | "ar" | "dar";

const STORAGE_KEY = "carelink_locale";

const DICT: Record<Locale, Record<string, string>> = {
  fr: {
    welcome: "Bienvenue",
    booking: "Réservation",
    bookings_mine: "Mes réservations",
    new_request: "Nouvelle demande",
    accept: "Accepter",
    cancel: "Annuler",
    chat: "Messagerie",
    profile: "Profil",
    notifications: "Notifications",
    sign_out: "Se déconnecter",
    pay_now: "Payer maintenant",
    rate_pro: "Évaluer le pro",
    yoga: "Yoga",
    nurse: "Infirmier",
    psychologist: "Psychologue",
    physio: "Kinésithérapeute",
    home: "Accueil",
    earnings: "Revenus",
    documents: "Documents",
    submit_bid: "Proposer un prix",
    my_bids: "Mes offres",
    available: "Disponible",
    unavailable: "Indisponible",
    bid_accepted: "Offre acceptée",
    bid_rejected: "Offre refusée",
    loading: "Chargement…",
    error: "Erreur",
    retry: "Réessayer",
    budget: "Budget",
    address: "Adresse",
    notes: "Notes",
    schedule: "Planifier",
    urgency: "Urgence",
    normal: "Normal",
    urgent: "Urgent",
    emergency: "Urgence",
    confirm: "Confirmer",
    send: "Envoyer",
    message_placeholder: "Votre message…",
    no_bids_yet: "Aucune offre pour l'instant",
    waiting_for_bids: "En attente d'offres…",
  },
  ar: {
    welcome: "مرحبا",
    booking: "حجز",
    bookings_mine: "حجوزاتي",
    new_request: "طلب جديد",
    accept: "قبول",
    cancel: "إلغاء",
    chat: "المحادثة",
    profile: "الملف الشخصي",
    notifications: "الإشعارات",
    sign_out: "تسجيل الخروج",
    pay_now: "ادفع الآن",
    rate_pro: "قيِّم المهني",
    yoga: "يوغا",
    nurse: "ممرض",
    psychologist: "طبيب نفسي",
    physio: "مختص في العلاج الطبيعي",
    home: "الرئيسية",
    earnings: "الأرباح",
    documents: "الوثائق",
    submit_bid: "تقديم عرض",
    my_bids: "عروضي",
    available: "متاح",
    unavailable: "غير متاح",
    bid_accepted: "تم قبول العرض",
    bid_rejected: "تم رفض العرض",
    loading: "جار التحميل…",
    error: "خطأ",
    retry: "إعادة المحاولة",
    budget: "الميزانية",
    address: "العنوان",
    notes: "ملاحظات",
    schedule: "جدولة",
    urgency: "الأولوية",
    normal: "عادي",
    urgent: "عاجل",
    emergency: "طارئ",
    confirm: "تأكيد",
    send: "إرسال",
    message_placeholder: "رسالتك…",
    no_bids_yet: "لا توجد عروض بعد",
    waiting_for_bids: "في انتظار العروض…",
  },
  dar: {
    welcome: "Mer7ba",
    booking: "Reservation",
    bookings_mine: "Reservations dyali",
    new_request: "Talab jdid",
    accept: "Qbal",
    cancel: "Sale",
    chat: "Hadra",
    profile: "Profil dyali",
    notifications: "Tanbihat",
    sign_out: "Khrouj",
    pay_now: "Khelles daba",
    rate_pro: "Qaiyem l'pro",
    yoga: "Yoga",
    nurse: "Mmared",
    psychologist: "Psy",
    physio: "Kiné",
    home: "L'accueil",
    earnings: "Flous",
    documents: "Wara9",
    submit_bid: "3ared thaman",
    my_bids: "3ardati",
    available: "Mwjoud",
    unavailable: "Machi mwjoud",
    bid_accepted: "L3ard qboul",
    bid_rejected: "L3ard marfoud",
    loading: "Kan7mel…",
    error: "Ghalat",
    retry: "3awd",
    budget: "L'budget",
    address: "L'adresse",
    notes: "Notes",
    schedule: "Planning",
    urgency: "Darura",
    normal: "3adi",
    urgent: "Musta3jal",
    emergency: "Tari'",
    confirm: "A'kd",
    send: "Sifet",
    message_placeholder: "Message dyalek…",
    no_bids_yet: "Ma kayn 7ta 3ard",
    waiting_for_bids: "Kan t'senna l'3arod…",
  },
};

interface Ctx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (k: string) => string;
  dir: "ltr" | "rtl";
}

const I18nContext = createContext<Ctx>({
  locale: "fr",
  setLocale: () => {},
  t: (k: string) => k,
  dir: "ltr",
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fr");
  const [ready, setReady] = useState(false);

  // Load saved locale from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved: string | null) => {
      if (saved === "fr" || saved === "ar" || saved === "dar") {
        setLocaleState(saved);
        if (saved === "ar") {
          I18nManager.forceRTL(true);
        } else {
          I18nManager.forceRTL(false);
        }
      }
      setReady(true);
    });
  }, []);

  const setLocale = async (l: Locale) => {
    const wasRTL = locale === "ar";
    const willBeRTL = l === "ar";

    setLocaleState(l);
    await AsyncStorage.setItem(STORAGE_KEY, l);

    // Update RTL
    if (willBeRTL !== wasRTL) {
      I18nManager.forceRTL(willBeRTL);
      // App needs reload for RTL change to fully apply
      // Caller should trigger expo-updates reload if needed
    }

    // Persist to Supabase profile
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase
        .from("profiles")
        .update({ language: l })
        .eq("id", data.user.id);
    }
  };

  const dir = locale === "ar" ? "rtl" : "ltr";

  const value = useMemo<Ctx>(
    () => ({
      locale,
      setLocale,
      dir,
      t: (k: string) => DICT[locale][k] ?? DICT.fr[k] ?? k,
    }),
    [locale, dir]
  );

  if (!ready) return <>{children}</>;

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
