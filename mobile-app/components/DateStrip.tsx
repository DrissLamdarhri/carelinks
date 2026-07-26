/**
 * A Monday-first week strip: tap a day to select it, arrows to move a week at
 * a time, and a calendar icon to jump anywhere via MonthCalendarModal. Used
 * by pro/schedule.tsx and patient/bookings.tsx so both scope their queries
 * (and rendering) to a single day instead of a user's entire history.
 */
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { addDays, dateKey, intlLocale, isSameDay } from "@/lib/date-utils";

const NAVY = "#0D0870";

export function DateStrip({
  weekStart,
  selectedDate,
  markedDates,
  onSelectDate,
  onChangeWeek,
  onOpenCalendar,
  locale,
  accentColor = NAVY,
}: {
  weekStart: Date;
  selectedDate: Date;
  markedDates: Set<string>;
  onSelectDate: (d: Date) => void;
  onChangeWeek: (weekStart: Date) => void;
  onOpenCalendar: () => void;
  locale: string;
  accentColor?: string;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();
  const tag = intlLocale(locale);
  const monthLabel = weekStart.toLocaleDateString(tag, { month: "long", year: "numeric" });

  return (
    <View style={s.root}>
      <View style={s.nav}>
        <TouchableOpacity style={s.navBtn} onPress={() => onChangeWeek(addDays(weekStart, -7))} hitSlop={8}>
          <ChevronLeft size={17} color={Colors.textMuted} />
        </TouchableOpacity>
        <Text style={s.monthLabel}>{monthLabel}</Text>
        <View style={s.navRight}>
          <TouchableOpacity style={s.calendarBtn} onPress={onOpenCalendar} hitSlop={8}>
            <CalendarDays size={15} color={accentColor} />
          </TouchableOpacity>
          <TouchableOpacity style={s.navBtn} onPress={() => onChangeWeek(addDays(weekStart, 7))} hitSlop={8}>
            <ChevronRight size={17} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.week}>
        {days.map((d) => {
          const selected = isSameDay(d, selectedDate);
          const isToday = isSameDay(d, today);
          const marked = markedDates.has(dateKey(d));
          return (
            <TouchableOpacity
              key={dateKey(d)}
              style={[s.cell, selected && { backgroundColor: accentColor }]}
              onPress={() => onSelectDate(d)}
              activeOpacity={0.8}
            >
              <Text style={[s.wd, selected && s.wdActive]}>
                {d.toLocaleDateString(tag, { weekday: "narrow" }).toUpperCase()}
              </Text>
              <View style={[s.dayNum, isToday && !selected && { borderColor: accentColor, borderWidth: 1.5 }]}>
                <Text style={[s.dayTxt, selected && s.dayTxtActive, isToday && !selected && { color: accentColor }]}>
                  {d.getDate()}
                </Text>
              </View>
              <View style={[s.dot, marked && { backgroundColor: selected ? "white" : accentColor }]} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: "white" },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, marginBottom: 10 },
  navBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  navRight: { flexDirection: "row", alignItems: "center", gap: 2 },
  calendarBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  monthLabel: { fontSize: 13, fontWeight: "700", color: Colors.textPrimary, textTransform: "capitalize" },
  week: { flexDirection: "row", justifyContent: "space-between" },
  cell: { alignItems: "center", gap: 4, borderRadius: 14, paddingVertical: 8, width: 44 },
  wd: { fontSize: 10, fontWeight: "700", color: Colors.textSubtle },
  wdActive: { color: "rgba(255,255,255,0.75)" },
  dayNum: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  dayTxt: { fontSize: 14, fontWeight: "700", color: Colors.textPrimary },
  dayTxtActive: { color: "white" },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "transparent" },
});
