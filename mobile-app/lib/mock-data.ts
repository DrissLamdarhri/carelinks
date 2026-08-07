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

// `label`/`sub`/`tag` are i18n KEYS, resolved with t() at the render site —
// this module is evaluated before any React context exists.
export const primaryServices = [
  {
    key: "infirmier",
    label: "nurse",
    sub: "cmp_svc_nurse_sub",
    icon: "syringe",
    gradient: "nurse",
    image:
      "https://images.unsplash.com/photo-1706958581603-dffa91fec580?w=400&q=80",
    route: "/patient",
    tag: "cmp_tag_popular",
  },
  {
    key: "psy",
    label: "psychologist",
    sub: "cmp_svc_psy_sub",
    icon: "brain",
    gradient: "psy",
    image:
      "https://images.unsplash.com/photo-1714976694468-ff722f34d0b6?w=400&q=80",
    route: "/patient",
    tag: null,
  },
  {
    key: "yoga",
    label: "yoga",
    sub: "cmp_svc_yoga_sub",
    icon: "flower2",
    gradient: "yoga",
    image:
      "https://images.unsplash.com/photo-1767611120077-3697335ec748?w=400&q=80",
    route: "/patient",
    tag: null,
  },
  {
    key: "kine",
    label: "pro_kine_short",
    sub: "home_rehab",
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
    label: "urgency",
    icon: "zap",
    color: "#E24B4A",
    background: "#FDE8E8",
  },
  {
    id: "q2",
    label: "svc_dressing",
    icon: "syringe",
    color: "#0D0870",
    background: "#EDE5CC",
  },
  {
    id: "q3",
    label: "svc_injection",
    icon: "syringe",
    color: "#5BB8D4",
    background: "#D8F0F4",
  },
] as const;
