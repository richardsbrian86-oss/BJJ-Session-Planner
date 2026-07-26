import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

type EmailMode = "login" | "register";

interface Props {
  initialMode?: EmailMode;
  onBack: () => void;
}

export function EmailAuthScreen({ initialMode = "login", onBack }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setupInstructorEmail, loginWithEmail } = useAuth();

  const [mode, setMode] = useState<EmailMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  function validate(): string | null {
    if (mode === "register" && !name.trim()) return "Name is required";
    if (!email.trim()) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Enter a valid email address";
    if (!password) return "Password is required";
    if (password.length < 8) return "Password must be at least 8 characters";
    if (mode === "register" && password !== confirmPassword) return "Passwords don't match";
    return null;
  }

  async function handleSubmit() {
    const err = validate();
    if (err) {
      setError(err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (mode === "register") {
        await setupInstructorEmail(name.trim(), email.trim(), password);
      } else {
        await loginWithEmail(email.trim(), password);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setMode(mode === "login" ? "register" : "login");
    setError(null);
    setPassword("");
    setConfirmPassword("");
  }

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border },
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 16, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Feather name="arrow-left" size={18} color={colors.mutedForeground} />
          <Text style={[styles.backText, { color: colors.mutedForeground }]}>Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + "20" }]}>
            <Text style={styles.iconEmoji}>🥋</Text>
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {mode === "login" ? "Welcome back" : "Create account"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {mode === "login"
              ? "Sign in with your email and password"
              : "Set up your instructor account"}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {mode === "register" && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Full name</Text>
              <TextInput
                style={inputStyle}
                placeholder="e.g. Coach Alex"
                placeholderTextColor={colors.mutedForeground}
                value={name}
                onChangeText={(t) => { setName(t); setError(null); }}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Email</Text>
            <TextInput
              style={inputStyle}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(null); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Password</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={[inputStyle, styles.passwordInput]}
                placeholder={mode === "register" ? "Min. 8 characters" : "Your password"}
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={(t) => { setPassword(t); setError(null); }}
                secureTextEntry={!showPassword}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                returnKeyType={mode === "register" ? "next" : "done"}
                onSubmitEditing={mode === "login" ? handleSubmit : undefined}
              />
              <TouchableOpacity
                style={[styles.eyeBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => setShowPassword((v) => !v)}
                activeOpacity={0.7}
              >
                <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          {mode === "register" && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Confirm password</Text>
              <TextInput
                style={inputStyle}
                placeholder="Re-enter password"
                placeholderTextColor={colors.mutedForeground}
                value={confirmPassword}
                onChangeText={(t) => { setConfirmPassword(t); setError(null); }}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </View>
          )}

          {error && (
            <View style={[styles.errorBox, { backgroundColor: "#ef444420", borderColor: "#ef4444" }]}>
              <Feather name="alert-circle" size={14} color="#ef4444" />
              <Text style={[styles.errorText, { color: "#ef4444" }]}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitText}>
                {mode === "login" ? "Sign in" : "Create account"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={switchMode} style={styles.switchBtn} activeOpacity={0.7}>
            <Text style={[styles.switchText, { color: colors.mutedForeground }]}>
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>
                {mode === "login" ? "Sign up" : "Sign in"}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24, gap: 24 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  backText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  header: { alignItems: "center", gap: 10 },
  iconWrap: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  iconEmoji: { fontSize: 30 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", textAlign: "center" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 280 },
  form: { gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  passwordWrap: { flexDirection: "row", gap: 8 },
  passwordInput: { flex: 1 },
  eyeBtn: {
    width: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  submitBtn: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  submitText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  switchBtn: { alignItems: "center", paddingVertical: 4 },
  switchText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
