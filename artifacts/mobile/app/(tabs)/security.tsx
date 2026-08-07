import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { api } from "@/utils/apiClient";

const DISMISSED_STORAGE_KEY = "security_dismissed_events";

interface SecurityEvent {
  ip: string;
  count: number;
  windowStart: number;
  alerted: boolean;
  alertedAt: number | null;
}

interface CrossAccountEvent {
  slug: string;
  ip: string;
  count: number;
  windowStart: number;
  alerted: boolean;
  alertedAt: number | null;
}

interface FailureHistoryEntry {
  ip: string;
  count: number;
  windowStart: number;
  windowEnd: number;
  alerted: boolean;
  alertedAt: number | null;
}

interface CrossAccountHistoryEntry {
  id: number;
  ip: string;
  firstSeen: number;
  lastSeen: number;
  totalFailures: number;
  affectedSlugs: number;
  archivedAt: number;
}

function maskIp(ip: string): string {
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  if (ip.includes(":")) {
    const segments = ip.split(":");
    return segments.slice(0, 3).join(":") + ":…";
  }
  return ip;
}

function formatTimeAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin === 1) return "1 min ago";
  if (diffMin < 60) return `${diffMin} mins ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr === 1) return "1 hr ago";
  return `${diffHr} hrs ago`;
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(startMs: number, endMs: number): string {
  const diffMs = endMs - startMs;
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "< 1 min";
  if (diffMin === 1) return "1 min";
  if (diffMin < 60) return `${diffMin} mins`;
  const diffHr = Math.floor(diffMin / 60);
  const remMin = diffMin % 60;
  if (remMin === 0) return `${diffHr} hr${diffHr === 1 ? "" : "s"}`;
  return `${diffHr} hr ${remMin} min`;
}

export default function SecurityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [alertThreshold, setAlertThreshold] = useState(5);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [failureHistory, setFailureHistory] = useState<FailureHistoryEntry[]>([]);
  const [failureHistoryExpanded, setFailureHistoryExpanded] = useState(false);

  const [crossAccountEvents, setCrossAccountEvents] = useState<CrossAccountEvent[]>([]);
  const [crossAccountExpanded, setCrossAccountExpanded] = useState(false);
  const [crossAccountHistory, setCrossAccountHistory] = useState<CrossAccountHistoryEntry[]>([]);
  const [crossAccountHistoryExpanded, setCrossAccountHistoryExpanded] = useState(false);

  // dismissedMap: { [ip]: windowStartAtDismissal }
  // An event is dismissed only while event.windowStart <= stored windowStart.
  // When the server's detection window rolls over, windowStart changes and the
  // event reappears automatically — regardless of the new attempt count.
  const [dismissedMap, setDismissedMap] = useState<Record<string, number>>({});

  const [changePinVisible, setChangePinVisible] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinSuccess, setPinSuccess] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 82 : insets.bottom + 20;

  async function loadDismissed() {
    try {
      const raw = await AsyncStorage.getItem(DISMISSED_STORAGE_KEY);
      if (raw) {
        setDismissedMap(JSON.parse(raw));
      }
    } catch {
      // ignore; start with empty dismissed state
    }
  }

  async function saveDismissed(updated: Record<string, number>) {
    try {
      await AsyncStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore storage errors
    }
  }

  function isEventDismissed(event: SecurityEvent): boolean {
    const dismissedWindowStart = dismissedMap[event.ip];
    // Dismissed while the event belongs to the same detection window.
    // A new windowStart means the server rolled to a fresh window, so the
    // event is no longer suppressed even if the count is low.
    return dismissedWindowStart !== undefined && event.windowStart <= dismissedWindowStart;
  }

  async function dismissEvent(ip: string, windowStart: number) {
    setDismissedMap((prev) => {
      const updated = { ...prev, [ip]: windowStart };
      saveDismissed(updated);
      return updated;
    });
  }

  async function loadEvents(isRefresh = false) {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const [data, crossData, crossHistData] = await Promise.all([
        api.security.getEvents(),
        api.security.getCrossAccountEvents(),
        api.security.getCrossAccountHistory(),
      ]);
      setAlertThreshold(data.alertThreshold);
      setEvents(data.events.sort((a, b) => b.count - a.count));
      const sorted = (data.history ?? []).slice().sort((a, b) => b.windowEnd - a.windowEnd);
      setFailureHistory(sorted);
      setCrossAccountEvents((crossData.events ?? []).slice().sort((a, b) => b.count - a.count));
      setCrossAccountHistory(crossHistData.history ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load security events");
    } finally {
      setLoading(false);
    }
  }

  async function loadAll(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    await loadEvents(isRefresh);
    setRefreshing(false);
  }

  useFocusEffect(
    useCallback(() => {
      loadDismissed();
      loadAll();
    }, [])
  );

  async function handleChangePin() {
    setPinError(null);
    if (!currentPin.trim()) { setPinError("Current PIN is required"); return; }
    if (!/^\d{6,}$/.test(newPin)) { setPinError("New PIN must be at least 6 numeric digits"); return; }
    if (newPin !== confirmPin) { setPinError("PINs do not match"); return; }
    setPinLoading(true);
    try {
      await api.instructor.changePin({ currentPin: currentPin.trim(), newPin });
      setPinSuccess(true);
      setCurrentPin(""); setNewPin(""); setConfirmPin("");
      setTimeout(() => { setPinSuccess(false); setChangePinVisible(false); }, 1500);
    } catch (e) {
      setPinError(e instanceof Error ? e.message : "Failed to update PIN");
    } finally {
      setPinLoading(false);
    }
  }

  function openChangePinModal() {
    setCurrentPin(""); setNewPin(""); setConfirmPin("");
    setPinError(null); setPinSuccess(false);
    setChangePinVisible(true);
  }

  const visibleEvents = events.filter((e) => !isEventDismissed(e));
  const highRiskEvents = visibleEvents.filter((e) => e.count >= alertThreshold);
  const dismissedCount = events.length - visibleEvents.length;
  const crossAccountIpCount = new Set(crossAccountEvents.map((e) => e.ip)).size;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: topPad + 12,
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    headerTitle: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.text,
    },
    summaryCard: {
      margin: 16,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
    },
    summaryTitle: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      marginBottom: 4,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    summaryCount: {
      fontSize: 36,
      fontFamily: "Inter_700Bold",
    },
    summarySubtitle: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
    sectionLabel: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    eventCard: {
      marginHorizontal: 16,
      marginBottom: 10,
      borderRadius: 10,
      padding: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    eventRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    ipRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
    },
    ipText: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.text,
    },
    countBadge: {
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 3,
      alignItems: "center",
      justifyContent: "center",
    },
    countText: {
      fontSize: 13,
      fontFamily: "Inter_700Bold",
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 6,
    },
    metaText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    alertedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
    },
    alertedText: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingBottom: 60,
      gap: 12,
    },
    emptyTitle: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.text,
    },
    emptySubtitle: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      textAlign: "center",
      paddingHorizontal: 40,
    },
    errorText: {
      color: colors.destructive ?? "#ef4444",
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      padding: 20,
    },
    retryButton: {
      alignSelf: "center",
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    retryText: {
      color: "#fff",
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
    },
    windowNote: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      textAlign: "center",
      paddingHorizontal: 20,
      paddingBottom: bottomPad + 8,
      paddingTop: 8,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 16,
    },
    dismissButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 7,
      backgroundColor: colors.border,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dismissText: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
    },
    historyToggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    historyToggleLabel: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    historyToggleRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    historyToggleCount: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    historyCard: {
      marginHorizontal: 16,
      marginBottom: 8,
      borderRadius: 10,
      padding: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    historyIpRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    historyIpText: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: colors.text,
    },
    historyMeta: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 4,
    },
    historyEmptyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    historyEmptyText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    timelineCard: {
      marginHorizontal: 16,
      marginBottom: 8,
      borderRadius: 10,
      padding: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    timelineRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    timelineIpText: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: colors.text,
      flex: 1,
    },
    timelineBadge: {
      borderRadius: 20,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    timelineBadgeText: {
      fontSize: 12,
      fontFamily: "Inter_700Bold",
    },
    timelineMeta: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 4,
    },
    timelineEmptyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    timelineEmptyText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    repeatBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: "#f97316" + "20",
    },
    repeatBadgeText: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      color: "#f97316",
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginBottom: 10,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      borderRadius: 9,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 9,
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
    searchClearBtn: {
      padding: 8,
      borderRadius: 8,
    },
    crossAccountBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 8,
      alignSelf: "flex-start",
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 7,
      backgroundColor: "#f59e0b" + "20",
    },
    crossAccountBadgeText: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: "#f59e0b",
    },
    changePinCard: {
      margin: 16,
      marginBottom: 12,
      borderRadius: 14,
      borderWidth: 1,
      padding: 14,
    },
    changePinRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    changePinIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    changePinBody: {
      flex: 1,
    },
    changePinTitle: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
    },
    changePinSubtitle: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      marginTop: 1,
    },
    modalContainer: {
      flex: 1,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 20,
      paddingTop: 24,
      borderBottomWidth: 1,
    },
    modalTitle: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
    },
    modalContent: {
      padding: 20,
      gap: 20,
    },
    pinField: {
      gap: 6,
    },
    pinLabel: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    pinInput: {
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 13,
      fontSize: 16,
      fontFamily: "Inter_400Regular",
    },
    pinErrorBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
    },
    pinErrorText: {
      color: "#ef4444",
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      flex: 1,
    },
    pinSubmitBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 15,
      borderRadius: 12,
      marginTop: 8,
    },
    pinSubmitText: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: "#ffffff",
    },
    pinSuccessWrap: {
      alignItems: "center",
      paddingTop: 60,
      gap: 16,
    },
    pinSuccessText: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
    },
  });

  const isHighRisk = (e: SecurityEvent) => e.count >= alertThreshold;

  const renderEvent = ({ item }: { item: SecurityEvent }) => {
    const high = isHighRisk(item);
    const badgeBg = high ? "#ef444420" : colors.border;
    const badgeColor = high ? "#ef4444" : colors.mutedForeground;

    return (
      <View style={styles.eventCard}>
        <View style={styles.eventRow}>
          <View style={styles.ipRow}>
            <Feather
              name={high ? "alert-triangle" : "activity"}
              size={16}
              color={high ? "#ef4444" : colors.mutedForeground}
            />
            <Text style={styles.ipText}>{maskIp(item.ip)}</Text>
          </View>
          <View style={[styles.countBadge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.countText, { color: badgeColor }]}>
              {item.count} {item.count === 1 ? "attempt" : "attempts"}
            </Text>
          </View>
        </View>
        <View style={[styles.metaRow, { justifyContent: "space-between" }]}>
          <View style={[styles.metaRow, { marginTop: 0 }]}>
            <Feather name="clock" size={12} color={colors.mutedForeground} />
            <Text style={styles.metaText}>{formatTimeAgo(item.windowStart)}</Text>
            {item.alerted && (
              <View style={[styles.alertedBadge, { backgroundColor: "#f59e0b20" }]}>
                <Feather name="mail" size={10} color="#f59e0b" />
                <Text style={[styles.alertedText, { color: "#f59e0b" }]}>
                  {item.alertedAt != null
                    ? `Alert sent ${formatTimeAgo(item.alertedAt)}`
                    : "Alert sent"}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={() => dismissEvent(item.ip, item.windowStart)}
            activeOpacity={0.7}
          >
            <Feather name="check" size={12} color={colors.mutedForeground} />
            <Text style={styles.dismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const hasAlert = highRiskEvents.length > 0;
  const summaryCardBg = hasAlert ? "#ef444410" : "#22c55e10";
  const summaryCardBorder = hasAlert ? "#ef444430" : "#22c55e30";
  const summaryTitleColor = hasAlert ? "#ef4444" : "#22c55e";
  const summaryCountColor = hasAlert ? "#ef4444" : "#22c55e";

  const crossAccountSection = crossAccountEvents.length > 0 ? (
    <>
      <View style={styles.divider} />
      <TouchableOpacity
        style={styles.historyToggle}
        onPress={() => setCrossAccountExpanded((v) => !v)}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Feather name="globe" size={14} color="#f59e0b" />
          <Text style={[styles.historyToggleLabel, { color: "#f59e0b" }]}>
            Cross-account threats
          </Text>
        </View>
        <View style={styles.historyToggleRight}>
          <Text style={styles.historyToggleCount}>
            {crossAccountEvents.length} {crossAccountEvents.length === 1 ? "IP" : "IPs"}
          </Text>
          <Feather
            name={crossAccountExpanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.mutedForeground}
          />
        </View>
      </TouchableOpacity>

      {crossAccountExpanded && (
        crossAccountEvents.map((item, idx) => {
          const high = item.count >= alertThreshold;
          const badgeBg = high ? "#ef444420" : colors.border;
          const badgeColor = high ? "#ef4444" : colors.mutedForeground;
          return (
            <View
              key={`${item.ip}-${item.slug}-${idx}`}
              style={[styles.eventCard, { borderColor: "#f59e0b30" }]}
            >
              <View style={styles.eventRow}>
                <View style={styles.ipRow}>
                  <Feather
                    name={high ? "alert-triangle" : "activity"}
                    size={16}
                    color={high ? "#ef4444" : colors.mutedForeground}
                  />
                  <Text style={styles.ipText}>{maskIp(item.ip)}</Text>
                </View>
                <View style={[styles.countBadge, { backgroundColor: badgeBg }]}>
                  <Text style={[styles.countText, { color: badgeColor }]}>
                    {item.count} {item.count === 1 ? "attempt" : "attempts"}
                  </Text>
                </View>
              </View>
              <View style={[styles.metaRow]}>
                <Feather name="user" size={12} color="#f59e0b" />
                <Text style={[styles.metaText, { color: "#f59e0b" }]}>
                  Targeting @{item.slug}
                </Text>
                <Feather name="clock" size={12} color={colors.mutedForeground} />
                <Text style={styles.metaText}>{formatTimeAgo(item.windowStart)}</Text>
                {item.alerted && (
                  <View style={[styles.alertedBadge, { backgroundColor: "#f59e0b20" }]}>
                    <Feather name="mail" size={10} color="#f59e0b" />
                    <Text style={[styles.alertedText, { color: "#f59e0b" }]}>
                      {item.alertedAt != null
                        ? `Alert sent ${formatTimeAgo(item.alertedAt)}`
                        : "Alert sent"}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        })
      )}
    </>
  ) : null;

  const failureHistorySection = (
    <>
      <View style={styles.divider} />
      <TouchableOpacity
        style={styles.historyToggle}
        onPress={() => setFailureHistoryExpanded((v) => !v)}
        activeOpacity={0.7}
      >
        <Text style={styles.historyToggleLabel}>Attack Timeline (last 24h)</Text>
        <View style={styles.historyToggleRight}>
          {failureHistory.length > 0 && (
            <Text style={styles.historyToggleCount}>
              {failureHistory.length} past {failureHistory.length === 1 ? "burst" : "bursts"}
            </Text>
          )}
          <Feather
            name={failureHistoryExpanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.mutedForeground}
          />
        </View>
      </TouchableOpacity>

      {failureHistoryExpanded && (
        failureHistory.length === 0 ? (
          <View style={styles.timelineEmptyRow}>
            <Feather name="shield" size={14} color={colors.mutedForeground} />
            <Text style={styles.timelineEmptyText}>No completed attack bursts in the last 24 hours</Text>
          </View>
        ) : (
          failureHistory.map((entry, idx) => {
            const high = entry.count >= alertThreshold;
            const badgeBg = high ? "#ef444420" : colors.border;
            const badgeColor = high ? "#ef4444" : colors.mutedForeground;
            return (
              <View key={`${entry.ip}-${entry.windowStart}-${idx}`} style={styles.timelineCard}>
                <View style={styles.timelineRow}>
                  <Feather
                    name={high ? "alert-triangle" : "activity"}
                    size={14}
                    color={high ? "#ef4444" : colors.mutedForeground}
                  />
                  <Text style={styles.timelineIpText}>{maskIp(entry.ip)}</Text>
                  <View style={[styles.timelineBadge, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.timelineBadgeText, { color: badgeColor }]}>
                      {entry.count} {entry.count === 1 ? "attempt" : "attempts"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.timelineMeta}>
                  {formatTimestamp(entry.windowStart)}
                  {"  ·  "}
                  {formatDuration(entry.windowStart, entry.windowEnd)} window
                  {"  ·  "}
                  {formatTimeAgo(entry.windowEnd)}
                </Text>
                {entry.alerted && (
                  <View style={[styles.metaRow, { marginTop: 4 }]}>
                    <View style={[styles.alertedBadge, { backgroundColor: "#f59e0b20" }]}>
                      <Feather name="mail" size={10} color="#f59e0b" />
                      <Text style={[styles.alertedText, { color: "#f59e0b" }]}>
                        {entry.alertedAt != null
                          ? `Alert sent ${formatTimeAgo(entry.alertedAt)}`
                          : "Alert sent"}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )
      )}
    </>
  );


  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Feather name="shield" size={22} color={colors.primary} />
          <Text style={styles.headerTitle}>Security</Text>
        </View>
      </View>

      <FlatList
        data={visibleEvents}
        keyExtractor={(item) => item.ip}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadAll(true)}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <>
            <TouchableOpacity
              style={[styles.changePinCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={openChangePinModal}
              activeOpacity={0.7}
            >
              <View style={styles.changePinRow}>
                <View style={[styles.changePinIconWrap, { backgroundColor: colors.primary + "20" }]}>
                  <Feather name="lock" size={18} color={colors.primary} />
                </View>
                <View style={styles.changePinBody}>
                  <Text style={[styles.changePinTitle, { color: colors.text }]}>Change PIN</Text>
                  <Text style={[styles.changePinSubtitle, { color: colors.mutedForeground }]}>Update your login PIN</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </View>
            </TouchableOpacity>

            <View
              style={[
                styles.summaryCard,
                { backgroundColor: summaryCardBg, borderColor: summaryCardBorder },
              ]}
            >
              <Text style={[styles.summaryTitle, { color: summaryTitleColor }]}>
                {hasAlert ? "⚠ Suspicious Activity" : "All Clear"}
              </Text>
              <Text style={[styles.summaryCount, { color: summaryCountColor }]}>
                {highRiskEvents.length}
              </Text>
              <Text style={[styles.summarySubtitle, { color: summaryTitleColor }]}>
                {highRiskEvents.length === 1
                  ? "IP has exceeded the alert threshold"
                  : "IPs have exceeded the alert threshold"}
              </Text>
              {crossAccountIpCount > 0 && (
                <View style={styles.crossAccountBadge}>
                  <Feather name="globe" size={11} color="#f59e0b" />
                  <Text style={styles.crossAccountBadgeText}>
                    +{crossAccountIpCount} cross-account {crossAccountIpCount === 1 ? "IP" : "IPs"}
                  </Text>
                </View>
              )}
            </View>

            {error && (
              <>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => loadEvents()}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </>
            )}

            {!error && visibleEvents.length > 0 && (
              <Text style={styles.sectionLabel}>
                Recent failed attempts ({visibleEvents.length}
                {dismissedCount > 0 ? `, ${dismissedCount} dismissed` : ""})
              </Text>
            )}
          </>
        }
        renderItem={renderEvent}
        ListEmptyComponent={
          !error ? (
            <View style={styles.emptyContainer}>
              <Feather name="shield" size={48} color={colors.mutedForeground} />
              <Text style={styles.emptyTitle}>No suspicious activity</Text>
              <Text style={styles.emptySubtitle}>
                {dismissedCount > 0
                  ? `${dismissedCount} dismissed event${dismissedCount === 1 ? "" : "s"} will reappear if new activity is detected.`
                  : "No failed login attempts in the current alert window."}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <>
            {crossAccountSection}
            {crossAccountHistory.length > 0 && (
              <>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.historyToggle}
                  onPress={() => setCrossAccountHistoryExpanded((v) => !v)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Feather name="archive" size={14} color="#f59e0b" />
                    <Text style={[styles.historyToggleLabel, { color: "#f59e0b" }]}>
                      Cross-account History
                    </Text>
                  </View>
                  <View style={styles.historyToggleRight}>
                    <Text style={styles.historyToggleCount}>
                      {crossAccountHistory.length} past {crossAccountHistory.length === 1 ? "burst" : "bursts"}
                    </Text>
                    <Feather
                      name={crossAccountHistoryExpanded ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={colors.mutedForeground}
                    />
                  </View>
                </TouchableOpacity>

                {crossAccountHistoryExpanded && crossAccountHistory.map((entry) => {
                  const high = entry.totalFailures >= alertThreshold;
                  const badgeBg = high ? "#ef444420" : colors.border;
                  const badgeColor = high ? "#ef4444" : colors.mutedForeground;
                  return (
                    <View key={entry.id} style={styles.timelineCard}>
                      <View style={styles.timelineRow}>
                        <Feather
                          name={high ? "alert-triangle" : "activity"}
                          size={14}
                          color={high ? "#ef4444" : "#f59e0b"}
                        />
                        <Text style={styles.timelineIpText}>{maskIp(entry.ip)}</Text>
                        <View style={[styles.timelineBadge, { backgroundColor: badgeBg }]}>
                          <Text style={[styles.timelineBadgeText, { color: badgeColor }]}>
                            {entry.totalFailures} {entry.totalFailures === 1 ? "attempt" : "attempts"}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.timelineMeta}>
                        {entry.affectedSlugs} {entry.affectedSlugs === 1 ? "account" : "accounts"} targeted
                        {"  ·  "}
                        {formatTimestamp(entry.firstSeen)}
                        {"  →  "}
                        {formatTimestamp(entry.lastSeen)}
                      </Text>
                      <Text style={[styles.timelineMeta, { marginTop: 2 }]}>
                        Archived {formatTimeAgo(entry.archivedAt)}
                      </Text>
                    </View>
                  );
                })}
              </>
            )}
            {failureHistorySection}
            {visibleEvents.length > 0 && (
              <Text style={[styles.windowNote, { paddingBottom: bottomPad + 8 }]}>
                Showing IPs active within the current detection window. Data clears automatically when the window expires.
              </Text>
            )}
            {visibleEvents.length === 0 && (
              <View style={{ paddingBottom: bottomPad }} />
            )}
          </>
        }
        contentContainerStyle={visibleEvents.length === 0 ? { flex: 1 } : { paddingBottom: bottomPad }}
      />

      <Modal
        visible={changePinVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setChangePinVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Change PIN</Text>
            <TouchableOpacity
              onPress={() => setChangePinVisible(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            {pinSuccess ? (
              <View style={styles.pinSuccessWrap}>
                <Feather name="check-circle" size={52} color="#22c55e" />
                <Text style={[styles.pinSuccessText, { color: colors.text }]}>PIN updated!</Text>
              </View>
            ) : (
              <>
                {pinError && (
                  <View style={[styles.pinErrorBanner, { backgroundColor: "#ef444415", borderColor: "#ef444440" }]}>
                    <Feather name="alert-circle" size={14} color="#ef4444" />
                    <Text style={styles.pinErrorText}>{pinError}</Text>
                  </View>
                )}
                <View style={styles.pinField}>
                  <Text style={[styles.pinLabel, { color: colors.mutedForeground }]}>Current PIN</Text>
                  <TextInput
                    style={[styles.pinInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                    value={currentPin}
                    onChangeText={setCurrentPin}
                    keyboardType="number-pad"
                    secureTextEntry
                    placeholder="Enter current PIN"
                    placeholderTextColor={colors.mutedForeground}
                    maxLength={20}
                  />
                </View>
                <View style={styles.pinField}>
                  <Text style={[styles.pinLabel, { color: colors.mutedForeground }]}>New PIN</Text>
                  <TextInput
                    style={[styles.pinInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                    value={newPin}
                    onChangeText={setNewPin}
                    keyboardType="number-pad"
                    secureTextEntry
                    placeholder="At least 6 digits"
                    placeholderTextColor={colors.mutedForeground}
                    maxLength={20}
                  />
                </View>
                <View style={styles.pinField}>
                  <Text style={[styles.pinLabel, { color: colors.mutedForeground }]}>Confirm new PIN</Text>
                  <TextInput
                    style={[styles.pinInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                    value={confirmPin}
                    onChangeText={setConfirmPin}
                    keyboardType="number-pad"
                    secureTextEntry
                    placeholder="Repeat new PIN"
                    placeholderTextColor={colors.mutedForeground}
                    maxLength={20}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.pinSubmitBtn, { backgroundColor: colors.primary, opacity: pinLoading ? 0.6 : 1 }]}
                  onPress={handleChangePin}
                  disabled={pinLoading}
                  activeOpacity={0.8}
                >
                  {pinLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Feather name="check" size={18} color="#ffffff" />
                  )}
                  <Text style={styles.pinSubmitText}>{pinLoading ? "Updating…" : "Update PIN"}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
