/**
 * Bundled demo portrait photos. Local (require'd) images render instantly and
 * reliably inside map markers — unlike remote URLs, which load async and can
 * show blank. Used to make the demo's professionals look real.
 */
import type { ImageSourcePropType } from "react-native";

export const DEMO_PRO_AVATARS: Record<string, ImageSourcePropType> = {
  fz: require("../assets/avatars/fatima.jpg"),
  km: require("../assets/avatars/karim.jpg"),
  sr: require("../assets/avatars/samira.jpg"),
  yb: require("../assets/avatars/youssef.jpg"),
};

/** The nurse in the tracking demo (Amina Hassan). */
export const DEMO_DRIVER_AVATAR: ImageSourcePropType = require("../assets/avatars/amina.jpg");
