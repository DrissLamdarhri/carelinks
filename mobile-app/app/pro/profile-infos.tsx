import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ArrowLeft, MapPin, Phone, User, Camera } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Colors, DEFAULT_AVATAR } from "@/lib/colors";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/db/dal";
import { storage } from "@/lib/db/storage";
import type { ProSpecialty } from "@/lib/db/types";
import { showToast } from "@/lib/toast";

const specialtyOptions: Array<{ label: string; value: ProSpecialty }> = [
  { label: "Infirmier", value: "nurse" },
  { label: "Psychologue", value: "psychologist" },
  { label: "Yoga", value: "yoga_instructor" },
  { label: "Kinésithérapeute", value: "physiotherapist" },
];

export default function ProProfileInfosScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [specialty, setSpecialty] = useState<ProSpecialty>("nurse");
  const [bio, setBio] = useState("");
  const [experience, setExperience] = useState("0");
  const [meetLink, setMeetLink] = useState("");
  const [zoomLink, setZoomLink] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const handlePickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setUploadingAvatar(true);
        setErrorMessage(null);
        try {
          if (!user?.id) throw new Error("User not authenticated");
          const publicUrl = await storage.uploadAvatar(user.id, asset.uri, asset.mimeType || "image/jpeg");
          await db.profiles.update(user.id, { avatar_url: publicUrl });
          setAvatarUri(publicUrl);
          // Small delay to ensure database consistency
          await new Promise(resolve => setTimeout(resolve, 500));
          await refreshProfile();
          showToast(t("avatar_updated"));
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : t("avatar_upload_error"));
        } finally {
          setUploadingAvatar(false);
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("image_pick_error"));
    }
  }, [user?.id, refreshProfile]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!user?.id) return;
      setLoading(true);
      setErrorMessage(null);
      try {
        const [profileData, pro] = await Promise.all([
          db.profiles.get(user.id),
          db.pros.get(user.id),
        ]);
        if (!active) return;
        const nameParts = (profileData.full_name ?? "").split(" ");
        setFirstName(nameParts[0] ?? "");
        setLastName(nameParts.slice(1).join(" "));
        setPhone(profileData.phone ?? "");
        setCity(profileData.city ?? "");
        setEmail(profileData.email ?? user.email ?? "");
        setAvatarUri(profileData.avatar_url ?? null);
        if (pro?.specialty) setSpecialty(pro.specialty);
        setBio(pro?.bio ?? "");
        setExperience(String(pro?.years_experience ?? 0));
        setMeetLink(pro?.meet_link ?? "");
        setZoomLink(pro?.zoom_link ?? "");
      } catch (error) {
        if (!active) return;
        setErrorMessage(error instanceof Error ? error.message : t("profile_unavailable"));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [user?.email, user?.id]);

  const fullName = useMemo(() => `${firstName} ${lastName}`.trim(), [firstName, lastName]);
  const experienceValue = Number.parseInt(experience, 10);
  const isExperienceValid = Number.isFinite(experienceValue) && experienceValue >= 0;

  const handleSave = async () => {
    if (!user?.id || saving) return;
    if (!fullName) {
      setErrorMessage(t("enter_full_name"));
      return;
    }
    if (!isExperienceValid) {
      setErrorMessage(t("invalid_experience"));
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    try {
      await db.profiles.update(user.id, {
        full_name: fullName,
        phone: phone.trim() || null,
        city: city.trim() || null,
      });
      await db.pros.upsert({
        id: user.id,
        specialty,
        bio: bio.trim() || null,
        years_experience: experienceValue,
        // Psychologist remote-session links (used on the appointment confirmation).
        meet_link: specialty === "psychologist" ? meetLink.trim() || null : null,
        zoom_link: specialty === "psychologist" ? zoomLink.trim() || null : null,
      });
      await refreshProfile();
      showToast(t("pro_profile_updated"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("update_failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("pro_profile")}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : null}

      {!loading ? (
        <>
          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <Image source={DEFAULT_AVATAR} style={styles.avatar} />
              )}
              <TouchableOpacity 
                style={styles.changeAvatarBtn}
                onPress={handlePickImage}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Camera size={14} color="white" />
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.avatarHint}>{t("tap_change_photo")}</Text>
          </View>

          <View style={styles.card}>
          <Text style={styles.label}>{t("first_name")}</Text>
          <View style={styles.inputWrap}>
            <User size={16} color={Colors.textMuted} />
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Driss"
              placeholderTextColor={Colors.textSubtle}
              style={styles.input}
            />
          </View>

          <Text style={styles.label}>Nom</Text>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            placeholder="Alaoui"
            placeholderTextColor={Colors.textSubtle}
            style={styles.simpleInput}
          />

          <Text style={styles.label}>{t("phone")}</Text>
          <View style={styles.inputWrap}>
            <Phone size={16} color={Colors.textMuted} />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+212 6 12 34 56 78"
              placeholderTextColor={Colors.textSubtle}
              keyboardType="phone-pad"
              style={styles.input}
            />
          </View>

          <Text style={styles.label}>{t("city")}</Text>
          <View style={styles.inputWrap}>
            <MapPin size={16} color={Colors.textMuted} />
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="Meknès"
              placeholderTextColor={Colors.textSubtle}
              style={styles.input}
            />
          </View>

          <Text style={styles.label}>{t("email")}</Text>
          <TextInput value={email} editable={false} style={styles.simpleInputMuted} />

          <Text style={styles.label}>{t("specialty")}</Text>
          <View style={styles.chipsRow}>
            {specialtyOptions.map((option) => {
              const active = specialty === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setSpecialty(option.value)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>{t("years_experience_lbl")}</Text>
          <TextInput
            value={experience}
            onChangeText={setExperience}
            placeholder="0"
            placeholderTextColor={Colors.textSubtle}
            keyboardType="numeric"
            style={styles.simpleInput}
          />
          {!isExperienceValid ? <Text style={styles.errorText}>{t("enter_valid_number")}</Text> : null}

          <Text style={styles.label}>Bio</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder={t("describe_experience_ph")}
            placeholderTextColor={Colors.textSubtle}
            style={styles.textArea}
            multiline
          />

          {specialty === "psychologist" ? (
            <>
              <Text style={styles.label}>{t("meet_link_label")}</Text>
              <TextInput
                value={meetLink}
                onChangeText={setMeetLink}
                placeholder="https://meet.google.com/xxx-xxxx-xxx"
                placeholderTextColor={Colors.textSubtle}
                autoCapitalize="none"
                keyboardType="url"
                style={styles.linkInput}
              />
              <Text style={styles.label}>{t("zoom_link_label")}</Text>
              <TextInput
                value={zoomLink}
                onChangeText={setZoomLink}
                placeholder="https://zoom.us/j/xxxxxxxxxx"
                placeholderTextColor={Colors.textSubtle}
                autoCapitalize="none"
                keyboardType="url"
                style={styles.linkInput}
              />
              <Text style={styles.hintText}>{t("remote_links_hint")}</Text>
            </>
          ) : null}
        </View>
        </>
      ) : null}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving || loading}>
        {saving ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.saveText}>{t("save")}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  content: { padding: 20, paddingBottom: 32 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.input,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 22, color: Colors.textPrimary, fontFamily: "DMSerifDisplay_400Regular" },
  center: { paddingVertical: 40, alignItems: "center" },
  avatarSection: {
    alignItems: "center",
    marginBottom: 20,
    paddingVertical: 12,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 8,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  changeAvatarBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  avatarHint: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "500",
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    marginBottom: 12,
  },
  label: { color: Colors.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 10 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  input: { flex: 1, color: Colors.textPrimary, fontSize: 14 },
  simpleInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    color: Colors.textPrimary,
  },
  simpleInputMuted: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    color: Colors.textMuted,
  },
  textArea: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textPrimary,
    minHeight: 90,
    textAlignVertical: "top",
  },
  linkInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    color: Colors.textPrimary,
    fontSize: 13.5,
  },
  hintText: { color: Colors.textMuted, fontSize: 12, marginTop: 6, lineHeight: 16 },
  chipsRow: { flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "white",
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textMuted, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "white" },
  saveBtn: {
    marginTop: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "white", fontSize: 14, fontWeight: "600" },
  errorText: { color: Colors.danger, fontSize: 12, marginTop: 8 },
});
