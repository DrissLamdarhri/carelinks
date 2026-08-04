/**
 * Static app CONTENT — not sample data.
 *
 * This file used to hold both: the city list / onboarding slides / service
 * catalogue that the product genuinely ships, and eight `mock*` objects of
 * invented people used as display fallbacks. The mocks are gone; what is left
 * is configuration that happens to live in TypeScript.
 */
export const MOROCCAN_CITIES = [
  "Fès",
  "Casablanca",
  "Rabat",
  "Marrakech",
  "Agadir",
  "Tanger",
  "Meknès",
  "Oujda",
  "Salé",
  "Kénitra",
];

export const onboardingSlides = [
  {
    id: "s1",
    icon: "stethoscope",
    title: "onb_s1_title",
    subtitle:
      "onb_s1_sub",
  },
  {
    id: "s2",
    icon: "map-pin",
    title: "onb_s2_title",
    subtitle:
      "onb_s2_sub",
  },
  {
    id: "s3",
    icon: "shield",
    title: "onb_s3_title",
    subtitle:
      "onb_s3_sub",
  },
] as const;

export const primaryServices = [
  {
    key: "infirmier",
    label: "Infirmier",
    sub: "À domicile · Dès 60 MAD",
    icon: "syringe",
    gradient: "nurse",
    image:
      "https://images.unsplash.com/photo-1706958581603-dffa91fec580?w=400&q=80",
    route: "/patient",
    tag: "Populaire",
  },
  {
    key: "psy",
    label: "Psychologue",
    sub: "En ligne ou à domicile",
    icon: "brain",
    gradient: "psy",
    image:
      "https://images.unsplash.com/photo-1714976694468-ff722f34d0b6?w=400&q=80",
    route: "/patient",
    tag: null,
  },
  {
    key: "yoga",
    label: "Yoga",
    sub: "Séances individuelles",
    icon: "flower2",
    gradient: "yoga",
    image:
      "https://images.unsplash.com/photo-1767611120077-3697335ec748?w=400&q=80",
    route: "/patient",
    tag: null,
  },
  {
    key: "kine",
    label: "Kiné",
    sub: "Rééducation à domicile",
    icon: "activity",
    gradient: "kine",
    image:
      "https://images.unsplash.com/photo-1545463913-5083aa7359a6?w=400&q=80",
    route: "/patient",
    tag: null,
  },
] as const;

export const quickServices = [
  {
    id: "q1",
    label: "Urgence",
    icon: "zap",
    color: "#E24B4A",
    background: "#FDE8E8",
  },
  {
    id: "q2",
    label: "Pansement",
    icon: "syringe",
    color: "#0D0870",
    background: "#EDE5CC",
  },
  {
    id: "q3",
    label: "Injection",
    icon: "syringe",
    color: "#5BB8D4",
    background: "#D8F0F4",
  },
] as const;
