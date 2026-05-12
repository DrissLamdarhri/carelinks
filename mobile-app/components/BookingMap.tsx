import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MapPin, Navigation } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { geo } from "@/lib/db/geo";

type BookingMapProps = {
  initialLat?: number;
  initialLng?: number;
  radiusKm?: number;
  onChange?: (lat: number, lng: number) => void;
};

const DEFAULT_LAT = 33.5731;
const DEFAULT_LNG = -7.5898;

export function BookingMap({
  initialLat = DEFAULT_LAT,
  initialLng = DEFAULT_LNG,
  radiusKm = 5,
  onChange,
}: BookingMapProps) {
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [locating, setLocating] = useState(false);

  const useMyLocation = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const pos = await geo.getCurrentPosition();
      setLat(pos.lat);
      setLng(pos.lng);
      onChange?.(pos.lat, pos.lng);
    } finally {
      setLocating(false);
    }
  };

  const handlePressMap = (x: number, y: number, width: number, height: number) => {
    const nx = x / width;
    const ny = y / height;
    const nextLat = initialLat + (0.5 - ny) * 0.1;
    const nextLng = initialLng + (nx - 0.5) * 0.1;
    setLat(nextLat);
    setLng(nextLng);
    onChange?.(nextLat, nextLng);
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.mapSurface}
        onPress={(event) => {
          const { locationX, locationY } = event.nativeEvent;
          handlePressMap(locationX, locationY, 320, 220);
        }}
      >
        <View style={styles.gridLayer} />
        <View style={styles.wave1} />
        <View style={styles.wave2} />
        <View style={[styles.radiusCircle, { width: radiusKm * 14, height: radiusKm * 14 }]} />
        <View style={styles.pinPoint} />
      </Pressable>

      <TouchableOpacity style={styles.locationBtn} onPress={useMyLocation} disabled={locating}>
        {locating ? <ActivityIndicator size="small" color={Colors.primary} /> : <Navigation size={13} color={Colors.primary} />}
        <Text style={styles.locationBtnText}>{locating ? "..." : "Ma position"}</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <MapPin size={12} color={Colors.primary} />
        <Text style={styles.footerText}>
          {lat.toFixed(4)}, {lng.toFixed(4)} · rayon {radiusKm} km
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    height: 220,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: Colors.surfaceWarm,
  },
  mapSurface: { flex: 1, backgroundColor: Colors.surfaceWarm, alignItems: "center", justifyContent: "center" },
  gridLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
    backgroundColor: "transparent",
    borderWidth: 0.5,
    borderColor: "#8ECFDF",
  },
  wave1: {
    position: "absolute",
    left: -20,
    right: -20,
    bottom: 50,
    height: 50,
    borderRadius: 999,
    backgroundColor: "rgba(91,184,212,0.20)",
  },
  wave2: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 22,
    height: 36,
    borderRadius: 999,
    backgroundColor: "rgba(91,184,212,0.15)",
  },
  radiusCircle: {
    borderRadius: 999,
    backgroundColor: "rgba(13,8,112,0.12)",
    borderWidth: 1,
    borderColor: "rgba(13,8,112,0.35)",
    borderStyle: "dashed",
  },
  pinPoint: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: "white",
    position: "absolute",
  },
  locationBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    height: 34,
    borderRadius: 12,
    backgroundColor: "white",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  locationBtnText: { color: Colors.primary, fontSize: 12, fontWeight: "600" },
  footer: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  footerText: { color: Colors.textPrimary, fontSize: 11, flex: 1 },
});
