/**
 * Lightweight i18n — FR / AR (RTL) / Darija (Latin-script).
 * Locale persisted in localStorage and on profiles.locale (best-effort).
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

export type Locale = "fr" | "ar" | "dar";

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
  },
};

interface Ctx { locale: Locale; setLocale: (l: Locale) => void; t: (k: string) => string; dir: "ltr" | "rtl"; }
const I18nContext = createContext<Ctx>({ locale: "fr", setLocale: () => {}, t: (k) => k, dir: "ltr" });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => (localStorage.getItem("carelink_locale") as Locale) || "fr");

  const setLocale = async (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("carelink_locale", l);
    const { data } = await supabase.auth.getUser();
    if (data.user) await supabase.from("profiles").update({ locale: l }).eq("id", data.user.id);
  };

  const dir = locale === "ar" ? "rtl" : "ltr";

  useEffect(() => { document.documentElement.dir = dir; document.documentElement.lang = locale; }, [dir, locale]);

  const value = useMemo<Ctx>(() => ({
    locale, setLocale, dir,
    t: (k) => DICT[locale][k] ?? DICT.fr[k] ?? k,
  }), [locale, dir]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
