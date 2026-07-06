import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
// Use dynamic require for Slider to avoid crashes in environments where
// the native @react-native-community/slider module isn't linked (Expo Go).
// If unavailable, render a simple fallback with +/- buttons.
import { Colors } from "@/lib/colors";
import { supabase } from "@/lib/supabase";

type RadiusSliderProps = {
  professionalId: string;
  initialRadiusKm: number;
  onUpdated?: (radiusKm: number) => void;
};

export function RadiusSlider({
  professionalId,
  initialRadiusKm,
  onUpdated,
}: RadiusSliderProps) {
  const [radius, setRadius] = useState(initialRadiusKm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRadius(initialRadiusKm);
  }, [initialRadiusKm]);

  const handleRelease = async (value: number) => {
    const rounded = Math.round(value);
    setRadius(rounded);
    setSaving(true);
    try {
      const { error } = await supabase
        .from("professionals")
        .update({
          service_radius_km: rounded,
          updated_at: new Date().toISOString(),
        })
        .eq("id", professionalId);

      if (error) throw error;
      onUpdated?.(rounded);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossible de mettre à jour le rayon de service.";
      Alert.alert("Erreur", message);
    } finally {
      setSaving(false);
    }
  };

  // Dynamic load of slider component only for non-Expo Go environments.
  // Expo Go does not ship native community modules; attempting to render them
  // can trigger Invalid Hook Call or missing native module errors. Use a simple
  // fallback there.
  const [SliderComp, setSliderComp] = useState<any>(null);
  useEffect(() => {
    let mounted = true;
    // Lazy-detect Expo Go vs standalone/dev-client
    let isExpoGo = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Constants = require("expo-constants");
      isExpoGo = Constants?.appOwnership === "expo";
    } catch (e) {
      isExpoGo = false;
    }

    if (isExpoGo) {
      // Do not attempt to require native slider in Expo Go
      return () => {
        mounted = false;
      };
    }

    try {
      // require at runtime to avoid bundler evaluation issues
      // prefer the default export
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require("@react-native-community/slider");
      const comp = mod && (mod.default || mod);
      if (mounted) setSliderComp(comp);
    } catch (e) {
      // module not available; keep SliderComp null to use fallback
      if (mounted) setSliderComp(null);
    }
    return () => {
      mounted = false;
    };
  }, []);

  const increment = () => {
    const next = Math.min(50, Math.round(radius + 1));
    setRadius(next);
    handleRelease(next);
  };
  const decrement = () => {
    const next = Math.max(1, Math.round(radius - 1));
    setRadius(next);
    handleRelease(next);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.label}>Rayon de service</Text>
        <Text style={styles.value}>{radius} km</Text>
      </View>

      {SliderComp ? (
        <SliderComp
          minimumValue={1}
          maximumValue={50}
          step={1}
          minimumTrackTintColor={Colors.primary}
          maximumTrackTintColor="#D7D7D7"
          thumbTintColor={Colors.primary}
          value={radius}
          onValueChange={(v: number) => setRadius(Math.round(v))}
          onSlidingComplete={handleRelease}
        />
      ) : (
        // Fallback UI: simple decrement/increment buttons when native slider unavailable
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <TouchableOpacity onPress={decrement} style={{ padding: 8 }}>
            <Text style={{ fontSize: 18, color: Colors.primary }}>−</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 16, color: Colors.textPrimary }}>{radius} km</Text>
          <TouchableOpacity onPress={increment} style={{ padding: 8 }}>
            <Text style={{ fontSize: 18, color: Colors.primary }}>+</Text>
          </TouchableOpacity>
        </View>
      )}

      {saving ? (
        <View style={styles.savingRow}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.savingText}>Enregistrement...</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#EFEFEF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  value: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  savingRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  savingText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
});

