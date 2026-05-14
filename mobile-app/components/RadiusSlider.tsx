import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Slider from "@react-native-community/slider";
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

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.label}>Rayon de service</Text>
        <Text style={styles.value}>{radius} km</Text>
      </View>
      <Slider
        minimumValue={1}
        maximumValue={50}
        step={1}
        minimumTrackTintColor={Colors.primary}
        maximumTrackTintColor="#D7D7D7"
        thumbTintColor={Colors.primary}
        value={radius}
        onValueChange={setRadius}
        onSlidingComplete={handleRelease}
      />
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

