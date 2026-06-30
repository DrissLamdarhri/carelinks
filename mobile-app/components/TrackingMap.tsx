/**
 * CareLink — TrackingMap
 * ──────────────────────────────────────────────────────────────────────────────
 * Full-screen map for the live tracking screen.
 * Shows the pro as a moving cyan dot and the patient as a navy pin.
 * Dashed route line between them. ETA distance displayed.
 * 100% free — no Google Maps, no Apple Maps SDK needed.
 *
 * Props:
 *   patientCoord – where the patient is waiting
 *   proCoord     – pro's live GPS position (updated via Supabase Realtime)
 *   etaMin       – ETA in minutes
 *   arrived      – whether the pro has arrived
 */

import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Navigation, Clock } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { CareLinkMap } from "./map/CareLinkMap";
import { haversineKm, LatLng } from "./map/CareLinkMapCanvas";


type TrackingMapProps = {
  patientCoord: LatLng;
  proCoord: LatLng | null;
  etaMin: number;
  arrived?: boolean;
  height?: number;
};

export function TrackingMap({
  patientCoord,
  proCoord,
  etaMin,
  arrived = false,
  height = 340,
}: TrackingMapProps) {
  // Auto-center: midpoint between pro and patient when both present
  const center = useMemo<LatLng>(() => {
    if (!proCoord) return patientCoord;
    return {
      lat: (patientCoord.lat + proCoord.lat) / 2,
      lng: (patientCoord.lng + proCoord.lng) / 2,
    };
  }, [patientCoord, proCoord]);

  // Auto-zoom: fit both pins (rough)
  const zoom = useMemo(() => {
    if (!proCoord) return 8000;
    const dist = haversineKm(patientCoord, proCoord);
    // Wider when far, tighter when close
    if (dist > 10) return 2200;
    if (dist > 5)  return 4000;
    if (dist > 2)  return 6500;
    return 9000;
  }, [patientCoord, proCoord]);

  const distKm = proCoord
    ? haversineKm(patientCoord, proCoord).toFixed(1)
    : null;

  return (
    <View style={[styles.container, { height }]}>
      <CareLinkMap
        center={center}
        markerCoord={patientCoord}
        proCoord={proCoord}
        zoom={zoom}
        mode="tracking"
        primaryColor={Colors.primary}
        height={height}
      />

      {/* ── Status pill ───────────────────────────────────────────────── */}
      <View style={styles.statusPill}>
        {arrived ? (
          <>
            <View style={[styles.statusDot, { backgroundColor: Colors.success }]} />
            <Text style={styles.statusText}>Professionnel arrivé</Text>
          </>
        ) : (
          <>
            <Clock size={13} color={Colors.primary} />
            <Text style={styles.statusText}>
              {etaMin} min
              {distKm ? ` · ${distKm} km` : ""}
            </Text>
          </>
        )}
      </View>

      {/* ── Legend ────────────────────────────────────────────────────── */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
          <Text style={styles.legendText}>Vous</Text>
        </View>
        {proCoord && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.accent }]} />
            <Text style={styles.legendText}>Professionnel</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
    borderRadius: 0, // full-bleed in tracking screen
    position: "relative",
  },
  statusPill: {
    position: "absolute",
    top: 16,
    alignSelf: "center",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  legend: {
    position: "absolute",
    bottom: 16,
    right: 16,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  legendText: {
    fontSize: 11,
    color: Colors.textPrimary,
    fontWeight: "500",
  },
});
