import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import * as Location from "expo-location";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type LiveTrackingPayload = {
  lat: number;
  lng: number;
  at: string;
};

type LiveTrackingChannelProps = {
  bookingId: string;
  mode: "broadcast" | "watch";
  onPosition: (position: LiveTrackingPayload) => void;
};

export function LiveTrackingChannel({
  bookingId,
  mode,
  onPosition,
}: LiveTrackingChannelProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    let active = true;

    const setup = async () => {
      const channel = supabase.channel(`tracking:${bookingId}`);
      channelRef.current = channel;

      channel.on("broadcast", { event: "position" }, ({ payload }) => {
        const typed = payload as LiveTrackingPayload;
        if (!typed?.lat || !typed?.lng) return;
        onPosition(typed);
      });

      await channel.subscribe();

      if (mode === "watch") return;

      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Localisation", "Autorisez la localisation pour diffuser votre position.");
        return;
      }

      const sendLocation = async () => {
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          const payload: LiveTrackingPayload = {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            at: new Date().toISOString(),
          };

          onPosition(payload);
          await channel.send({
            type: "broadcast",
            event: "position",
            payload,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Impossible de récupérer la position GPS.";
          Alert.alert("Erreur GPS", message);
        }
      };

      await sendLocation();
      if (!active) return;
      intervalRef.current = setInterval(() => {
        void sendLocation();
      }, 10000);
    };

    void setup();

    return () => {
      active = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [bookingId, mode, onPosition]);

  return null;
}

