/**
 * CareLink — BookingMap
 * Drop-in replacement — même interface que l'original.
 * Utilise react-native-maps SI disponible, sinon fallback SVG natif.
 * Aucune erreur au démarrage dans tous les cas.
 */

import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MapPin, Navigation } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { geo } from "@/lib/db/geo";
import * as _MapSectionNative from './map/MapSectionNative';
const MapSectionNative: any = (_MapSectionNative as any)?.default ?? _MapSectionNative;


// ── Chargement conditionnel de react-native-maps ──────────────────────────────
// Si le package n'est pas installé, on utilise le fallback SVG.
let MapView: any = null;
let Marker: any = null;
let Circle: any = null;
let PROVIDER_GOOGLE: any = null;

try {
  const maps = require("react-native-maps");
  MapView = maps.default;
  Marker = maps.Marker;
  Circle = maps.Circle;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
} catch {
  // react-native-maps pas encore installé → fallback
}

const HAS_MAPS = MapView !== null;

// ── Style carte Google Maps CareLink ─────────────────────────────────────────
const CARELINK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#EDE5CC" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#0D0870" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#F6F5F0" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#FFFFFF" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#FFFFFF" }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#F6F5F0" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#8ECFDF" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#D8EBD2" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#C5E0BC" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#EAE2CE" }] },
  { featureType: "poi", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];

// ── Pin CareLink ──────────────────────────────────────────────────────────────
function CarelinkPin({ color }: { color: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: color,
          borderWidth: 3,
          borderColor: "white",
          shadowColor: color,
          shadowOpacity: 0.45,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 6,
        }}
      />
      <View style={{ width: 2, height: 7, backgroundColor: color, marginTop: -1 }} />
    </View>
  );
}

// ── Fallback SVG (quand react-native-maps non dispo) ─────────────────────────
function FallbackMap({
  lat,
  lng,
  radiusKm,
  primaryColor,
  onPress,
}: {
  lat: number;
  lng: number;
  radiusKm: number;
  primaryColor: string;
  onPress: (lx: number, ly: number) => void;
}) {
  return (
    <Pressable
      style={[styles.mapSurface, { backgroundColor: "#EDE5CC" }]}
      onPress={(e) => onPress(e.nativeEvent.locationX, e.nativeEvent.locationY)}
    >
      {/* Routes horizontales */}
      <View style={[StyleSheet.absoluteFillObject, { overflow: "hidden" }]}>
        {[0.25, 0.5, 0.75].map((t) => (
          <View
            key={t}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${t * 100}%`,
              height: t === 0.5 ? 18 : 12,
              backgroundColor: "rgba(255,255,255,0.7)",
              borderRadius: 4,
            }}
          />
        ))}
        {[0.3, 0.65].map((t) => (
          <View
            key={t}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${t * 100}%`,
              width: t === 0.3 ? 16 : 11,
              backgroundColor: "rgba(255,255,255,0.65)",
              borderRadius: 4,
            }}
          />
        ))}
        {/* Blocs urbains */}
        {[
          { l: "6%", t: "8%", w: "20%", h: "16%" },
          { l: "42%", t: "6%", w: "18%", h: "20%" },
          { l: "72%", t: "10%", w: "20%", h: "15%" },
          { l: "6%", t: "58%", w: "20%", h: "18%" },
          { l: "42%", t: "60%", w: "18%", h: "16%" },
          { l: "72%", t: "56%", w: "20%", h: "20%" },
        ].map((b, i) => (
          <View
            key={i}
            style={{
              position: "absolute",
              left: b.l, top: b.t, width: b.w, height: b.h,
              backgroundColor: "rgba(195,215,180,0.7)",
              borderRadius: 5,
            }}
          />
        ))}
      </View>
      {/* Cercle rayon */}
      <View
        style={{
          width: Math.min(radiusKm * 16, 130),
          height: Math.min(radiusKm * 16, 130),
          borderRadius: 999,
          backgroundColor: `${primaryColor}12`,
          borderWidth: 1.5,
          borderColor: `${primaryColor}40`,
          borderStyle: "dashed",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: primaryColor,
            borderWidth: 2.5,
            borderColor: "white",
            shadowColor: primaryColor,
            shadowOpacity: 0.4,
            shadowRadius: 6,
            elevation: 5,
          }}
        />
      </View>
    </Pressable>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
