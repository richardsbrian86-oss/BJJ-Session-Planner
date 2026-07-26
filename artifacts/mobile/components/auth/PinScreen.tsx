import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PinPad } from "@/components/PinPad";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export function PinScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    instructorName,
    instructorEmail,
    verifyPin,
    storedPinLength,
    switchToEmailLogin,
    resetAccount,
  } = useAuth();

  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function handlePin(pin: string) {
    const result = await verifyPin(pin);
    if (result.ok) {
      setStatusMessage(null);
      return;
    }
    if (result.reason === "rate_limited") {
      setStatusMessage("Too many attempts — please wait a few minutes");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (result.reason === "blocked") {
      setStatusMessage("Temporarily blocked — please try again later");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      setStatusMessage(null);
      setAttempts((a) => a + 1);
      setError(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  function handleForgotPin() {
    if (instructorEmail) {
      Alert.alert(
        "Forgot PIN?",
        "You can sign in with your email and password instead, or reset the app to start fresh.",
        [
          {
            text: "Sign in with email",
            onPress: () => switchToEmailLogin(),
          },
          {
            text: "Reset app data",
            style: "destructive",
            onPress: confirmReset,
          },
          { text: "Cancel", style: "cancel" },
        ]
      );
    } else {
      Alert.alert(
        "Forgot PIN?",
        "If you've forgotten your PIN, you can reset the app. This will remove all data from this device — your sessions stored in the cloud will still be available after you sign in again.",
        [
          {
            text: "Reset app data",
            style: "destructive",
            onPress: confirmReset,
          },
          { text: "Cancel", style: "cancel" },
        ]
      );
    }
  }

  function confirmReset() {
    Alert.alert(
      "Reset app data?",
      "All local data will be removed from this device. If your account is synced to the cloud, you can sign back in to recover it.",
      [
        {
          text: "Reset",
          style: "destructive",
          onPress: () => resetAccount(),
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  }

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + 24;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 20, paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={[styles.avatarWrap, { backgroundColor: colors.primary + "18" }]}>
          <Text style={[styles.avatarLetter, { color: colors.primary }]}>
            {instructorName.charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Greeting */}
        <View style={styles.greetingWrap}>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Welcome back</Text>
          <Text style={[styles.name, { color: colors.foreground }]}>{instructorName}</Text>
        </View>

        {/* PIN pad — use stored PIN length so both legacy 4-digit and new
            6-digit users can enter their PIN correctly on the lock screen. */}
        <PinPad
          pinLength={storedPinLength ?? 6}
          onComplete={handlePin}
          error={error}
          onErrorClear={() => { setError(false); setStatusMessage(null); }}
          subtitle={
            statusMessage
              ? statusMessage
              : attempts > 0
              ? `Incorrect PIN · ${attempts} attempt${attempts !== 1 ? "s" : ""}`
              : "Enter your PIN to continue"
          }
        />

        {/* Forgot PIN */}
        <TouchableOpacity onPress={handleForgotPin} style={styles.forgotBtn} activeOpacity={0.7}>
          <Feather name="help-circle" size={13} color={colors.mutedForeground} />
          <Text style={[styles.forgotText, { color: colors.mutedForeground }]}>
            Forgot PIN?
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 32,
    alignItems: "center",
    gap: 24,
    flexGrow: 1,
    justifyContent: "center",
  },
  avatarWrap: {
    width: 74, height: 74, borderRadius: 37,
    alignItems: "center", justifyContent: "center",
  },
  avatarLetter: { fontSize: 32, fontFamily: "Inter_700Bold" },
  greetingWrap: { alignItems: "center", gap: 3 },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular" },
  name: { fontSize: 24, fontFamily: "Inter_700Bold" },
  forgotBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  forgotText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
