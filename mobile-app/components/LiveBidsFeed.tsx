import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Check, Loader2, Star } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { db } from "@/lib/db/dal";
import { toastError, toastSuccess } from "@/lib/toast";
import { isDemoBookingId } from "@/lib/demo-booking";
import { useBookingBids } from "@/lib/db/realtime";
import type { Bid } from "@/lib/db/types";

type BidderInfo = { full_name: string | null; avatar_url: string | null; rating_avg: number | null };

type LiveBidsFeedProps = {
  bookingId: string;
  onAccepted?: (bidId: string) => void;
  mockBids?: Bid[];
};

export function LiveBidsFeed({ bookingId, onAccepted, mockBids }: LiveBidsFeedProps) {
  const isDemoBooking = isDemoBookingId(bookingId);
  const { pendingBids: liveBids, loading: liveLoading } = useBookingBids(isDemoBooking ? null : bookingId);
  const pendingBids = isDemoBooking ? mockBids ?? [] : liveBids;
  const loading = isDemoBooking ? false : liveLoading;
  const { t } = useI18n();
  const [accepting, setAccepting] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Real name/photo/rating of every pro who's bid — the card used to show a
  // colored circle with the first two characters of their UUID and a
  // hardcoded 4.8 star. Fetched once per professional_id and cached.
  const [bidders, setBidders] = useState<Record<string, BidderInfo>>({});
  const fetchedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const missing = pendingBids
      .map((b) => b.professional_id)
      .filter((id) => id && !fetchedRef.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => fetchedRef.current.add(id));
    void (async () => {
      const entries = await Promise.all(
        missing.map(async (id) => {
          const [profile, pro] = await Promise.all([
            db.profiles.get(id).catch(() => null),
            db.pros.get(id).catch(() => null),
          ]);
          const info: BidderInfo = {
            full_name: profile?.full_name ?? null,
            avatar_url: profile?.avatar_url ?? null,
            rating_avg: pro?.rating_avg ?? null,
          };
          return [id, info] as const;
        })
      );
      setBidders((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    })();
  }, [pendingBids]);

  const accept = async (bidId: string) => {
    const bid = pendingBids.find((row) => row.id === bidId);
    if (!bid) return;
    setErrorMessage(null);
    setAccepting(bid.id);
    try {
      if (isDemoBooking) {
        onAccepted?.(bid.id);
        return;
      }
      // RLS-safe atomic accept + match (same RPC as the offers screen).
      await db.bids.acceptAndMatch(bid.id);
      toastSuccess(t("offer_accepted"));
      onAccepted?.(bid.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("accept_error"));
      toastError(t("cannot_accept_offer"));
    } finally {
      setAccepting(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  if (pendingBids.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{t("waiting_for_bids")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {pendingBids.map((bid) => {
        const bidder = bidders[bid.professional_id];
        const name = bidder?.full_name?.trim() || t("professional");
        const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "P";
        return (
        <View key={bid.id} style={styles.card}>
          {bidder?.avatar_url ? (
            <Image source={{ uri: bidder.avatar_url }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.proName}>{name}</Text>
            <View style={styles.metaRow}>
              <Star size={10} color="#F5B544" fill="#F5B544" />
              <Text style={styles.metaText}>{bidder?.rating_avg != null ? bidder.rating_avg.toFixed(1) : "—"}</Text>
              {bid.eta_min ? <Text style={styles.metaText}>· {bid.eta_min} min</Text> : null}
            </View>
          </View>
          <View style={styles.priceWrap}>
            <Text style={styles.price}>{bid.price_mad}</Text>
            <Text style={styles.priceUnit}>MAD</Text>
          </View>
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => accept(bid.id)}
            disabled={accepting === bid.id}
          >
            {accepting === bid.id ? (
              <Loader2 size={14} color="white" />
            ) : (
              <Check size={16} color="white" />
            )}
          </TouchableOpacity>
        </View>
        );
      })}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 14 },
  emptyText: { color: Colors.textMuted, fontSize: 13 },
  list: { gap: 8 },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceWarm,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(91,184,212,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: Colors.primary, fontSize: 13, fontWeight: "700" },
  avatarImg: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.surfaceWarm },
  proName: { color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  metaText: { color: Colors.textMuted, fontSize: 11 },
  priceWrap: { alignItems: "flex-end", marginRight: 2 },
  price: { color: Colors.primary, fontSize: 16, fontWeight: "700" },
  priceUnit: { color: Colors.textMuted, fontSize: 10 },
  acceptBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: { marginTop: 4, color: Colors.danger, fontSize: 12 },
});
