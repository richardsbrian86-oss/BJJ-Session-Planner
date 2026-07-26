import React, { useEffect, useMemo, useState } from "react";
import {
  Platform,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { EmptyState } from "@/components/EmptyState";
import { SessionCard } from "@/components/SessionCard";
import { ShareModal } from "@/components/ShareModal";
import { Session, useScheduler } from "@/context/SchedulerContext";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

type FilterKey = "upcoming" | "today" | "past" | "all";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "today", label: "Today" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
];

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatSectionTitle(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.getTime() === today.getTime()) return "Today";
  if (date.getTime() === tomorrow.getTime()) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function getTodayLabel(): string {
  const d = new Date();
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function StatCard({
  value,
  label,
  highlight,
  colors,
}: {
  value: number;
  label: string;
  highlight?: boolean;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: highlight ? colors.primary + "18" : colors.card,
          borderColor: highlight ? colors.primary + "40" : colors.border,
        },
      ]}
    >
      <Text style={[styles.statNum, { color: highlight ? colors.primary : colors.foreground }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { sessions, isOffline, syncWithBackend, pendingSessionIds, permanentlyFailedCount, clearPermanentlyFailed } = useScheduler();
  const { instructorName, instructorSlug, hasPendingMigration, retryMigration } = useAuth();
  const [filter, setFilter] = useState<FilterKey>("upcoming");
  const [refreshing, setRefreshing] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [migratingNow, setMigratingNow] = useState(false);
  const [migrationDismissed, setMigrationDismissed] = useState(false);
  const [showLongPressHint, setShowLongPressHint] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("@bjj_longpress_hint_seen").then((val) => {
      if (!val) setShowLongPressHint(true);
    });
  }, []);

  async function dismissLongPressHint() {
    setShowLongPressHint(false);
    await AsyncStorage.setItem("@bjj_longpress_hint_seen", "1");
  }

  async function handleRetryMigration() {
    setMigratingNow(true);
    await retryMigration();
    setMigratingNow(false);
  }

  const today = getTodayStr();

  useFocusEffect(
    React.useCallback(() => {
      syncWithBackend();
    }, [syncWithBackend])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await syncWithBackend();
    setRefreshing(false);
  }

  const filtered = useMemo(() => {
    return sessions
      .filter((s) => {
        if (filter === "today") return s.date === today;
        if (filter === "upcoming") return s.date >= today && s.status !== "cancelled";
        if (filter === "past")
          return s.date < today || s.status === "completed" || s.status === "cancelled";
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }, [sessions, filter, today]);

  const sections = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of filtered) {
      const arr = map.get(s.date) ?? [];
      arr.push(s);
      map.set(s.date, arr);
    }
    return Array.from(map.entries()).map(([date, data]) => ({ title: date, data }));
  }, [filtered]);

  const upcomingCount = sessions.filter((s) => s.date >= today && s.status !== "cancelled").length;
  const todayCount = sessions.filter((s) => s.date === today && s.status !== "cancelled").length;
  const pendingCount = sessions.filter((s) => s.status === "pending").length;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 82 : insets.bottom + 20;

  const Header = () => (
    <View style={[styles.headerWrap, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
      {isOffline && (
        <View style={[styles.offlineBanner, { backgroundColor: "#FF950018", borderColor: "#FF9500" }]}>
          <Feather name="wifi-off" size={13} color="#FF9500" />
          <Text style={styles.offlineText}>Offline — showing cached data</Text>
        </View>
      )}
      {!isOffline && permanentlyFailedCount > 0 && (
        <View style={[styles.syncBanner, { backgroundColor: "#FF3B3018", borderColor: "#FF3B30" }]}>
          <Feather name="alert-circle" size={13} color="#FF3B30" />
          <Text style={[styles.syncBannerText, { color: "#FF3B30" }]}>
            {permanentlyFailedCount === 1
              ? "1 change couldn't be saved — edit the session to retry"
              : `${permanentlyFailedCount} changes couldn't be saved — edit the sessions to retry`}
          </Text>
          <TouchableOpacity onPress={clearPermanentlyFailed} style={styles.syncBannerDismiss}>
            <Feather name="x" size={14} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      )}
      {!isOffline && permanentlyFailedCount === 0 && pendingSessionIds.size > 0 && (
        <View style={[styles.syncBanner, { backgroundColor: "#FF950018", borderColor: "#FF9500" }]}>
          <Feather name="upload-cloud" size={13} color="#FF9500" />
          <Text style={[styles.syncBannerText, { color: "#FF9500" }]}>
            {pendingSessionIds.size === 1
              ? "1 change waiting to sync…"
              : `${pendingSessionIds.size} changes waiting to sync…`}
          </Text>
        </View>
      )}
      {showLongPressHint && sessions.length > 0 && (
        <View style={[styles.hintBanner, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "40" }]}>
          <Feather name="link" size={13} color={colors.primary} />
          <Text style={[styles.hintText, { color: colors.foreground }]}>
            Long-press any session card to copy the client booking link
          </Text>
          <TouchableOpacity onPress={dismissLongPressHint} style={styles.hintDismiss}>
            <Feather name="x" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}
      {hasPendingMigration && !migrationDismissed && (
        <View style={[styles.migrationBanner, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "50" }]}>
          <Feather name="cloud-off" size={13} color={colors.primary} />
          <Text style={[styles.migrationText, { color: colors.foreground }]}>
            Cloud sync not enabled
          </Text>
          <TouchableOpacity onPress={handleRetryMigration} disabled={migratingNow} style={styles.migrationAction}>
            <Text style={[styles.migrationActionText, { color: colors.primary }]}>
              {migratingNow ? "Syncing…" : "Sync now"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMigrationDismissed(true)} style={styles.migrationDismiss}>
            <Feather name="x" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.headerTop}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{getGreeting()}</Text>
          <Text style={[styles.brandName, { color: colors.foreground }]}>Let's Roll</Text>
        </View>
        <View style={styles.headerActions}>
          {instructorSlug ? (
            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={() => setShowShare(true)}
              activeOpacity={0.75}
            >
              <Feather name="share-2" size={16} color={colors.foreground} />
            </TouchableOpacity>
          ) : null}
          <View style={[styles.dateBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Text style={[styles.dateBadgeText, { color: colors.mutedForeground }]}>{getTodayLabel()}</Text>
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatCard value={upcomingCount} label="Upcoming" highlight={upcomingCount > 0} colors={colors} />
        <StatCard value={todayCount} label="Today" highlight={todayCount > 0} colors={colors} />
        <StatCard value={pendingCount} label="Pending" colors={colors} />
      </View>
    </View>
  );

  const FilterRow = () => (
    <View style={[styles.filterWrap, { backgroundColor: colors.background }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.filterPill,
                {
                  backgroundColor: active ? colors.primary : colors.secondary,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.filterText,
                  {
                    color: active ? "#FFFFFF" : colors.mutedForeground,
                    fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium",
                  },
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {sections.length === 0 ? (
        <>
          <Header />
          <FilterRow />
          <EmptyState
            icon="calendar"
            title="No sessions"
            subtitle={
              filter === "upcoming"
                ? "Tap Book to schedule your first training session."
                : filter === "today"
                ? "Nothing scheduled for today."
                : "Nothing to show here."
            }
          />
        </>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
          renderItem={({ item }) => <SessionCard session={item} isSaving={pendingSessionIds.has(item.id)} />}
          renderSectionHeader={({ section }) => (
            <Text
              style={[
                styles.sectionHeader,
                { color: colors.mutedForeground, backgroundColor: colors.background },
              ]}
            >
              {formatSectionTitle(section.title)}
            </Text>
          )}
          ListHeaderComponent={
            <>
              <Header />
              <FilterRow />
            </>
          }
          stickySectionHeadersEnabled
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {instructorSlug ? (
        <ShareModal
          visible={showShare}
          onClose={() => setShowShare(false)}
          slug={instructorSlug}
          instructorName={instructorName}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerWrap: { paddingHorizontal: 20, paddingBottom: 16 },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  offlineText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#FF9500" },
  syncBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  syncBannerText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  syncBannerDismiss: { paddingLeft: 4 },
  migrationBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  migrationText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  migrationAction: { paddingHorizontal: 6, paddingVertical: 2 },
  migrationActionText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  migrationDismiss: { paddingLeft: 4 },
  hintBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  hintText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  hintDismiss: { paddingLeft: 4 },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 2 },
  brandName: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: 170,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  dateBadgeText: { fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "right" },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  statNum: { fontSize: 26, fontFamily: "Inter_700Bold", lineHeight: 30 },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  filterWrap: { paddingBottom: 14 },
  filterScroll: { paddingHorizontal: 20, gap: 8 },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: { fontSize: 13 },
  list: { paddingHorizontal: 20 },
  sectionHeader: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingVertical: 10,
    paddingTop: 16,
  },
});
