import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Availability, DayAvailability, useScheduler } from "@/context/SchedulerContext";
import { useColors } from "@/hooks/useColors";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DURATIONS = [30, 45, 60, 90];

const TIMES: string[] = [];
for (let h = 5; h <= 22; h++) {
  TIMES.push(`${String(h).padStart(2, "0")}:00`);
  if (h < 22) TIMES.push(`${String(h).padStart(2, "0")}:30`);
}

function formatTime12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

interface TimePicker {
  dayIndex: number;
  field: "startTime" | "endTime";
}

export default function AvailabilityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { availability, sessions, updateAvailability } = useScheduler();

  const [draft, setDraft] = useState<Availability>(() => JSON.parse(JSON.stringify(availability)));
  const [timePicker, setTimePicker] = useState<TimePicker | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(JSON.parse(JSON.stringify(availability)));
  }, [availability]);

  const toggleDay = useCallback((dayIndex: number) => {
    setDraft((prev) => ({
      ...prev,
      days: prev.days.map((d) => d.day === dayIndex ? { ...d, enabled: !d.enabled } : d),
    }));
    Haptics.selectionAsync();
  }, []);

  const setTime = useCallback((dayIndex: number, field: "startTime" | "endTime", value: string) => {
    setDraft((prev) => ({
      ...prev,
      days: prev.days.map((d) => d.day === dayIndex ? { ...d, [field]: value } : d),
    }));
  }, []);

  const setDuration = useCallback((minutes: number) => {
    setDraft((prev) => ({ ...prev, sessionDurationMinutes: minutes }));
    Haptics.selectionAsync();
  }, []);

  function checkConflictsWithExistingSessions(nextAvail: Availability): string[] {
    const today = getTodayStr();
    const conflicts: string[] = [];
    for (const sess of sessions.filter((s) => s.date >= today && s.status !== "cancelled")) {
      const [y, m, d] = sess.date.split("-").map(Number);
      const dow = new Date(y, m - 1, d).getDay();
      const dayAvail = nextAvail.days.find((da) => da.day === dow);
      if (!dayAvail || !dayAvail.enabled) {
        conflicts.push(`${sess.clientName} on ${sess.date} (day disabled)`);
        continue;
      }
      if (
        timeToMinutes(sess.startTime) < timeToMinutes(dayAvail.startTime) ||
        timeToMinutes(sess.endTime) > timeToMinutes(dayAvail.endTime)
      ) {
        conflicts.push(`${sess.clientName} on ${sess.date} (outside new hours)`);
      }
    }
    return conflicts;
  }

  async function handleSave() {
    for (const day of draft.days) {
      if (day.enabled && timeToMinutes(day.startTime) >= timeToMinutes(day.endTime)) {
        Alert.alert("Invalid times", `${DAY_FULL[day.day]}: end time must be after start time.`);
        return;
      }
    }
    const conflicts = checkConflictsWithExistingSessions(draft);
    if (conflicts.length > 0) {
      const list = conflicts.slice(0, 3).join("\n• ");
      const extra = conflicts.length > 3 ? `\n…and ${conflicts.length - 3} more` : "";
      await new Promise<void>((resolve) => {
        Alert.alert(
          "Existing Sessions Affected",
          `These future sessions fall outside your new schedule:\n\n• ${list}${extra}\n\nSave anyway?`,
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve() },
            { text: "Save Anyway", style: "destructive", onPress: () => { resolve(); doSave(); } },
          ]
        );
      });
      return;
    }
    doSave();
  }

  async function doSave() {
    setSaving(true);
    try {
      await updateAvailability(draft);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } finally {
      setSaving(false);
    }
  }

  const enabledCount = draft.days.filter((d) => d.enabled).length;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 82 : insets.bottom + 20;
  const currentDay = timePicker != null ? draft.days.find((d) => d.day === timePicker.dayIndex) : null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Availability</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {enabledCount} day{enabledCount !== 1 ? "s" : ""} · {draft.sessionDurationMinutes}min sessions
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.saveHeaderBtn,
            { backgroundColor: saved ? "#34C75920" : colors.primary + "18",
              borderColor: saved ? "#34C759" : colors.primary },
          ]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Feather name={saved ? "check" : "save"} size={15} color={saved ? "#34C759" : colors.primary} />
          <Text style={[styles.saveHeaderBtnText, { color: saved ? "#34C759" : colors.primary }]}>
            {saved ? "Saved" : "Save"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* Duration section */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Session Duration</Text>
          <View style={styles.durationRow}>
            {DURATIONS.map((min) => {
              const sel = draft.sessionDurationMinutes === min;
              return (
                <TouchableOpacity
                  key={min}
                  style={[
                    styles.durationPill,
                    {
                      backgroundColor: sel ? colors.primary : colors.secondary,
                      borderColor: sel ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setDuration(min)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.durationText, { color: sel ? "#FFFFFF" : colors.mutedForeground }]}>
                    {min}m
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Days section */}
        <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>Weekly Schedule</Text>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, paddingHorizontal: 0, paddingVertical: 0 }]}>
          {draft.days.map((day, idx) => (
            <DayRow
              key={day.day}
              day={day}
              colors={colors}
              isLast={idx === draft.days.length - 1}
              onToggle={() => toggleDay(day.day)}
              onTimePress={(field) => setTimePicker({ dayIndex: day.day, field })}
            />
          ))}
        </View>
      </ScrollView>

      {/* Time Picker Modal */}
      <Modal
        visible={timePicker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setTimePicker(null)}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setTimePicker(null)} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, paddingBottom: insets.bottom + 16, borderColor: colors.border },
          ]}
        >
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
            {timePicker != null
              ? `${DAY_FULL[timePicker.dayIndex]} — ${timePicker.field === "startTime" ? "Start" : "End"} Time`
              : ""}
          </Text>
          <FlatList
            data={TIMES}
            keyExtractor={(t) => t}
            showsVerticalScrollIndicator={false}
            style={styles.timeList}
            renderItem={({ item: t }) => {
              const isSel = timePicker != null && currentDay?.[timePicker.field] === t;
              return (
                <TouchableOpacity
                  style={[
                    styles.timeRow,
                    { backgroundColor: isSel ? colors.primary : "transparent" },
                  ]}
                  onPress={() => {
                    if (timePicker) {
                      setTime(timePicker.dayIndex, timePicker.field, t);
                      Haptics.selectionAsync();
                      setTimePicker(null);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.timeText, { color: isSel ? "#FFFFFF" : colors.foreground }]}>
                    {formatTime12(t)}
                  </Text>
                  {isSel && <Feather name="check" size={15} color="#FFFFFF" />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

function DayRow({
  day,
  colors,
  isLast,
  onToggle,
  onTimePress,
}: {
  day: DayAvailability;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  isLast: boolean;
  onToggle: () => void;
  onTimePress: (field: "startTime" | "endTime") => void;
}) {
  return (
    <View
      style={[
        styles.dayRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      <View style={styles.dayTop}>
        <View style={styles.dayLabelWrap}>
          <View
            style={[
              styles.dayDot,
              { backgroundColor: day.enabled ? colors.primary : colors.border },
            ]}
          />
          <Text style={[styles.dayName, { color: day.enabled ? colors.foreground : colors.mutedForeground }]}>
            {DAY_LABELS[day.day]}
          </Text>
        </View>
        <Switch
          value={day.enabled}
          onValueChange={onToggle}
          trackColor={{ true: colors.primary, false: colors.secondary }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={colors.secondary}
        />
      </View>

      {day.enabled && (
        <View style={styles.timeBtnsRow}>
          <TouchableOpacity
            style={[styles.timeBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            onPress={() => onTimePress("startTime")}
            activeOpacity={0.75}
          >
            <Feather name="sunrise" size={12} color={colors.primary} />
            <Text style={[styles.timeBtnText, { color: colors.foreground }]}>
              {formatTime12(day.startTime)}
            </Text>
          </TouchableOpacity>
          <View style={[styles.timeDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity
            style={[styles.timeBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            onPress={() => onTimePress("endTime")}
            activeOpacity={0.75}
          >
            <Feather name="sunset" size={12} color={colors.primary} />
            <Text style={[styles.timeBtnText, { color: colors.foreground }]}>
              {formatTime12(day.endTime)}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  saveHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  saveHeaderBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  groupLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 20,
    marginBottom: 8,
    marginTop: 24,
  },
  section: {
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  durationRow: { flexDirection: "row", gap: 8 },
  durationPill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  durationText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  dayRow: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  dayTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayLabelWrap: { flexDirection: "row", alignItems: "center", gap: 10 },
  dayDot: { width: 8, height: 8, borderRadius: 4 },
  dayName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  timeBtnsRow: { flexDirection: "row", alignItems: "center", gap: 0 },
  timeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  timeBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  timeDivider: { width: 8, height: 1.5, marginHorizontal: 6 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingTop: 14,
    maxHeight: "62%",
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: "center", marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 15, fontFamily: "Inter_600SemiBold",
    textAlign: "center", marginBottom: 10, paddingHorizontal: 20,
  },
  timeList: { paddingHorizontal: 12 },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 2,
  },
  timeText: { fontSize: 16, fontFamily: "Inter_500Medium" },
});
