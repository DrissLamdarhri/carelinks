import { Linking } from "react-native";

/**
 * Hand off to the phone's map app (Google Maps / default) for real turn-by-turn
 * navigation to a destination — the standard way a pro drives to the patient.
 * Prefers exact coordinates; falls back to the address string.
 * Returns false if there's nothing to navigate to.
 */
export function openNavigation(opts: {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
}): boolean {
  const { lat, lng, address } = opts;
  let dest: string | null = null;
  if (typeof lat === "number" && typeof lng === "number") dest = `${lat},${lng}`;
  else if (address && address.trim()) dest = encodeURIComponent(address.trim());
  if (!dest) return false;
  // Universal Google Maps directions URL — opens the Maps app if installed,
  // otherwise the browser, on both Android and iOS.
  const url = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
  void Linking.openURL(url);
  return true;
}
