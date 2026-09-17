/**
 * CareLink — first-launch terms gate.
 *
 * Blocks the entire app until the user accepts. It is mounted at the root,
 * above the router, so there is no screen to reach around it and no back
 * gesture that dismisses it.
 *
 * Two deliberate choices:
 *
 *  • Accept stays disabled until the text has been scrolled to the end. The
 *    value of this gate is evidence of INFORMED consent; a button the user can
 *    hit without the text ever moving is evidence of a tap, which is worth
 *    much less. `onLayout` also enables it when the text is short enough not
 *    to scroll at all, so a large-font or tablet user is never stuck.
 *
 *  • Refuse is real. It asks for confirmation, then leaves. An app that offers
 *    a choice and ignores one of the answers has not obtained consent, it has
 *    obtained a click — and that is exactly the argument that would be made
 *    against it later.
 *
 *  • This screen is ALWAYS in Arabic, whatever language the rest of the app
 *    is set to. Arabic is the official language of Morocco and the language
 *    these terms are binding in; a user who set the interface to French or
 *    English has expressed a preference about menus, not a waiver of the
 *    language their contract is written in. Rendering it in the UI locale also
 *    meant the agreement a patient accepted depended on a settings toggle,
 *    which is not a property a contract should have.
 *
 *    This is why there is no language picker here even though every string on
 *    the screen exists in three languages: a chooser would reintroduce exactly
 *    the ambiguity the rule removes.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { ArrowDown, ShieldCheck } from "lucide-react-native";
import { Colors, Shadows } from "@/lib/colors";
import { trFor } from "@/lib/i18n";
import { hasAcceptedLocally, markAcceptedLocally, recordAcceptance } from "@/lib/terms";

const SECTIONS = [
  "terms_s1", // what CareLink is
  "terms_s2", // not an emergency service
  "terms_s3", // verification without guarantee
  "terms_s4", // your responsibilities
  "terms_s5", // limits of our liability
  "terms_s6", // payment and disputes
  "terms_s7", // your data
] as const;

/**
 * The language this gate is written in, fixed.
 *
 * `trFor` is the existing helper for rendering text in a locale other than the
 * active one — it was built so a device could write a message another user
 * would read. The same need applies here: the contract has its own language,
 * independent of whoever is holding the phone.
 */
const TERMS_LOCALE = "ar";

