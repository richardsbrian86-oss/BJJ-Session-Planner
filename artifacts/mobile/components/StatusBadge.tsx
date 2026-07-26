import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { SessionStatus } from "@/context/SchedulerContext";

interface Props {
  status: SessionStatus;
  small?: boolean;
}

const STATUS_CONFIG: Record<SessionStatus, { label: string; bg: string; color: string }> = {
  pending:   { label: "Pending",   bg: "rgba(255,185,48,0.15)",  color: "#FFB930" },
  confirmed: { label: "Confirmed", bg: "rgba(52,199,89,0.15)",   color: "#34C759" },
  cancelled: { label: "Cancelled", bg: "rgba(255,69,58,0.15)",   color: "#FF453A" },
  completed: { label: "Completed", bg: "rgba(90,200,250,0.15)",  color: "#5AC8FA" },
};

export function StatusBadge({ status, small }: Props) {
  const cfg = STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }, small && styles.sm]}>
      <View style={[styles.dot, { backgroundColor: cfg.color }]} />
      <Text style={[styles.text, { color: cfg.color }, small && styles.smText]}>
        {cfg.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  sm: { paddingHorizontal: 8, paddingVertical: 3, gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  text: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.1 },
  smText: { fontSize: 11 },
});
