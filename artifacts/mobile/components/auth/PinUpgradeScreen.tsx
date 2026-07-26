import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PinPad } from "@/components/PinPad";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

type UpgradeStep = "new" | "confirm";

export function PinUpgradeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { upgradePin } = useAuth();

  const [step, setStep] = useState<UpgradeStep>("new");
  const [firstPin, setFirstPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [saving, setSaving] = useState(false);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + 32;

  function handleNewPin(pin: string) {
    setFirstPin(pin);
    Haptics.selectionAsync();
    setStep("confirm");
  }

  async function handleConfirm(pin: string) {
    if (pin !== firstPin) {
      setPinError(true);
      return;
    }
    setSaving(true);
    try {
      await upgradePin(pin);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setPinError(true);
    } finally {
      setSaving(false);
    }
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
        <View style={styles.brand}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + "20" }]}>
            <Text style={styles.icon}>🔒</Text>
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Security upgrade</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            Your PIN must be updated to at least 6 digits to meet current security requirements.
          </Text>
        </View>

        {step === "new" && (
          <View style={styles.section}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>Create a new PIN</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              Choose 6 or more digits.
            </Text>
            <PinPad pinLength={6} onComplete={handleNewPin} />
          </View>
        )}

        {step === "confirm" && (
          <View style={styles.section}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>Confirm your PIN</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              Enter the same PIN again.
            </Text>
            <PinPad
              pinLength={6}
              onComplete={handleConfirm}
              error={pinError}
              onErrorClear={() => setPinError(false)}
              subtitle={saving ? "Saving…" : pinError ? "PINs didn't match — try again." : undefined}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 28, alignItems: "center", gap: 32 },
  brand: { alignItems: "center", gap: 12 },
  iconWrap: { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 36 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  sub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 300 },
  section: { width: "100%", alignItems: "center", gap: 14 },
  stepTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  stepSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 280 },
});