type BookingMapProps = {
  initialLat?: number;
  initialLng?: number;
  radiusKm?: number;
  primaryColor?: string;
  onChange?: (lat: number, lng: number) => void;
};

const DEFAULT_LAT = 33.5731; // Fès
const DEFAULT_LNG = -5.5398;
const DEFAULT_DELTA = 0.04;

// ── Composant principal ───────────────────────────────────────────────────────
export function BookingMap({
  initialLat = DEFAULT_LAT,
  initialLng = DEFAULT_LNG,
  radiusKm = 5,
  primaryColor = Colors.primary,
  onChange,
}: BookingMapProps) {
  const mapRef = useRef<any>(null);
  const [markerCoord, setMarkerCoord] = useState({
    latitude: initialLat,
    longitude: initialLng,
  });
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const coord = { latitude: initialLat, longitude: initialLng };
    setMarkerCoord(coord);
    if (HAS_MAPS) {
      mapRef.current?.animateToRegion(
        { ...coord, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA },
        500
      );
    }
  }, [initialLat, initialLng]);

  const handleDragEnd = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMarkerCoord({ latitude, longitude });
    onChange?.(latitude, longitude);
  };

  const handleFallbackPress = (lx: number, ly: number) => {
    // Simulation d'un tap sur la carte fallback
    const nextLat = initialLat + (0.5 - ly / 220) * 0.08;
    const nextLng = initialLng + (lx / 320 - 0.5) * 0.08;
    setMarkerCoord({ latitude: nextLat, longitude: nextLng });
    onChange?.(nextLat, nextLng);
  };

  const useMyLocation = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const pos = await geo.getCurrentPosition();
      const coord = { latitude: pos.lat, longitude: pos.lng };
      setMarkerCoord(coord);
      onChange?.(pos.lat, pos.lng);
      if (HAS_MAPS) {
        mapRef.current?.animateToRegion(
          { ...coord, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA },
          700
        );
      }
    } catch {
      // Permission refusée — silencieux
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {/* Custom InDrive-style map (replaces Google fallback) */}
      <MapSectionNative
        lat={markerCoord.latitude}
        lng={markerCoord.longitude}
        radiusKm={radiusKm}
        primaryColor={primaryColor}
        onPress={(nextLat, nextLng) => {
          setMarkerCoord({ latitude: nextLat, longitude: nextLng });
          onChange?.(nextLat, nextLng);
        }}
      />

      {/* Bouton GPS */}
      <TouchableOpacity
        style={[styles.gpsBtn, { borderColor: `${primaryColor}33` }]}
        onPress={useMyLocation}
        disabled={locating}
        activeOpacity={0.8}
      >
        {locating ? (
          <ActivityIndicator size="small" color={primaryColor} />
        ) : (
          <Navigation size={13} color={primaryColor} />
        )}
        <Text style={[styles.gpsBtnText, { color: primaryColor }]}>
          {locating ? "Localisation…" : "Ma position"}
        </Text>
      </TouchableOpacity>

      {/* Footer coords */}
      <View style={styles.footer}>
        <MapPin size={11} color={primaryColor} />
        <Text style={styles.footerText} numberOfLines={1}>
          {markerCoord.latitude.toFixed(4)}, {markerCoord.longitude.toFixed(4)}
          {"  ·  "}rayon {radiusKm} km
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
    backgroundColor: "#EDE5CC",
  },
  mapSurface: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  gpsBtn: {
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
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  gpsBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
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
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  footerText: {
    color: Colors.textPrimary,
    fontSize: 11,
    flex: 1,
  },
});