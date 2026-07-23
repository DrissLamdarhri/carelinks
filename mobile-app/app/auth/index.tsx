import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Stethoscope,
  MapPin,
  Shield,
  ChevronRight,
  Globe,
} from "lucide-react-native";
import { Colors, Gradients } from "@/lib/colors";
import { onboardingSlides } from "@/lib/mock-data";
import { useI18n } from "@/lib/i18n";
import { LanguageSelector } from "@/components/LanguageSelector";

const iconMap = {
  stethoscope: Stethoscope,
  "map-pin": MapPin,
  shield: Shield,
} as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [langOpen, setLangOpen] = useState(false);
  const [step, setStep] = useState(0);
  const lastStep = onboardingSlides.length - 1;
  const scrollRef = useRef<FlatList<(typeof onboardingSlides)[0]> | null>(null);
  const screenWidth = Dimensions.get("window").width;

  const next = () => {
    if (step < lastStep) {
      const nextIndex = step + 1;
      scrollRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setStep(nextIndex);
    }
  };

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = e.nativeEvent.contentOffset.x;
    const index = Math.round(offset / screenWidth);
    setStep(Math.min(index, lastStep));
  }, [screenWidth, lastStep]);

  const renderSlide = useCallback(({ item }: { item: typeof onboardingSlides[number] }) => {
    const SlideIcon = iconMap[item.icon];
    return (
      <View style={[styles.slideContainer, { width: screenWidth }]}>
        <View style={styles.iconCard}>
          <SlideIcon size={36} color="white" />
        </View>
        <Text style={styles.title}>{t(item.title)}</Text>
        <Text style={styles.subtitle}>{t(item.subtitle)}</Text>
      </View>
    );
  }, [screenWidth, t]);

  return (
    <LinearGradient colors={Gradients.onboarding} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.bgCircleTopRight} />
        <View style={styles.bgCircleLeft} />
        <View style={styles.bgCircleBottom} />

        <View style={styles.topRow}>
          {/* Language switcher available from the very first screen */}
          <TouchableOpacity style={styles.langBtn} onPress={() => setLangOpen(true)}>
            <Globe size={15} color="white" />
            <Text style={styles.langTxt}>{locale === "ar" ? "العربية" : "Français"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/auth/patient-login")}>
            <Text style={styles.skip}>{t("skip")}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.center}>
          <View style={styles.logoWrap}>
            <Text style={styles.logo}>CareLink</Text>
            <View style={styles.logoLine} />
          </View>

          <FlatList
            ref={scrollRef as any}
            data={onboardingSlides as any}
            renderItem={renderSlide}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            scrollEventThrottle={16}
            onScroll={handleScroll}
            showsHorizontalScrollIndicator={false}
            bounces={false}
          />
        </View>

        <View style={styles.bottom}>
          <View style={styles.dots}>
            {onboardingSlides.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === step ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>

          {step < lastStep ? (
            <TouchableOpacity onPress={next} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>{t("continue_btn")}</Text>
              <ChevronRight size={18} color={Colors.primary} />
            </TouchableOpacity>
          ) : (
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={() => router.push("/auth/patient-login")}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>{t("i_am_patient")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/auth/pro-login")}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>{t("i_am_pro")}</Text>
              </TouchableOpacity>

              {/* Admin Panel link removed from onboarding for security */}
            </View>
          )}
        </View>
        <LanguageSelector visible={langOpen} onClose={() => setLangOpen(false)} />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 0, paddingBottom: 32 },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 24,
    zIndex: 4,
  },
  skip: { color: "rgba(255,255,255,0.65)", fontSize: 13 },
  langBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  langTxt: { color: "white", fontSize: 12.5, fontWeight: "700" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 0,
    zIndex: 3,
  },
  logoWrap: { alignItems: "center", marginBottom: 44, marginTop: 20 },
  logo: {
    fontSize: 38,
    color: "white",
    letterSpacing: 0.2,
    fontFamily: "DMSerifDisplay_400Regular",
  },
  logoLine: {
    marginTop: 4,
    width: 32,
    height: 4,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  slideContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  iconCard: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    color: "white",
    marginBottom: 12,
    textAlign: "center",
    fontFamily: "DMSerifDisplay_400Regular",
  },
  subtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.78)",
    lineHeight: 22,
    textAlign: "center",
  },
  bottom: { zIndex: 3, paddingHorizontal: 24 },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: 24,
  },
  dot: { height: 8, borderRadius: 4 },
  dotActive: { width: 24, backgroundColor: "white" },
  dotInactive: { width: 8, backgroundColor: "rgba(255,255,255,0.35)" },
  primaryBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: "600",
    fontFamily: "DMSans_500Medium",
  },
  secondaryBtn: {
    height: 54,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { color: "white", fontSize: 15, fontWeight: "500" },
  adminLink: {
    marginTop: 2,
    textAlign: "center",
    color: "rgba(255,255,255,0.45)",
    textDecorationLine: "underline",
    fontSize: 11,
  },
  bgCircleTopRight: {
    position: "absolute",
    top: -70,
    right: -70,
    width: 230,
    height: 230,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  bgCircleLeft: {
    position: "absolute",
    top: 210,
    left: -56,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  bgCircleBottom: {
    position: "absolute",
    bottom: 120,
    right: -26,
    width: 110,
    height: 110,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
});
