/**
 * LiveTrackingChannel — pro broadcasts position every 10s; patient watches.
 * Uses Supabase Realtime presence channel keyed by booking id.
 *
 * Usage:
 *   <LiveTrackingChannel bookingId={id} mode="broadcast" />   // pro
 *   <LiveTrackingChannel bookingId={id} mode="watch" />       // patient
 */
import { useEffect, useState } from "react";
import { Navigation, MapPin, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";

interface Props { bookingId: string; mode: "broadcast" | "watch" }

export function LiveTrackingChannel({ bookingId, mode }: Props) {
  const [pos, setPos] = useState<{ lat: number; lng: number; at: number } | null>(null);

  useEffect(() => {
    const channel = supabase.channel(`tracking:${bookingId}`, { config: { broadcast: { self: false } } });

    channel.on("broadcast", { event: "pos" }, ({ payload }) => {
      setPos({ lat: payload.lat, lng: payload.lng, at: Date.now() });
    });
    channel.subscribe();

    let interval: number | undefined;
    if (mode === "broadcast" && navigator.geolocation) {
      const send = () => {
        navigator.geolocation.getCurrentPosition((p) => {
          channel.send({
            type: "broadcast", event: "pos",
            payload: { lat: p.coords.latitude, lng: p.coords.longitude },
          });
          setPos({ lat: p.coords.latitude, lng: p.coords.longitude, at: Date.now() });
        });
      };
      send();
      interval = window.setInterval(send, 10_000);
    }

    return () => {
      if (interval) clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [bookingId, mode]);

  return (
    <div className="bg-white rounded-2xl p-3.5 flex items-center gap-3" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="w-10 h-10 rounded-full bg-[#5BB8D4]/20 flex items-center justify-center">
        {mode === "broadcast" ? <Navigation size={16} className="text-[#0D0870]" /> : <MapPin size={16} className="text-[#0D0870]" />}
      </div>
      <div className="flex-1">
        <p className="text-[12px] text-[#1A1A1A]" style={{ fontWeight: 600 }}>
          {mode === "broadcast" ? "Vous partagez votre position" : "Suivi en direct"}
        </p>
        <p className="text-[10px] text-[#888780]">
          {pos ? `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}` : <><Loader2 size={9} className="inline animate-spin mr-1" />En attente…</>}
        </p>
      </div>
      <div className={`w-2 h-2 rounded-full ${pos && Date.now() - pos.at < 15_000 ? "bg-[#3BB273] animate-pulse" : "bg-[#D0D0D0]"}`} />
    </div>
  );
}
