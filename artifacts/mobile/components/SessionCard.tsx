import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Session } from "@/context/SchedulerContext";
import { useColors } from "@/hooks/useColors";
import { getApiBaseUrl } from "@/utils/apiClient";
import { StatusBadge } from "./StatusBadge";

function PaymentBadge({ status }: { status?: string }) {
  if (!status) return null;
  const isPaid = status === "paid";
  return (
    <View style={[payStyles.badge, { backgroundColor: isPaid ? "#34C75918" : "#FF950018" }]}>
      <View style={[payStyles.dot, { backgroundColor: isPaid ? "#34C759" : "#FF9500" }]} />
      <Text style={[payStyles.text, { color: isPaid ? "#34C759" : "#FF9500" }]}>
        {isPaid ? "Paid" : "Unpaid"}
      </Text>
    </View>
  );
}

function WaiverBadge({ waiverId }: { waiverId?: number | null }) {
  if (!waiverId) return null;
  return (
    <View style={[payStyles.badge, { backgroundColor: "#34C75918" }]}>
      <Feather name="file-text" size={9} color="#34C759" />
      <Text style={[payStyles.text, { color: "#34C759" }]}>Waiver</Text>
    </View>
  );
}

function ClientBookedBadge() {
  return (
    <View style={[payStyles.badge, { backgroundColor: "#0EA5E918" }]}>
      <Feather name="globe" size={9} color="#0EA5E9" />
      <Text style={[payStyles.text, { color: "#0EA5E9" }]}>Client booked</Text>
    </View>
  );
}

const payStyles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
});

interface Props {
  session: Session;
  isSaving?: boolean;
}

function formatTime12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.getTime() === today.getTime()) return "Today";
  if (date.getTime() === tomorrow.getTime()) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

const AVATAR_COLORS = [
  "#f97316", "#7C3AED", "#0EA5E9", "#10B981", "#F59E0B",
  "#EF4444", "#8B5CF6", "#06B6D4", "#059669", "#D97706",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function SessionCard({ session, isSaving = false }: Props) {
  const colors = useColors();
  const router = useRouter();
  const initial = session.clientName.charAt(0).toUpperCase();
  const bg = avatarColor(session.clientName);
  const [copied, setCopied] = useState(false);
  const longPressedRef = useRef(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  async function handleLongPress() {
    if (!session.cancellationToken) return;
    longPressedRef.current = true;
    const base = getApiBaseUrl();
    const url = `${base}/book/booking/${session.cancellationToken}`;
    await Clipboard.setStringAsync(url);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => {
      setCopied(false);
      copyTimeoutRef.current = null;
    }, 2000);
  }

  function handlePress() {
    if (longPressedRef.current) {
      longPressedRef.current = false;
      return;
    }
    router.push(`/session/${session.id}`);
  }

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: copied ? "#34C75910" : colors.card,
          borderColor: copied ? "#34C759" : colors.border,
        },
      ]}
      onPress={handlePress}
      onLongPress={session.cancellationToken ? handleLongPress : undefined}
      delayLongPress={400}
      activeOpacity={0.65}
    >
      <View style={[styles.avatar, { backgroundColor: bg + "28" }]}>
        <Text style={[styles.avatarText, { color: bg }]}>{initial}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {session.clientName}
          </Text>
          {isSaving ? (
            <View style={styles.savingBadge}>
              <ActivityIndicator size="small" color={colors.mutedForeground} style={styles.savingSpinner} />
              <Text style={[styles.savingText, { color: colors.mutedForeground }]}>Saving</Text>
            </View>
          ) : copied ? (
            <View style={styles.copiedBadge}>
              <Feather name="check" size={11} color="#34C759" />
              <Text style={styles.copiedText}>Link copied!</Text>
            </View>
          ) : (
            <StatusBadge status={session.status} small />
          )}
        </View>
        {session.isClientBooked ? (
          <Text style={[styles.contactLine, { color: colors.mutedForeground }]} numberOfLines={1}>
            {[session.clientEmail, session.clientPhone].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {formatDateShort(session.date)}
          </Text>
          <Text style={[styles.metaDot, { color: colors.border }]}>·</Text>
          <Feather name="clock" size={11} color={colors.mutedForeground} />
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {formatTime12(session.startTime)} – {formatTime12(session.endTime)}
          </Text>
        </View>
        <View style={styles.badgesRow}>
          {session.isClientBooked ? <ClientBookedBadge /> : null}
          {session.rescheduledFrom ? (
            <View style={styles.reschedRow}>
              <Feather name="refresh-cw" size={10} color={colors.mutedForeground} />
              <Text style={[styles.reschedText, { color: colors.mutedForeground }]}>Rescheduled</Text>
            </View>
          ) : null}
          <PaymentBadge status={session.paymentStatus} />
          <WaiverBadge waiverId={session.waiverId} />
        </View>
      </View>

      <Feather name="chevron-right" size={15} color={colors.border} style={styles.chevron} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  body: { flex: 1, gap: 3 },
  contactLine: { fontSize: 11, fontFamily: "Inter_400Regular" },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold", flex: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  metaDot: { fontSize: 12, lineHeight: 16 },
  badgesRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 1 },
  reschedRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  reschedText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  chevron: { flexShrink: 0 },
  savingBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  savingSpinner: { transform: [{ scale: 0.6 }] },
  savingText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  copiedBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: "#34C75918" },
  copiedText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#34C759" },
});
