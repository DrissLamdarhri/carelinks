/**
 * Jump-to-any-date month picker, opened from DateStrip's calendar icon.
 * Deliberately has no "marked days" dots: showing those would mean fetching a
 * full month of data just to feed a rarely-used navigation aid, which is
 * exactly the cost this whole calendar redesign exists to avoid. The week
 * strip (which IS backed by the currently-loaded window) carries the dots.
 */
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { addDays, intlLocale, isSameDay, monthGrid, startOfMonth } from "@/lib/date-utils";

const NAVY = "#0D0870";

export function MonthCalendarModal({
  visible,
  initialDate,
  onClose,
  onSelect,
  accentColor = NAVY,
}: {
  visible: boolean;
  initialDate: Date;
  onClose: () => void;
  onSelect: (d: Date) => void;
  accentColor?: string;
}) {
  const { t, locale } = useI18n();
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(initialDate));
  const tag = intlLocale(locale);
  const today = new Date();
  const grid = monthGrid(viewMonth);
  const weekdayLabels = grid.slice(0, 7).map((d) => d.toLocaleDateString(tag, { weekday: "narrow" }).toUpperCase());

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.head}>
            <Text style={s.title}>{t("choose_date")}</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={8}>
              <X size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={s.monthNav}>
            <TouchableOpacity onPress={() => setViewMonth((m) => startOfMonth(addDays(m, -1)))} style={s.navBtn} hitSlop={8}>
              <ChevronLeft size={18} color={Colors.textMuted} />
            </TouchableOpacity>
            <Text style={s.monthLabel}>{viewMonth.toLocaleDateString(tag, { month: "long", year: "numeric" })}</Text>
            <TouchableOpacity onPress={() => setViewMonth((m) => startOfMonth(addDays(m, 32)))} style={s.navBtn} hitSlop={8}>
              <ChevronRight size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={s.weekdayRow}>
            {weekdayLabels.map((wd, i) => (
              <Text key={i} style={s.weekdayTxt}>{wd}</Text>
            ))}
          </View>

          <View style={s.grid}>
            {grid.map((d) => {
              const inMonth = d.getMonth() === viewMonth.getMonth();
              const selected = isSameDay(d, initialDate);
              const isToday = isSameDay(d, today);
              return (
                <TouchableOpacity
                  key={d.toISOString()}
                  style={[s.cell, selected && { backgroundColor: accentColor }]}
                  onPress={() => { onSelect(d); onClose(); }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      s.cellTxt,
                      !inMonth && s.cellTxtMuted,
                      selected && s.cellTxtActive,
                      isToday && !selected && { color: accentColor, fontWeight: "800" },
                    ]}
                  >
                    {d.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={s.todayBtn}
            onPress={() => { onSelect(new Date()); onClose(); }}
          >
            <Text style={[s.todayTxt, { color: accentColor }]}>{t("today")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { backgroundColor: "white", borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 30 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: "800" },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.input, alignItems: "center", justifyContent: "center" },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  navBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  monthLabel: { fontSize: 14.5, fontWeight: "700", color: Colors.textPrimary, textTransform: "capitalize" },
  weekdayRow: { flexDirection: "row", marginBottom: 4 },
  weekdayTxt: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: Colors.textSubtle },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  cellTxt: { fontSize: 14, fontWeight: "600", color: Colors.textPrimary },
  cellTxtMuted: { color: Colors.textSubtle, opacity: 0.5 },
  cellTxtActive: { color: "white", fontWeight: "800" },
  todayBtn: { alignSelf: "center", marginTop: 14, paddingVertical: 8, paddingHorizontal: 16 },
  todayTxt: { fontSize: 13.5, fontWeight: "700" },
});
