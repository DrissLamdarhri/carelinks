export const Colors = {
  // Brand
  primary: "#0D0870",
  primaryLight: "#1A1585",
  primaryDark: "#090551",
  accent: "#5BB8D4",
  accentSoft: "#8ECFDF",
  // surfaceWarm: "#EDE5CC",
  surfaceWarm:"#F6F5F0",
  // Surfaces
  background: "#F6F5F0",
  card: "#FFFFFF",
  input: "#F3F3F5",
  border: "#E7E6E0",

  // Text
  textPrimary: "#1A1A1A",
  textMuted: "#888780",
  textSubtle: "#B0B0B0",

  // Status
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#E24B4A",

  white: "#FFFFFF",
  black: "#000000",
};

export const Gradients = {
  onboarding: ["#0D0870", "#0D0870", "#25B882"] as const,
  patientHeader: ["#0D0870", "#1A1585", "#0D0870"] as const,
  cta: ["#5BB8D4", "#4AACCA"] as const,
  nurse: ["#0D0870", "#1A1585"] as const,
  psy: ["#5B21B6", "#7C3AED"] as const,
  yoga: ["#0891B2", "#06B6D4"] as const,
  kine: ["#065F46", "#059669"] as const,
};

// Kiné-specific color set used by patient kiné screens
export const KineColors = {
  primary: '#065F46',
  surfaceStrong: '#ECFDF5',
  inputBorder: '#D1FAE5',
  badgeBg: '#D1FAE5',
};

// ── Layered shadow system (navy-tinted, brand-consistent) ────────────────────
// Use instead of flat `elevation: 2`. shadow* props are iOS; elevation is Android.
export const Shadows = {
  sm: { shadowColor: "#0D0870", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  md: { shadowColor: "#0D0870", shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  lg: { shadowColor: "#0D0870", shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  xl: { shadowColor: "#0D0870", shadowOpacity: 0.22, shadowRadius: 40, shadowOffset: { width: 0, height: 18 }, elevation: 18 },
} as const;

// ── Typography scale (DM Serif Display for display/headings, DM Sans for UI) ──
export const Typography = {
  display: { fontFamily: "DMSerifDisplay_400Regular", fontSize: 32, lineHeight: 40 },
  h1: { fontFamily: "DMSerifDisplay_400Regular", fontSize: 24, lineHeight: 30 },
  h2: { fontFamily: "DMSans_500Medium", fontSize: 18, lineHeight: 24 },
  body: { fontFamily: "DMSans_400Regular", fontSize: 14, lineHeight: 20 },
  label: { fontFamily: "DMSans_500Medium", fontSize: 12, lineHeight: 16 },
  caption: { fontFamily: "DMSans_400Regular", fontSize: 10, lineHeight: 14 },
} as const;

// Default avatar for users without profile images
export const DEFAULT_AVATAR = require("@/assets/DefaultProfile.png");
