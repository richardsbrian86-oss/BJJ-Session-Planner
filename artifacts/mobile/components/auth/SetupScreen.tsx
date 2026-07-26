import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PinPad } from "@/components/PinPad";
import { EmailAuthScreen } from "@/components/auth/EmailAuthScreen";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

type SetupStep = "choose" | "name" | "pin" | "confirm" | "email";

const STEPS_PIN: SetupStep[] = ["choose", "name", "pin", "confirm"];

function StepDots({ step }: { step: SetupStep }) {
  const colors = useColors();
  const steps = STEPS_PIN;
  const current = steps.indexOf(step);
  if (current < 0) return null;
  return (
    <View style={dotStyles.row}>
      {steps.map((_, i) => (
        <View
          key={i}
          style={[
            dotStyles.dot,
            {
              backgroundColor:
                i <= current ? colors.primary : colors.primary + "30",
              width: i === current ? 20 : 8,
            },
          ]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { height: 8, borderRadius: 4 },
});

export function SetupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setupInstructor } = useAuth();

  const [step, setStep] = useState<SetupStep>("choose");
  const [name, setName] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handlePinSet(pin: string) {
    setFirstPin(pin);
    Haptics.selectionAsync();
    setStep("confirm");
  }

  async function handlePinConfirm(pin: string) {
    if (pin !== firstPin) {
      setPinError(true);
      return;
    }
    setSaving(true);
    try {
      await setupInstructor(name.trim(), pin);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setSaving(false);
    }
  }

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + 32;

  if (step === "email") {
    return <EmailAuthScreen initialMode="register" onBack={() => setStep("choose")} />;
  }

  if (step === "choose") {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: topPad + 24, paddingBottom: bottomPad },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <View style={[styles.brandIcon, { backgroundColor: colors.primary + "20" }]}>
              <Text style={styles.brandEmoji}>🥋</Text>
            </View>
            <Text style={[styles.brandName, { color: colors.foreground }]}>Welcome!</Text>
            <Text style={[styles.brandSub, { color: colors.mutedForeground }]}>
              Let's set up your instructor profile.{"\n"}It only takes a minute.
            </Text>
          </View>

          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.infoTitle, { color: colors.foreground }]}>You'll set up:</Text>
            {[
              { icon: "👤", text: "Your public name" },
              { icon: "🔐", text: "A secure sign-in method" },
              { icon: "📋", text: "Your services & availability (after setup)" },
            ].map((item) => (
              <View key={item.text} style={styles.infoRow}>
                <Text style={styles.infoEmoji}>{item.icon}</Text>
                <Text style={[styles.infoText, { color: colors.mutedForeground }]}>{item.text}</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={[styles.chooseTitle, { color: colors.foreground }]}>
              How do you want to sign in?
            </Text>

            <TouchableOpacity
              style={[styles.optionCard, { backgroundColor: colors.card, borderColor: colors.primary }]}
              onPress={() => setStep("name")}
              activeOpacity={0.85}
            >
              <View style={[styles.optionIcon, { backgroundColor: colors.primary + "20" }]}>
                <Text style={styles.optionEmoji}>🔢</Text>
              </View>
              <View style={styles.optionText}>
                <Text style={[styles.optionTitle, { color: colors.foreground }]}>PIN code</Text>
                <Text style={[styles.optionSub, { color: colors.mutedForeground }]}>
                  Quick 6-digit unlock — great for on-mat use
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setStep("email")}
              activeOpacity={0.85}
            >
              <View style={[styles.optionIcon, { backgroundColor: colors.primary + "20" }]}>
                <Text style={styles.optionEmoji}>✉️</Text>
              </View>
              <View style={styles.optionText}>
                <Text style={[styles.optionTitle, { color: colors.foreground }]}>Email & password</Text>
                <Text style={[styles.optionSub, { color: colors.mutedForeground }]}>
                  Use your email to log in across devices
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 24, paddingBottom: bottomPad },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.brand, styles.brandCompact]}>
          <View style={[styles.brandIcon, styles.brandIconSm, { backgroundColor: colors.primary + "20" }]}>
            <Text style={[styles.brandEmoji, styles.brandEmojiSm]}>🥋</Text>
          </View>
          <Text style={[styles.brandName, styles.brandNameSm, { color: colors.foreground }]}>
            Let's Roll
          </Text>
          <StepDots step={step} />
        </View>

        {step === "name" && (
          <View style={styles.section}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>What's your name?</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              This is your public name — clients will see it on your booking page and in their session details.
            </Text>
            <TextInput
              style={[
                styles.nameInput,
                { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border },
              ]}
              placeholder="e.g. Coach Alex"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => name.trim().length > 0 && setStep("pin")}
            />
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary, opacity: name.trim().length === 0 ? 0.45 : 1 }]}
              onPress={() => setStep("pin")}
              disabled={name.trim().length === 0}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>Continue →</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep("choose")} style={styles.backLink}>
              <Text style={[styles.backLinkText, { color: colors.primary }]}>← Choose sign-in method</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === "pin" && (
          <View style={styles.section}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>Create your PIN</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              Choose a 6-digit PIN to protect your schedule. Don't use your device passcode.
            </Text>
            <PinPad pinLength={6} onComplete={handlePinSet} />
            <TouchableOpacity onPress={() => setStep("name")} style={styles.backLink}>
              <Text style={[styles.backLinkText, { color: colors.primary }]}>← Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === "confirm" && (
          <View style={styles.section}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>Confirm your PIN</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              Enter the same 6 digits again to confirm.
            </Text>
            <PinPad
              pinLength={6}
              onComplete={handlePinConfirm}
              error={pinError}
              onErrorClear={() => setPinError(false)}
              subtitle={pinError ? "PINs didn't match — try again." : undefined}
            />
            {saving && (
              <Text style={[styles.stepSub, { color: colors.primary }]}>Setting up your profile…</Text>
            )}
            <TouchableOpacity onPress={() => { setFirstPin(""); setStep("pin"); }} style={styles.backLink}>
              <Text style={[styles.backLinkText, { color: colors.primary }]}>← Choose a different PIN</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 28, alignItems: "center", gap: 24 },
  brand: { alignItems: "center", gap: 8 },
  brandCompact: { gap: 6 },
  brandIcon: { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  brandIconSm: { width: 48, height: 48, borderRadius: 14 },
  brandEmoji: { fontSize: 36 },
  brandEmojiSm: { fontSize: 24 },
  brandName: { fontSize: 28, fontFamily: "Inter_700Bold" },
  brandNameSm: { fontSize: 20 },
  brandSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 21 },
  infoCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  infoTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoEmoji: { fontSize: 16, width: 22, textAlign: "center" },
  infoText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  section: { width: "100%", alignItems: "center", gap: 14 },
  chooseTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", textAlign: "center", marginBottom: 4 },
  optionCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  optionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  optionEmoji: { fontSize: 22 },
  optionText: { flex: 1, gap: 3 },
  optionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  optionSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  stepTitle: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  stepSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 300, lineHeight: 20 },
  nameInput: {
    width: "100%", paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 14, borderWidth: 1,
    fontSize: 17, fontFamily: "Inter_400Regular", textAlign: "center",
  },
  btn: { width: "100%", paddingVertical: 15, borderRadius: 14, alignItems: "center" },
  btnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  backLink: { paddingVertical: 4 },
  backLinkText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
