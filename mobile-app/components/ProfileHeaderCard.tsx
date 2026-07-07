import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Edit3, Phone, Star } from "lucide-react-native";
import { Colors } from "@/lib/colors";
import { AvatarWithDefault } from "@/components/AvatarWithDefault";

const NAVY = "#0D0870";
const CREAM = "#EDE5CC";

export type ProfileStat = { value: string | number; label: string; star?: boolean; accent?: boolean };

type Props = {
  title: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  avatarUrl: string;
  initials: string;
  uploading?: boolean;
  onEditAvatar?: () => void;
  stats: ProfileStat[];
};

export function ProfileHeaderCard({
  title, name, email, phone, city, avatarUrl, initials, uploading, onEditAvatar, stats,
}: Props) {
  const hasPhone = !!phone && phone !== "—";
  return (
    <View style={s.card}>
      <Text style={s.title}>{title}</Text>

      <View style={s.row}>
        <View style={s.avatarWrap}>
          <AvatarWithDefault avatarUrl={avatarUrl} initials={initials} size={64} borderRadius={32} useDefaultImage={!avatarUrl} />
          {onEditAvatar ? (
            <TouchableOpacity style={s.editBtn} onPress={onEditAvatar} disabled={uploading}>
              {uploading ? <ActivityIndicator size="small" color="white" /> : <Edit3 size={10} color="white" />}
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={s.meta}>
          <Text style={s.name} numberOfLines={1}>{name}</Text>
          <Text style={s.email} numberOfLines={1}>{email}</Text>
          {hasPhone ? (
            <View style={s.phoneRow}>
              <Phone size={12} color={NAVY} />
              <Text style={s.phone}>{phone}</Text>
              <View style={s.waBadge}><Text style={s.waTxt}>WA</Text></View>
            </View>
          ) : null}
          {city && city !== "—" ? <Text style={s.city}>{city}</Text> : null}
        </View>
      </View>

      <View style={s.stats}>
        {stats.map((st, i) => (
          <View key={st.label} style={s.statWrap}>
            {i > 0 ? <View style={s.divider} /> : null}
            <View style={s.stat}>
              <View style={s.valueRow}>
                {st.star ? <Star size={14} color="#FBBF24" fill="#FBBF24" /> : null}
                <Text style={[s.value, st.accent && { color: NAVY }]}>{st.value}</Text>
              </View>
              <Text style={s.label}>{st.label}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: "white", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#F0F0F0", marginBottom: 14 },
  title: { fontSize: 24, color: Colors.textPrimary, fontFamily: "DMSerifDisplay_400Regular", marginBottom: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarWrap: { position: "relative" },
  editBtn: { position: "absolute", right: -1, bottom: -1, width: 22, height: 22, borderRadius: 11, backgroundColor: NAVY, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "white" },
  meta: { flex: 1, minWidth: 0 },
  name: { color: Colors.textPrimary, fontSize: 18, fontWeight: "800" },
  email: { marginTop: 2, color: Colors.textMuted, fontSize: 12.5 },
  phoneRow: { marginTop: 5, flexDirection: "row", alignItems: "center", gap: 5 },
  phone: { color: NAVY, fontSize: 13, fontWeight: "700" },
  waBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#25D366", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 2 },
  waTxt: { color: "white", fontSize: 9.5, fontWeight: "800" },
  city: { marginTop: 3, color: Colors.textSubtle, fontSize: 12 },
  stats: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#F0F0F0", flexDirection: "row", alignItems: "center" },
  statWrap: { flex: 1, flexDirection: "row", alignItems: "center" },
  divider: { width: 1, height: 32, backgroundColor: "#F0F0F0" },
  stat: { flex: 1, alignItems: "center" },
  valueRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  value: { color: Colors.textPrimary, fontSize: 18, fontWeight: "800" },
  label: { color: Colors.textMuted, fontSize: 11, marginTop: 2, textAlign: "center" },
});
