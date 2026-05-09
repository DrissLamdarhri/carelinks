/**
 * CareLink — NotificationBell
 * Composant autonome : icône cloche + badge non-lus + panneau bas-écran.
 * S'abonne via useUserNotifications (Supabase Realtime).
 */
import { useState, useRef, useEffect } from "react";
import type { ElementType } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Bell, Banknote, CheckCircle2, CalendarDays,
  MessageCircle, Info, X, Check, BellOff,
} from "lucide-react";
import { useUserNotifications } from "../../lib/db/realtime";
import { db } from "../../lib/db";
import { useNavigate } from "react-router";
import type { Notification, NotificationKind } from "../../lib/db/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

const KIND_META: Record<NotificationKind, { Icon: ElementType; color: string; bg: string; label: string }> = {
  new_bid:        { Icon: Banknote,      color: "#0D0870", bg: "#EDE5CC",  label: "Nouvelle offre" },
  bid_accepted:   { Icon: CheckCircle2,  color: "#22c55e", bg: "#dcfce7",  label: "Offre acceptée" },
  booking_status: { Icon: CalendarDays,  color: "#5BB8D4", bg: "#D8F0F4",  label: "Mise à jour RDV" },
  message:        { Icon: MessageCircle, color: "#8B5CF6", bg: "#EDE9FE",  label: "Nouveau message" },
  system:         { Icon: Info,          color: "#888780", bg: "#F3F3F5",  label: "Système" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h} h`;
  return `Il y a ${Math.floor(h / 24)} j`;
}

function notifText(n: Notification): string {
  const p = n.payload as Record<string, unknown>;
  switch (n.kind) {
    case "new_bid":
      return p.pro_name
        ? `${p.pro_name} a soumis une offre à ${p.price_mad ?? "—"} MAD`
        : "Un professionnel a répondu à votre demande";
    case "bid_accepted":
      return "Votre offre a été acceptée ! Préparez-vous pour la mission.";
    case "booking_status":
      return p.message
        ? String(p.message)
        : "Le statut de votre réservation a changé";
    case "message":
      return p.body
        ? `Nouveau message : « ${String(p.body).slice(0, 40)}… »`
        : "Vous avez reçu un nouveau message";
    case "system":
    default:
      return p.message ? String(p.message) : "Notification système";
  }
}

// ── Component ──────────────���──────────────────────────────────────────────────

interface NotificationBellProps {
  /** Supabase Auth user id */
  userId: string | null;
  /** Force white icon (on dark background) */
  light?: boolean;
}

export function NotificationBell({ userId, light = true }: NotificationBellProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { notifications, unreadCount, refresh } = useUserNotifications(userId);

  // Close panel on outside click (backdrop handles this, but just in case)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler, { capture: true });
    return () => document.removeEventListener("mousedown", handler, { capture: true });
  }, [open]);

  // ── Actions ──

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleMarkRead = async (n: Notification) => {
    if (n.is_read) return;
    try {
      await db.notifications.markRead(n.id);
      await refresh();
    } catch (err) {
      console.error("markRead error:", err);
    }
  };

  const handleMarkAll = async () => {
    if (!userId) return;
    try {
      await db.notifications.markAllRead(userId);
      await refresh();
    } catch (err) {
      console.error("markAllRead error:", err);
    }
  };

  const handleTap = async (n: Notification) => {
    await handleMarkRead(n);
    const p = n.payload as Record<string, unknown>;
    switch (n.kind) {
      case "new_bid":
        if (p.booking_id) {
          navigate("/app/offers", { state: { supabaseBookingId: p.booking_id } });
        } else {
          navigate("/app/bookings");
        }
        break;
      case "bid_accepted":
        navigate("/app/bookings");
        break;
      case "booking_status":
        navigate("/app/bookings");
        break;
      case "message":
        if (p.booking_id) {
          navigate(`/app/chat/${p.booking_id}`);
        } else {
          navigate("/app/chat");
        }
        break;
      default:
        break;
    }
    setOpen(false);
  };

  // ── Render ──

  return (
    <>
      {/* ── Bell button ── */}
      <button
        onClick={handleOpen}
        className="relative w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90"
        style={{ background: light ? "rgba(255,255,255,0.12)" : "rgba(13,8,112,0.08)" }}
        aria-label="Notifications"
      >
        <Bell
          size={20}
          className={light ? "text-white" : "text-[#0D0870]"}
          strokeWidth={unreadCount > 0 ? 2.2 : 1.8}
        />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-white border-2 px-0.5"
              style={{
                background: "#E24B4A",
                borderColor: light ? "#0D0870" : "white",
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* ── Overlay + bottom sheet ── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.45)" }}
              onClick={handleClose}
            />

            {/* Panel */}
            <motion.div
              key="panel"
              ref={panelRef}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              className="fixed bottom-0 left-1/2 z-50 flex flex-col"
              style={{
                width: "min(375px, 100vw)",
                maxHeight: "70vh",
                transform: "translateX(-50%)",
                borderRadius: "20px 20px 0 0",
                background: "#FFFFFF",
                boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
              }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-[#E0E0E0]" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#F0F0F0]">
                <span className="text-[16px] text-[#1A1A1A]" style={{ fontWeight: 700, fontFamily: "'DM Serif Display', serif" }}>
                  Notifications
                </span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAll}
                      className="flex items-center gap-1 text-[11px] text-[#5BB8D4] px-2 py-1 rounded-lg bg-[#D8F0F4]"
                      style={{ fontWeight: 600 }}
                    >
                      <Check size={12} />
                      Tout lire
                    </button>
                  )}
                  <button
                    onClick={handleClose}
                    className="w-8 h-8 rounded-full bg-[#F3F3F5] flex items-center justify-center"
                  >
                    <X size={16} className="text-[#888780]" />
                  </button>
                </div>
              </div>

              {/* Notification list */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 px-8 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-[#EDE5CC] flex items-center justify-center mb-4">
                      <BellOff size={28} className="text-[#0D0870]" />
                    </div>
                    <p className="text-[15px] text-[#1A1A1A] mb-1" style={{ fontWeight: 600 }}>
                      Aucune notification
                    </p>
                    <p className="text-[13px] text-[#888780]">
                      Vous serez notifié dès qu'il y a une mise à jour.
                    </p>
                  </div>
                ) : (
                  <ul className="py-2">
                    {notifications.map((n) => {
                      const meta = KIND_META[n.kind] ?? KIND_META.system;
                      const { Icon } = meta;
                      return (
                        <li key={n.id}>
                          <button
                            onClick={() => handleTap(n)}
                            className="w-full text-left flex items-start gap-3 px-5 py-3.5 active:bg-[#F6F5F0] transition-colors relative"
                            style={{ background: n.is_read ? "transparent" : "rgba(13,8,112,0.03)" }}
                          >
                            {/* Unread dot */}
                            {!n.is_read && (
                              <span
                                className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                                style={{ background: "#0D0870" }}
                              />
                            )}

                            {/* Icon chip */}
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                              style={{ background: meta.bg }}
                            >
                              <Icon size={18} style={{ color: meta.color }} />
                            </div>

                            {/* Text */}
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-[12px] mb-0.5"
                                style={{ color: meta.color, fontWeight: 600 }}
                              >
                                {meta.label}
                              </p>
                              <p
                                className="text-[13px] text-[#1A1A1A] leading-snug"
                                style={{ fontWeight: n.is_read ? 400 : 500 }}
                              >
                                {notifText(n)}
                              </p>
                              <p className="text-[11px] text-[#B0B0B0] mt-0.5">
                                {timeAgo(n.created_at)}
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Footer safe-area spacer */}
              <div style={{ height: "env(safe-area-inset-bottom, 8px)" }} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}