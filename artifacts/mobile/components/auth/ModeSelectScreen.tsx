import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const logo = require("@/assets/images/logo.png") as number;

export function ModeSelectScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setAppMode } = useAuth();

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.content, { paddingTop: topPad + 40 }]}>
        <Image source={logo} style={styles.brandLogo} resizeMode="contain" />
        <Text style={[styles.title, { color: colors.foreground }]}>Let's Roll</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          How are you using this app?
        </Text>

        <View style={styles.cards}>
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setAppMode("instructor")}
            activeOpacity={0.8}
          >
            <View style={[styles.cardIcon, { backgroundColor: colors.primary + "18" }]}>
              <Feather name="award" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              I'm an Instructor
            </Text>
            <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
              Manage your schedule, services, and availability. Accept bookings from clients.
            </Text>
            <View style={[styles.cardCta, { backgroundColor: colors.primary }]}>
              <Text style={styles.cardCtaText}>Set Up as Instructor</Text>
              <Feather name="arrow-right" size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setAppMode("client")}
            activeOpacity={0.8}
          >
            <View style={[styles.cardIcon, { backgroundColor: colors.accent + "22" }]}>
              <Feather name="calendar" size={28} color={colors.accent} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Book a Session
            </Text>
            <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
              Enter your instructor's booking code to browse availability and book a session.
            </Text>
            <View style={[styles.cardCta, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]}>
              <Text style={[styles.cardCtaText, { color: colors.foreground }]}>Book as Client</Text>
              <Feather name="arrow-right" size={16} color={colors.foreground} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 16,
  },
  brandLogo: { width: 180, height: 180 },
  title: { fontSize: 32, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center" },
  cards: { width: "100%", gap: 14, marginTop: 8 },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  cardDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  cardCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  cardCtaText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
});