export function TermsGate({ children }: { children: React.ReactNode }) {
  const t = (k: string) => trFor(TERMS_LOCALE, k);
  const [checked, setChecked] = useState(false);
  const [visible, setVisible] = useState(false);
  const [readToEnd, setReadToEnd] = useState(false);
  const [saving, setSaving] = useState(false);
  const contentH = useRef(0);
  const viewportH = useRef(0);

  useEffect(() => {
    let active = true;
    void hasAcceptedLocally().then((ok) => {
      if (!active) return;
      setVisible(!ok);
      setChecked(true);
    });
    return () => { active = false; };
  }, []);

  // Android hardware back must not dismiss the gate — that would be a way
  // into the app without an answer.
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, [visible]);

  /**
   * Did this scroll position reach the end?
   *
   * The tolerance is generous on purpose. Sub-pixel layout, the bottom padding
   * and Android's overscroll all mean the arithmetic can sit a few points short
   * of `contentSize.height` at the visual bottom, and every one of those points
   * is a user staring at the end of the document with the button still greyed
   * out — which is exactly what the field recording shows.
   */
  const checkEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 48) setReadToEnd(true);
  }, []);

  const onContentSize = useCallback((_w: number, h: number) => {
    contentH.current = h;
    if (viewportH.current > 0 && h <= viewportH.current + 8) setReadToEnd(true);
  }, []);

  const onViewportLayout = useCallback((e: LayoutChangeEvent) => {
    viewportH.current = e.nativeEvent.layout.height;
    if (contentH.current > 0 && contentH.current <= viewportH.current + 8) setReadToEnd(true);
  }, []);

  const accept = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    // Local first: the durable write needs a session, which usually does not
    // exist yet at first launch. syncPendingAcceptance() reconciles at sign-in.
    await markAcceptedLocally();
    // The locale that goes in the record is the one the text was SHOWN in, not
    // the app's UI language — that is the version of the document this person
    // actually read and agreed to.
    await recordAcceptance(TERMS_LOCALE);
    setVisible(false);
    setSaving(false);
  }, [saving]);

  const refuse = useCallback(() => {
    Alert.alert(t("terms_refuse_title"), t("terms_refuse_body"), [
      { text: t("terms_read_again"), style: "cancel" },
      {
        text: t("terms_quit"),
        style: "destructive",
        onPress: () => {
          // iOS has no supported way to terminate an app, and faking one gets
          // builds rejected. There the gate simply stays up.
          if (Platform.OS === "android") BackHandler.exitApp();
        },
      },
    ]);
  }, [t]);

  // Arabic, so right-to-left — unconditionally, and set here rather than
  // inherited, because the gate is mounted above the router and outside
  // whatever direction the app shell is applying to itself.
  const rtl = { textAlign: "right", writingDirection: "rtl" } as const;

  // Don't flash the app underneath before we know whether to block it.
  if (!checked) {
    return (
      <View style={s.boot}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      {children}
      <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={() => {}}>
        <View style={s.root}>
          <View style={[s.header, s.rtlBlock]}>
            <View style={s.iconWrap}>
              <ShieldCheck size={22} color={Colors.primary} />
            </View>
            <Text style={[s.title, rtl]}>{t("terms_title")}</Text>
            <Text style={[s.sub, rtl]}>{t("terms_sub")}</Text>
          </View>

          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollBody}
            onScroll={checkEnd}
            // The two events that are guaranteed to fire at the FINAL resting
            // offset. Without them a fling that coasts to the bottom can leave
            // the gate shut until the user scrolls again — the reported bug.
            onMomentumScrollEnd={checkEnd}
            onScrollEndDrag={checkEnd}
            scrollEventThrottle={16}
            onContentSizeChange={onContentSize}
            onLayout={onViewportLayout}
            showsVerticalScrollIndicator
          >
            {SECTIONS.map((k) => (
              <View key={k} style={s.section}>
                <Text style={[s.sectionTitle, rtl]}>{t(`${k}_title`)}</Text>
                <Text style={[s.sectionBody, rtl]}>{t(`${k}_body`)}</Text>
              </View>
            ))}
            <Text style={[s.lastUpdated, rtl]}>{t("terms_governing_law")}</Text>
          </ScrollView>

          <View style={s.footer}>
            {!readToEnd ? (
              <View style={s.scrollHint}>
                <ArrowDown size={13} color={Colors.textMuted} />
                <Text style={s.scrollHintTxt}>{t("terms_scroll_hint")}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[s.accept, (!readToEnd || saving) && s.acceptOff]}
              disabled={!readToEnd || saving}
              onPress={accept}
              activeOpacity={0.9}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.acceptTxt}>{t("terms_accept")}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={s.refuse} onPress={refuse} activeOpacity={0.7}>
              <Text style={s.refuseTxt}>{t("terms_refuse")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  boot: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.surfaceWarm },
  root: { flex: 1, backgroundColor: Colors.surfaceWarm },
  header: { paddingTop: 58, paddingHorizontal: 22, paddingBottom: 14, backgroundColor: "#fff" },
  iconWrap: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.surfaceWarm,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: "800", color: Colors.textPrimary },
  sub: { fontSize: 13.5, color: Colors.textMuted, marginTop: 5, lineHeight: 19 },
  // Arabic reads right-to-left, so the block starts on the right too — the
  // shield icon included. Text alignment alone would leave it stranded left.
  rtlBlock: { alignItems: "flex-end" },
  scroll: { flex: 1 },
  scrollBody: { padding: 22, paddingBottom: 30 },
  section: { marginBottom: 18 },
  // Deliberately quiet.
  //
  // These clauses have to say "danger vital", "hémorragie", "perte de
  // conscience" and "CareLink n'est pas un service d'urgence" — necessary
  // wording that, set at full contrast, reads to a patient as a warning about
  // the app they are one tap from using. Dropping the weight lets the page be
  // skimmed calmly and read closely by whoever wants to.
  //
  // Not faded to the point of being hard to read: consent that cannot be read
  // is not consent, and this screen's whole purpose is to be able to show that
  // the text was legible and was scrolled. 0.75 is the floor for that.
  sectionTitle: { fontSize: 14.5, fontWeight: "700", color: Colors.textMuted, marginBottom: 6, opacity: 0.9 },
  sectionBody: { fontSize: 13.5, color: Colors.textMuted, lineHeight: 20, opacity: 0.75 },
  lastUpdated: { fontSize: 12, color: Colors.textSubtle, marginTop: 6, lineHeight: 18, opacity: 0.75 },
  footer: {
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: Colors.border,
    paddingHorizontal: 22, paddingTop: 12, paddingBottom: 28, gap: 10,
  },
  scrollHint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 2 },
  scrollHintTxt: { fontSize: 12, color: Colors.textMuted, fontWeight: "600" },
  accept: {
    height: 54, borderRadius: 16, backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center", ...Shadows.md,
  },
  acceptOff: { opacity: 0.4 },
  acceptTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },
  refuse: { height: 44, alignItems: "center", justifyContent: "center" },
  refuseTxt: { color: Colors.textMuted, fontSize: 14, fontWeight: "700" },
});
