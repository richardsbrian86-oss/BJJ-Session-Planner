import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

interface Props {
  visible: boolean;
  onClose: () => void;
  slug: string;
  instructorName: string;
}

function getBookingUrl(slug: string): string {
  const domain =
    typeof process !== "undefined"
      ? (process.env.EXPO_PUBLIC_DOMAIN ?? "")
      : "";
  if (domain) return `https://${domain}/book/${slug}`;
  return `https://your-app.replit.app/book/${slug}`;
}

export function ShareModal({ visible, onClose, slug, instructorName }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);

  const bookingUrl = getBookingUrl(slug);

  async function handleCopy() {
    try {
      await Clipboard.setStringAsync(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      Alert.alert("Could not copy", bookingUrl);
    }
  }

  async function handleShare() {
    try {
      await Share.share({
        message: `Book a session with ${instructorName}: ${bookingUrl}`,
        url: bookingUrl,
        title: `Book with ${instructorName}`,
      });
    } catch {
      await handleCopy();
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + 24,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <Text style={[styles.title, { color: colors.foreground }]}>Share Booking Link</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Send this to clients so they can book sessions with you
          </Text>

          <View style={[styles.qrContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <QRCode
              value={bookingUrl}
              size={180}
              backgroundColor="transparent"
              color={colors.foreground}
            />
          </View>

          <View style={[styles.urlBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text
              style={[styles.urlText, { color: colors.mutedForeground }]}
              numberOfLines={2}
              selectable
            >
              {bookingUrl}
            </Text>
          </View>

          <View style={[styles.codeRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Text style={[styles.codeLabel, { color: colors.mutedForeground }]}>Your code:</Text>
            <Text style={[styles.codeValue, { color: colors.foreground }]}>{slug}</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: copied ? "#34C759" : colors.secondary, borderColor: colors.border }]}
              onPress={handleCopy}
              activeOpacity={0.8}
            >
              <Feather name={copied ? "check" : "copy"} size={18} color={copied ? "#FFFFFF" : colors.foreground} />
              <Text style={[styles.btnText, { color: copied ? "#FFFFFF" : colors.foreground }]}>
                {copied ? "Copied!" : "Copy Link"}
              </Text>
            </TouchableOpacity>

            {Platform.OS !== "web" && (
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={handleShare}
                activeOpacity={0.8}
              >
                <Feather name="share-2" size={18} color="#FFFFFF" />
                <Text style={[styles.btnText, { color: "#FFFFFF" }]}>Share</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={[styles.closeBtnText, { color: colors.mutedForeground }]}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingTop: 14,
    gap: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  qrContainer: {
    alignSelf: "center",
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  urlBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  urlText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  codeLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  codeValue: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  actions: { flexDirection: "row", gap: 10 },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  btnPrimary: { backgroundColor: "#007AFF", borderColor: "#007AFF" },
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  closeBtn: { alignItems: "center", paddingVertical: 4 },
  closeBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
