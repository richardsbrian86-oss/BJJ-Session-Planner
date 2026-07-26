import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StatusBadge } from "@/components/StatusBadge";
import { TimeSlot, SessionStatus, useScheduler } from "@/context/SchedulerContext";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { api, getApiBaseUrl } from "@/utils/apiClient";

function formatTime12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function formatDateFull(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function calcDuration(start: string, end: string): string {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h} hour${h > 1 ? "s" : ""}`;
}

interface ActionDef {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  status: SessionStatus;
  primary?: boolean;
}

function getActions(status: SessionStatus): ActionDef[] {
  switch (status) {
    case "pending":
      return [
        { label: "Confirm", icon: "check-circle", status: "confirmed", primary: true },
        { label: "Cancel", icon: "x-circle", status: "cancelled" },
      ];
    case "confirmed":
      return [
        { label: "Mark Completed", icon: "award", status: "completed", primary: true },
        { label: "Cancel", icon: "x-circle", status: "cancelled" },
      ];
    case "completed":
      return [{ label: "Reopen as Confirmed", icon: "refresh-cw", status: "confirmed" }];
    case "cancelled":
      return [{ label: "Restore to Pending", icon: "refresh-cw", status: "pending" }];
  }
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type RescheduleStep = "date" | "slot";

export default function SessionDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { instructorSlug } = useAuth();
  const { sessions, updateSessionStatus, updateSession, deleteSession, rescheduleSession, getAvailableSlotsForDate, availability, pendingSessionIds } = useScheduler();
  const isSaving = id ? pendingSessionIds.has(id) : false;
  const { width: screenW } = useWindowDimensions();

  const [updating, setUpdating] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleStep, setRescheduleStep] = useState<RescheduleStep>("date");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleSlot, setRescheduleSlot] = useState<TimeSlot | null>(null);
  const [copyLinkDone, setCopyLinkDone] = useState(false);

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const [editingField, setEditingField] = useState<"clientName" | "clientPhone" | "clientEmail" | null>(null);
  const [fieldValue, setFieldValue] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [savingField, setSavingField] = useState(false);

  const [editingDate, setEditingDate] = useState(false);
  const [editingTime, setEditingTime] = useState(false);
  const [inlineDateValue, setInlineDateValue] = useState("");
  const [inlineTimeSlot, setInlineTimeSlot] = useState<TimeSlot | null>(null);
  const [savingDateTime, setSavingDateTime] = useState(false);

  const [showWaiverModal, setShowWaiverModal] = useState(false);
  const [waiverData, setWaiverData] = useState<{
    id: number;
    clientName: string;
    clientEmail: string;
    signedAt: string;
    signatureData: string;
  } | null>(null);
  const [waiverLoading, setWaiverLoading] = useState(false);
  const [waiverError, setWaiverError] = useState<string | null>(null);

  const session = sessions.find((s) => s.id === id);

  const today = getTodayStr();
  const HPAD = 20;
  const GAP = 6;
  const COLS = 7;
  const dateCardW = Math.floor((screenW - HPAD * 2 - GAP * (COLS - 1)) / COLS);
  const slotCardW = Math.floor((screenW - HPAD * 2 - 10) / 2);

  const CARD_PAD = 16;
  const inlineDateCardW = Math.floor((screenW - HPAD * 2 - CARD_PAD * 2 - GAP * (COLS - 1)) / COLS);

  const inlineTimeSlots = useMemo(() => {
    if (!editingTime || !session) return [];
    return getAvailableSlotsForDate(session.date, session.id);
  }, [editingTime, session?.date, session?.id, getAvailableSlotsForDate]);

  const inlineDateTimeAvailable = useMemo(() => {
    if (!inlineDateValue || !session || inlineDateValue === session.date) return true;
    const slots = getAvailableSlotsForDate(inlineDateValue, session.id);
    return slots.some((s) => s.startTime === session.startTime);
  }, [inlineDateValue, session?.date, session?.startTime, session?.id, getAvailableSlotsForDate]);

  const reschedDates = useMemo(() => {
    return Array.from({ length: 35 }, (_, i) => {
      const dateStr = addDays(today, i);
      const [y, m, d] = dateStr.split("-").map(Number);
      const dow = new Date(y, m - 1, d).getDay();
      const dayAvail = availability.days.find((da) => da.day === dow);
      return {
        dateStr,
        dayName: DAY_NAMES[dow],
        dayNum: d,
        month: MONTH_NAMES[m - 1],
        hasAvailability: dayAvail?.enabled ?? false,
        isToday: i === 0,
      };
    });
  }, [today, availability]);

  const reschedSlots = useMemo(() => {
    if (!rescheduleDate) return [];
    return getAvailableSlotsForDate(rescheduleDate, session?.id);
  }, [rescheduleDate, getAvailableSlotsForDate, session?.id]);

  if (!session) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.notFound, { paddingTop: (Platform.OS === "web" ? 67 : insets.top) + 20 }]}>
          <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
          <Text style={[styles.notFoundText, { color: colors.foreground }]}>Session not found</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.link, { color: colors.primary }]}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  async function handleStatusChange(newStatus: SessionStatus) {
    setUpdating(true);
    try {
      await updateSessionStatus(session!.id, newStatus);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Sync Failed",
        "The status was updated on your device but could not be saved to the server. Please check your connection and try again.",
        [{ text: "OK" }]
      );
    } finally {
      setUpdating(false);
    }
  }

  function handleDelete() {
    Alert.alert(
      "Delete Session",
      `Remove session with ${session!.clientName}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteSession(session!.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            router.back();
          },
        },
      ]
    );
  }

  function getBookingLink(): string {
    const base = getApiBaseUrl();
    return `${base}/book/booking/${session?.cancellationToken}`;
  }

  async function handleShareLink() {
    const url = getBookingLink();
    if (Platform.OS === "web") {
      await Clipboard.setStringAsync(url);
      setCopyLinkDone(true);
      setTimeout(() => setCopyLinkDone(false), 2000);
      return;
    }
    try {
      await Share.share({ message: url, url });
    } catch {
      await Clipboard.setStringAsync(url);
      setCopyLinkDone(true);
      setTimeout(() => setCopyLinkDone(false), 2000);
    }
  }

  async function handleCopyLink() {
    const url = getBookingLink();
    await Clipboard.setStringAsync(url);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopyLinkDone(true);
    setTimeout(() => setCopyLinkDone(false), 2000);
  }

  function handleEditNotes() {
    setNotesValue(session?.notes ?? "");
    setEditingNotes(true);
  }

  async function handleSaveNotes() {
    if (!session) return;
    setSavingNotes(true);
    try {
      await updateSession(session.id, { notes: notesValue.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditingNotes(false);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Save Failed",
        "Your notes could not be saved to the server. Please check your connection and try again.",
        [{ text: "OK" }]
      );
    } finally {
      setSavingNotes(false);
    }
  }

  function validateField(field: "clientName" | "clientPhone" | "clientEmail", value: string): string | null {
    if (field === "clientName" && !value.trim()) return "Name can't be empty";
    if (field === "clientEmail" && value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
      return "Enter a valid email address";
    }
    return null;
  }

  function handleFieldChange(value: string) {
    setFieldValue(value);
    if (editingField) setFieldError(validateField(editingField, value));
  }

  function handleEditField(field: "clientName" | "clientPhone" | "clientEmail") {
    const value =
      field === "clientName"
        ? session?.clientName ?? ""
        : field === "clientPhone"
        ? session?.clientPhone ?? ""
        : session?.clientEmail ?? "";
    setFieldValue(value);
    setFieldError(validateField(field, value));
    setEditingField(field);
  }

  async function handleSaveField() {
    if (!session || !editingField) return;
    const err = validateField(editingField, fieldValue);
    if (err) { setFieldError(err); return; }
    setSavingField(true);
    try {
      await updateSession(session.id, { [editingField]: fieldValue.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditingField(null);
      setFieldError(null);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Save Failed",
        "The contact info could not be saved to the server. Please check your connection and try again.",
        [{ text: "OK" }]
      );
    } finally {
      setSavingField(false);
    }
  }

  async function doSaveDate() {
    if (!session || !inlineDateValue) return;
    setSavingDateTime(true);
    try {
      await rescheduleSession(session.id, inlineDateValue, session.startTime, session.endTime);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditingDate(false);
      setInlineDateValue("");
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Save Failed",
        "The session date could not be saved to the server. Please check your connection and try again.",
        [{ text: "OK" }]
      );
    } finally {
      setSavingDateTime(false);
    }
  }

  async function handleSaveDate() {
    if (!session || !inlineDateValue || inlineDateValue === session.date) return;

    // Conflict detection MUST go through the server so that sessions booked on
    // other devices or by other instructors sharing the same slot are visible.
    // Local state (inlineDateTimeAvailable / getAvailableSlotsForDate) only
    // knows what this device has synced — never fall back to it silently.
    if (!instructorSlug) {
      Alert.alert(
        "Cannot Check Availability",
        "Your instructor profile is not loaded. Please log out and log in again before rescheduling.",
        [{ text: "OK" }]
      );
      return;
    }

    let slotConflict = false;
    try {
      const { slots } = await api.public.getSlots(instructorSlug, inlineDateValue);
      slotConflict = !slots.includes(session.startTime);
    } catch {
      // Do NOT fall back to local state — it cannot detect bookings made on
      // other devices or by other instructors. Surface the network failure so
      // the instructor can retry when connectivity is restored.
      Alert.alert(
        "Availability Check Failed",
        "Could not verify slot availability with the server. Please check your connection and try again.",
        [{ text: "OK" }]
      );
      return;
    }

    if (slotConflict) {
      Alert.alert(
        "Time Slot May Conflict",
        `${formatTime12(session.startTime)} may already be taken on ${formatDateShort(inlineDateValue)}. You can update the time after saving. Save anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Save Anyway", style: "destructive", onPress: () => void doSaveDate() },
        ]
      );
      return;
    }
    await doSaveDate();
  }

  async function handleSaveTime() {
    if (!session || !inlineTimeSlot) return;
    setSavingDateTime(true);
    try {
      await rescheduleSession(session.id, session.date, inlineTimeSlot.startTime, inlineTimeSlot.endTime);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditingTime(false);
      setInlineTimeSlot(null);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Save Failed",
        "The session time could not be saved to the server. Please check your connection and try again.",
        [{ text: "OK" }]
      );
    } finally {
      setSavingDateTime(false);
    }
  }

  async function handleViewWaiver() {
    if (!session?.waiverId) return;
    setWaiverError(null);
    setWaiverLoading(true);
    setShowWaiverModal(true);
    try {
      const data = await api.sessions.getWaiver(Number(session!.id));
      setWaiverData(data);
    } catch (err) {
      setWaiverError(err instanceof Error ? err.message : "Could not load waiver");
    } finally {
      setWaiverLoading(false);
    }
  }

  function openReschedule() {
    setRescheduleDate("");
    setRescheduleSlot(null);
    setRescheduleStep("date");
    setShowRescheduleModal(true);
  }

  async function confirmReschedule() {
    if (!rescheduleDate || !rescheduleSlot) return;
    setUpdating(true);
    try {
      await rescheduleSession(session!.id, rescheduleDate, rescheduleSlot.startTime, rescheduleSlot.endTime);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowRescheduleModal(false);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Sync Failed",
        "The session was rescheduled on your device but could not be saved to the server. Please check your connection and try again.",
        [{ text: "OK" }]
      );
    } finally {
      setUpdating(false);
    }
  }

  const actions = getActions(session.status);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 0) + 16;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Session</Text>
        <TouchableOpacity style={styles.deleteHeaderBtn} onPress={handleDelete} activeOpacity={0.7}>
          <Feather name="trash-2" size={20} color={colors.destructive} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Client card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {session.isClientBooked ? (
            <View style={[styles.clientBookedBanner, { backgroundColor: "#0EA5E912", borderColor: "#0EA5E930" }]}>
              <Feather name="globe" size={13} color="#0EA5E9" />
              <Text style={[styles.clientBookedText, { color: "#0EA5E9" }]}>Client booked via portal</Text>
            </View>
          ) : null}
          <View style={styles.clientTop}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{session.clientName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.clientInfo}>
              {editingField === "clientName" ? (
                <View style={styles.fieldEditWrap}>
                  <TextInput
                    style={[styles.fieldInput, { color: colors.foreground, borderColor: colors.primary, backgroundColor: colors.background }]}
                    value={fieldValue}
                    onChangeText={handleFieldChange}
                    placeholder="Client name"
                    placeholderTextColor={colors.mutedForeground}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleSaveField}
                  />
                  {fieldError ? (
                    <Text style={styles.fieldErrorText}>{fieldError}</Text>
                  ) : null}
                  <View style={styles.fieldActions}>
                    <TouchableOpacity
                      style={[styles.fieldCancelBtn, { borderColor: colors.border }]}
                      onPress={() => { setEditingField(null); setFieldError(null); }}
                      disabled={savingField}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.fieldCancelText, { color: colors.foreground }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.fieldSaveBtn, { backgroundColor: colors.primary, opacity: (savingField || !!fieldError) ? 0.4 : 1 }]}
                      onPress={handleSaveField}
                      disabled={savingField || !!fieldError}
                      activeOpacity={0.8}
                    >
                      {savingField ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Feather name="check" size={14} color="#FFFFFF" />
                      )}
                      <Text style={styles.fieldSaveText}>{savingField ? "Saving…" : "Save"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity onPress={() => handleEditField("clientName")} activeOpacity={0.7}>
                  <Text style={[styles.clientName, { color: colors.foreground }]}>{session.clientName}</Text>
                </TouchableOpacity>
              )}
              {isSaving ? (
                <View style={styles.savingRow}>
                  <ActivityIndicator size="small" color={colors.mutedForeground} style={styles.savingSpinner} />
                  <Text style={[styles.savingText, { color: colors.mutedForeground }]}>Saving…</Text>
                </View>
              ) : (
                <StatusBadge status={session.status} />
              )}
            </View>
          </View>

          {editingField === "clientPhone" ? (
            <View style={styles.fieldEditWrap}>
              <View style={styles.fieldInputRow}>
                <Feather name="phone" size={15} color={colors.mutedForeground} style={styles.fieldIcon} />
                <TextInput
                  style={[styles.fieldInputInline, { color: colors.foreground, borderColor: colors.primary, backgroundColor: colors.background }]}
                  value={fieldValue}
                  onChangeText={handleFieldChange}
                  placeholder="Phone number"
                  placeholderTextColor={colors.mutedForeground}
                  autoFocus
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  onSubmitEditing={handleSaveField}
                />
              </View>
              <View style={styles.fieldActions}>
                <TouchableOpacity
                  style={[styles.fieldCancelBtn, { borderColor: colors.border }]}
                  onPress={() => { setEditingField(null); setFieldError(null); }}
                  disabled={savingField}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.fieldCancelText, { color: colors.foreground }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.fieldSaveBtn, { backgroundColor: colors.primary, opacity: savingField ? 0.6 : 1 }]}
                  onPress={handleSaveField}
                  disabled={savingField}
                  activeOpacity={0.8}
                >
                  {savingField ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Feather name="check" size={14} color="#FFFFFF" />
                  )}
                  <Text style={styles.fieldSaveText}>{savingField ? "Saving…" : "Save"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : session.clientPhone ? (
            <TouchableOpacity onPress={() => handleEditField("clientPhone")} activeOpacity={0.7}>
              <InfoRow icon="phone" label={session.clientPhone} colors={colors} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => handleEditField("clientPhone")} activeOpacity={0.7} style={styles.addFieldBtn}>
              <Feather name="plus" size={14} color={colors.mutedForeground} />
              <Text style={[styles.addFieldText, { color: colors.mutedForeground }]}>Add phone</Text>
            </TouchableOpacity>
          )}

          {editingField === "clientEmail" ? (
            <View style={styles.fieldEditWrap}>
              <View style={styles.fieldInputRow}>
                <Feather name="mail" size={15} color={colors.mutedForeground} style={styles.fieldIcon} />
                <TextInput
                  style={[styles.fieldInputInline, { color: colors.foreground, borderColor: colors.primary, backgroundColor: colors.background }]}
                  value={fieldValue}
                  onChangeText={handleFieldChange}
                  placeholder="Email address"
                  placeholderTextColor={colors.mutedForeground}
                  autoFocus
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleSaveField}
                />
              </View>
              {fieldError ? (
                <Text style={styles.fieldErrorText}>{fieldError}</Text>
              ) : null}
              <View style={styles.fieldActions}>
                <TouchableOpacity
                  style={[styles.fieldCancelBtn, { borderColor: colors.border }]}
                  onPress={() => { setEditingField(null); setFieldError(null); }}
                  disabled={savingField}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.fieldCancelText, { color: colors.foreground }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.fieldSaveBtn, { backgroundColor: colors.primary, opacity: (savingField || !!fieldError) ? 0.4 : 1 }]}
                  onPress={handleSaveField}
                  disabled={savingField || !!fieldError}
                  activeOpacity={0.8}
                >
                  {savingField ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Feather name="check" size={14} color="#FFFFFF" />
                  )}
                  <Text style={styles.fieldSaveText}>{savingField ? "Saving…" : "Save"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : session.clientEmail ? (
            <TouchableOpacity onPress={() => handleEditField("clientEmail")} activeOpacity={0.7}>
              <InfoRow icon="mail" label={session.clientEmail} colors={colors} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => handleEditField("clientEmail")} activeOpacity={0.7} style={styles.addFieldBtn}>
              <Feather name="plus" size={14} color={colors.mutedForeground} />
              <Text style={[styles.addFieldText, { color: colors.mutedForeground }]}>Add email</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Session details card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>Session Details</Text>

          {/* Inline date editor */}
          {editingDate ? (
            <View style={styles.inlinePickerWrap}>
              <View style={styles.inlinePickerHeader}>
                <Feather name="calendar" size={15} color={colors.mutedForeground} />
                <Text style={[styles.inlinePickerLabel, { color: colors.foreground }]}>Choose a new date</Text>
              </View>
              <View style={[styles.inlineDateGrid, { gap: GAP }]}>
                {reschedDates.map(({ dateStr, dayName, dayNum, month, hasAvailability, isToday }) => {
                  const sel = dateStr === inlineDateValue;
                  return (
                    <TouchableOpacity
                      key={dateStr}
                      style={[
                        styles.inlineDateCard,
                        {
                          width: inlineDateCardW,
                          height: Math.round(inlineDateCardW * 1.5),
                          backgroundColor: sel ? colors.primary : colors.card,
                          borderColor: sel ? colors.primary : colors.border,
                          opacity: hasAvailability ? 1 : 0.28,
                        },
                      ]}
                      onPress={() => {
                        if (!hasAvailability) return;
                        setInlineDateValue(dateStr);
                        Haptics.selectionAsync();
                      }}
                      disabled={!hasAvailability}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dateDay, { color: sel ? "rgba(255,255,255,0.75)" : colors.mutedForeground }]}>
                        {dayName}
                      </Text>
                      <Text style={[styles.dateNum, { color: sel ? "#FFFFFF" : colors.foreground }]}>
                        {dayNum}
                      </Text>
                      <Text style={[styles.dateMon, { color: sel ? "rgba(255,255,255,0.55)" : colors.mutedForeground }]}>
                        {month}
                      </Text>
                      {isToday && (
                        <View style={[styles.todayDot, { backgroundColor: sel ? "#FFFFFF" : colors.primary }]} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {inlineDateValue && inlineDateValue !== session.date && !inlineDateTimeAvailable && (
                <View style={[styles.inlineDateWarning, { backgroundColor: "#FF950018", borderColor: "#FF9500" }]}>
                  <Feather name="alert-triangle" size={13} color="#FF9500" />
                  <Text style={[styles.inlineDateWarningText, { color: "#FF9500" }]}>
                    {formatTime12(session.startTime)} may not be available on this date. You may need to update the time too.
                  </Text>
                </View>
              )}
              <View style={styles.fieldActions}>
                <TouchableOpacity
                  style={[styles.fieldCancelBtn, { borderColor: colors.border }]}
                  onPress={() => { setEditingDate(false); setInlineDateValue(""); }}
                  disabled={savingDateTime}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.fieldCancelText, { color: colors.foreground }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.fieldSaveBtn, { backgroundColor: colors.primary, opacity: (!inlineDateValue || inlineDateValue === session.date || savingDateTime) ? 0.4 : 1 }]}
                  onPress={handleSaveDate}
                  disabled={!inlineDateValue || inlineDateValue === session.date || savingDateTime}
                  activeOpacity={0.8}
                >
                  {savingDateTime ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Feather name="check" size={14} color="#FFFFFF" />
                  )}
                  <Text style={styles.fieldSaveText}>{savingDateTime ? "Saving…" : "Save"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => { setInlineDateValue(session.date); setEditingDate(true); setEditingTime(false); setInlineTimeSlot(null); }}
              activeOpacity={0.7}
            >
              <View style={styles.editableInfoRow}>
                <InfoRow icon="calendar" label={formatDateFull(session.date)} colors={colors} />
                <Feather name="edit-2" size={13} color={colors.mutedForeground} style={styles.editRowIcon} />
              </View>
            </TouchableOpacity>
          )}

          {/* Inline time editor */}
          {editingTime ? (
            <View style={styles.inlinePickerWrap}>
              <View style={styles.inlinePickerHeader}>
                <Feather name="clock" size={15} color={colors.mutedForeground} />
                <Text style={[styles.inlinePickerLabel, { color: colors.foreground }]}>Choose a new time</Text>
              </View>
              {inlineTimeSlots.length === 0 ? (
                <Text style={[styles.inlineNoSlots, { color: colors.mutedForeground }]}>
                  No other slots available for this date.
                </Text>
              ) : (
                <View style={styles.inlineSlotGrid}>
                  {inlineTimeSlots.map((slot, i) => {
                    const sel = inlineTimeSlot?.startTime === slot.startTime;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.inlineSlotCard,
                          {
                            backgroundColor: sel ? colors.primary : colors.card,
                            borderColor: sel ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => {
                          setInlineTimeSlot(slot);
                          Haptics.selectionAsync();
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.slotStart, { color: sel ? "#FFFFFF" : colors.foreground }]}>
                          {formatTime12(slot.startTime)}
                        </Text>
                        <Text style={[styles.slotEnd, { color: sel ? "rgba(255,255,255,0.6)" : colors.mutedForeground }]}>
                          – {formatTime12(slot.endTime)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              <View style={styles.fieldActions}>
                <TouchableOpacity
                  style={[styles.fieldCancelBtn, { borderColor: colors.border }]}
                  onPress={() => { setEditingTime(false); setInlineTimeSlot(null); }}
                  disabled={savingDateTime}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.fieldCancelText, { color: colors.foreground }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.fieldSaveBtn, { backgroundColor: colors.primary, opacity: (!inlineTimeSlot || inlineTimeSlot.startTime === session.startTime || savingDateTime) ? 0.4 : 1 }]}
                  onPress={handleSaveTime}
                  disabled={!inlineTimeSlot || inlineTimeSlot.startTime === session.startTime || savingDateTime}
                  activeOpacity={0.8}
                >
                  {savingDateTime ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Feather name="check" size={14} color="#FFFFFF" />
                  )}
                  <Text style={styles.fieldSaveText}>{savingDateTime ? "Saving…" : "Save"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => { setInlineTimeSlot(null); setEditingTime(true); setEditingDate(false); setInlineDateValue(""); }}
              activeOpacity={0.7}
            >
              <View style={styles.editableInfoRow}>
                <InfoRow icon="clock" label={`${formatTime12(session.startTime)} – ${formatTime12(session.endTime)}`} colors={colors} />
                <Feather name="edit-2" size={13} color={colors.mutedForeground} style={styles.editRowIcon} />
              </View>
            </TouchableOpacity>
          )}
          <InfoRow icon="activity" label={`${calcDuration(session.startTime, session.endTime)} session`} colors={colors} />
          {session.serviceName ? (
            <InfoRow icon="award" label={session.serviceName} colors={colors} />
          ) : null}
          {session.packageCount != null ? (
            <InfoRow icon="layers" label={`${session.packageCount}-Session Pack · 20% off`} colors={colors} />
          ) : null}
          {session.packageTotal != null ? (
            <InfoRow
              icon="dollar-sign"
              label={`$${session.packageTotal.toFixed(2)} total (was $${(session.packageCount! * (session.servicePrice ?? 0)).toFixed(2)})`}
              colors={colors}
            />
          ) : session.servicePrice != null ? (
            <InfoRow icon="dollar-sign" label={`$${session.servicePrice.toFixed(2)}`} colors={colors} />
          ) : null}
          {session.paymentStatus ? (
            <View style={[
              styles.paymentBanner,
              {
                backgroundColor: session.paymentStatus === "paid" ? "#34C75918" : "#FF950018",
                borderColor: session.paymentStatus === "paid" ? "#34C759" : "#FF9500",
              },
            ]}>
              <Feather
                name={session.paymentStatus === "paid" ? "check-circle" : "clock"}
                size={14}
                color={session.paymentStatus === "paid" ? "#34C759" : "#FF9500"}
              />
              <Text style={[
                styles.paymentText,
                { color: session.paymentStatus === "paid" ? "#34C759" : "#FF9500" },
              ]}>
                {session.paymentStatus === "paid"
                  ? "Payment received"
                  : "Client has not yet paid"}
              </Text>
            </View>
          ) : null}
          {session.rescheduledFrom ? (
            <View style={[styles.rescheduledBanner, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="refresh-cw" size={13} color={colors.mutedForeground} />
              <Text style={[styles.rescheduledText, { color: colors.mutedForeground }]}>
                Rescheduled from {formatDateShort(session.rescheduledFrom.date)} at {formatTime12(session.rescheduledFrom.startTime)}
              </Text>
            </View>
          ) : null}
          {session.waiverId ? (
            <TouchableOpacity
              style={[styles.waiverBanner, { backgroundColor: "#34C75912", borderColor: "#34C75940" }]}
              onPress={handleViewWaiver}
              activeOpacity={0.7}
            >
              <Feather name="file-text" size={14} color="#34C759" />
              <Text style={[styles.waiverText, { color: "#34C759" }]}>Waiver on file ✓</Text>
              <Feather name="chevron-right" size={14} color="#34C75980" />
            </TouchableOpacity>
          ) : (
            <View style={[styles.waiverBanner, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="file-text" size={14} color={colors.mutedForeground} />
              <Text style={[styles.waiverText, { color: colors.mutedForeground }]}>No waiver on file</Text>
            </View>
          )}
        </View>

        {/* Notes card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.notesHeader}>
            <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>Notes</Text>
            {!editingNotes && (
              <TouchableOpacity onPress={handleEditNotes} activeOpacity={0.7} style={styles.editNoteBtn}>
                <Feather name="edit-2" size={14} color={colors.mutedForeground} />
                <Text style={[styles.editNoteBtnText, { color: colors.mutedForeground }]}>
                  {session.notes ? "Edit" : "Add"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {editingNotes ? (
            <>
              <TextInput
                style={[styles.notesInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                multiline
                value={notesValue}
                onChangeText={setNotesValue}
                placeholder="Add session notes…"
                placeholderTextColor={colors.mutedForeground}
                autoFocus
                textAlignVertical="top"
              />
              <View style={styles.notesActions}>
                <TouchableOpacity
                  style={[styles.notesCancelBtn, { borderColor: colors.border }]}
                  onPress={() => setEditingNotes(false)}
                  disabled={savingNotes}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.notesCancelText, { color: colors.foreground }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.notesSaveBtn, { backgroundColor: colors.primary, opacity: savingNotes ? 0.6 : 1 }]}
                  onPress={handleSaveNotes}
                  disabled={savingNotes}
                  activeOpacity={0.8}
                >
                  {savingNotes ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Feather name="check" size={15} color="#FFFFFF" />
                  )}
                  <Text style={styles.notesSaveText}>{savingNotes ? "Saving…" : "Save"}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : session.notes ? (
            <Text style={[styles.notesText, { color: colors.foreground }]}>{session.notes}</Text>
          ) : (
            <Text style={[styles.notesPlaceholder, { color: colors.mutedForeground }]}>No notes yet. Tap Edit to add some.</Text>
          )}
        </View>

        {/* Share booking link */}
        {session.cancellationToken ? (
          <View style={[styles.linkCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>Client Booking Link</Text>
            <Text style={[styles.linkUrl, { color: colors.mutedForeground }]} numberOfLines={1} ellipsizeMode="middle">
              {getBookingLink()}
            </Text>
            <View style={styles.linkActions}>
              <TouchableOpacity
                style={[styles.linkBtn, { backgroundColor: copyLinkDone ? "#34C75920" : colors.secondary, borderColor: copyLinkDone ? "#34C759" : colors.border }]}
                onPress={handleCopyLink}
                activeOpacity={0.8}
              >
                <Feather name={copyLinkDone ? "check" : "copy"} size={16} color={copyLinkDone ? "#34C759" : colors.foreground} />
                <Text style={[styles.linkBtnText, { color: copyLinkDone ? "#34C759" : colors.foreground }]}>
                  {copyLinkDone ? "Copied!" : "Copy Link"}
                </Text>
              </TouchableOpacity>
              {Platform.OS !== "web" ? (
                <TouchableOpacity
                  style={[styles.linkBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                  onPress={handleShareLink}
                  activeOpacity={0.8}
                >
                  <Feather name="share-2" size={16} color={colors.foreground} />
                  <Text style={[styles.linkBtnText, { color: colors.foreground }]}>Share</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Reschedule button */}
        <TouchableOpacity
          style={[styles.rescheduleBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          onPress={openReschedule}
          activeOpacity={0.8}
        >
          <Feather name="calendar" size={17} color={colors.foreground} />
          <Text style={[styles.rescheduleBtnText, { color: colors.foreground }]}>Reschedule Session</Text>
        </TouchableOpacity>

        {/* Status actions */}
        <View style={styles.actions}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.status}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: action.primary ? colors.primary : colors.secondary,
                  opacity: updating ? 0.6 : 1,
                },
              ]}
              onPress={() => handleStatusChange(action.status)}
              disabled={updating}
              activeOpacity={0.8}
            >
              <Feather name={action.icon} size={18} color={action.primary ? "#FFFFFF" : colors.foreground} />
              <Text style={[styles.actionText, { color: action.primary ? "#FFFFFF" : colors.foreground }]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Delete */}
        <TouchableOpacity
          style={[styles.deleteBtn, { borderColor: colors.destructive }]}
          onPress={handleDelete}
          activeOpacity={0.7}
        >
          <Feather name="trash-2" size={16} color={colors.destructive} />
          <Text style={[styles.deleteBtnText, { color: colors.destructive }]}>Delete Session</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Reschedule Modal */}
      <Modal
        visible={showRescheduleModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRescheduleModal(false)}
      >
        <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
          {/* Modal header */}
          <View style={[styles.modalHeader, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => {
                if (rescheduleStep === "slot") {
                  setRescheduleStep("date");
                } else {
                  setShowRescheduleModal(false);
                }
              }}
              style={styles.backBtn}
            >
              <Feather name="arrow-left" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Reschedule</Text>
            <View style={{ width: 30 }} />
          </View>

          <ScrollView
            contentContainerStyle={[styles.modalContent, { paddingBottom: bottomPad }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Step indicator */}
            <View style={styles.stepIndicator}>
              {(["date", "slot"] as RescheduleStep[]).map((s, i) => (
                <View
                  key={s}
                  style={[
                    styles.stepDot,
                    { backgroundColor: s === rescheduleStep || (i === 1 && rescheduleStep === "slot" && rescheduleDate) ? colors.primary : colors.muted,
                      width: s === rescheduleStep ? 22 : 8 },
                  ]}
                />
              ))}
            </View>

            {rescheduleStep === "date" && (
              <>
                <Text style={[styles.stepTitle, { color: colors.foreground }]}>Choose a new date</Text>
                <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
                  Current: {formatDateShort(session.date)} at {formatTime12(session.startTime)}
                </Text>
                <View style={styles.dateGrid}>
                  {reschedDates.map(({ dateStr, dayName, dayNum, month, hasAvailability, isToday }) => {
                    const sel = dateStr === rescheduleDate;
                    return (
                      <TouchableOpacity
                        key={dateStr}
                        style={[
                          styles.dateCard,
                          {
                            width: dateCardW,
                            height: Math.round(dateCardW * 1.45),
                            backgroundColor: sel ? colors.primary : colors.card,
                            borderColor: sel ? colors.primary : colors.border,
                            opacity: hasAvailability ? 1 : 0.28,
                          },
                        ]}
                        onPress={() => {
                          if (!hasAvailability) return;
                          setRescheduleDate(dateStr);
                          setRescheduleSlot(null);
                          Haptics.selectionAsync();
                        }}
                        disabled={!hasAvailability}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.dateDay, { color: sel ? "rgba(255,255,255,0.75)" : colors.mutedForeground }]}>
                          {dayName}
                        </Text>
                        <Text style={[styles.dateNum, { color: sel ? "#FFFFFF" : colors.foreground }]}>
                          {dayNum}
                        </Text>
                        <Text style={[styles.dateMon, { color: sel ? "rgba(255,255,255,0.55)" : colors.mutedForeground }]}>
                          {month}
                        </Text>
                        {isToday && (
                          <View style={[styles.todayDot, { backgroundColor: sel ? "#FFFFFF" : colors.primary }]} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {rescheduleDate ? (
                  <TouchableOpacity
                    style={[styles.cta, { backgroundColor: colors.primary }]}
                    onPress={() => setRescheduleStep("slot")}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.ctaText}>Pick a Time</Text>
                    <Feather name="arrow-right" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                ) : null}
              </>
            )}

            {rescheduleStep === "slot" && (
              <>
                <Text style={[styles.stepTitle, { color: colors.foreground }]}>Choose a time</Text>
                <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
                  {formatDateFull(rescheduleDate)}
                </Text>
                {reschedSlots.length === 0 ? (
                  <View style={styles.noSlots}>
                    <Feather name="clock" size={36} color={colors.mutedForeground} />
                    <Text style={[styles.noSlotsTitle, { color: colors.foreground }]}>No slots available</Text>
                    <Text style={[styles.noSlotsSub, { color: colors.mutedForeground }]}>
                      All times are taken for this day.
                    </Text>
                    <TouchableOpacity onPress={() => setRescheduleStep("date")}>
                      <Text style={[styles.linkText, { color: colors.primary }]}>Choose a different date</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={styles.slotGrid}>
                      {reschedSlots.map((slot, i) => {
                        const sel = rescheduleSlot?.startTime === slot.startTime;
                        return (
                          <TouchableOpacity
                            key={i}
                            style={[
                              styles.slotCard,
                              {
                                width: slotCardW,
                                backgroundColor: sel ? colors.primary : colors.card,
                                borderColor: sel ? colors.primary : colors.border,
                              },
                            ]}
                            onPress={() => {
                              setRescheduleSlot(slot);
                              Haptics.selectionAsync();
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.slotStart, { color: sel ? "#FFFFFF" : colors.foreground }]}>
                              {formatTime12(slot.startTime)}
                            </Text>
                            <Text style={[styles.slotEnd, { color: sel ? "rgba(255,255,255,0.6)" : colors.mutedForeground }]}>
                              – {formatTime12(slot.endTime)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {rescheduleSlot ? (
                      <TouchableOpacity
                        style={[styles.cta, { backgroundColor: colors.primary, opacity: updating ? 0.6 : 1 }]}
                        onPress={confirmReschedule}
                        disabled={updating}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.ctaText}>Confirm Reschedule</Text>
                        <Feather name="check" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                    ) : null}
                  </>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Waiver viewer modal */}
      <Modal
        visible={showWaiverModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowWaiverModal(false); setWaiverData(null); setWaiverError(null); }}
      >
        <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => { setShowWaiverModal(false); setWaiverData(null); setWaiverError(null); }}
              activeOpacity={0.7}
            >
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Signed Waiver</Text>
            <View style={{ width: 30 }} />
          </View>
          <ScrollView contentContainerStyle={styles.waiverModalContent} showsVerticalScrollIndicator={false}>
            {waiverLoading ? (
              <View style={styles.waiverCenter}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.waiverLoadingText, { color: colors.mutedForeground }]}>Loading waiver…</Text>
              </View>
            ) : waiverError ? (
              <View style={styles.waiverCenter}>
                <Feather name="alert-circle" size={40} color={colors.destructive} />
                <Text style={[styles.waiverErrorTitle, { color: colors.foreground }]}>Could not load waiver</Text>
                <Text style={[styles.waiverErrorSub, { color: colors.mutedForeground }]}>{waiverError}</Text>
              </View>
            ) : waiverData ? (
              <>
                <View style={[styles.waiverInfoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.waiverInfoRow}>
                    <Feather name="user" size={15} color={colors.mutedForeground} />
                    <View style={styles.waiverInfoTextWrap}>
                      <Text style={[styles.waiverInfoLabel, { color: colors.mutedForeground }]}>Client</Text>
                      <Text style={[styles.waiverInfoValue, { color: colors.foreground }]}>{waiverData.clientName}</Text>
                    </View>
                  </View>
                  <View style={[styles.waiverInfoDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.waiverInfoRow}>
                    <Feather name="mail" size={15} color={colors.mutedForeground} />
                    <View style={styles.waiverInfoTextWrap}>
                      <Text style={[styles.waiverInfoLabel, { color: colors.mutedForeground }]}>Email</Text>
                      <Text style={[styles.waiverInfoValue, { color: colors.foreground }]}>{waiverData.clientEmail}</Text>
                    </View>
                  </View>
                  <View style={[styles.waiverInfoDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.waiverInfoRow}>
                    <Feather name="clock" size={15} color={colors.mutedForeground} />
                    <View style={styles.waiverInfoTextWrap}>
                      <Text style={[styles.waiverInfoLabel, { color: colors.mutedForeground }]}>Signed</Text>
                      <Text style={[styles.waiverInfoValue, { color: colors.foreground }]}>
                        {new Date(waiverData.signedAt).toLocaleString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={[styles.waiverSigLabel, { color: colors.mutedForeground }]}>SIGNATURE</Text>
                <View style={[styles.waiverSigBox, { backgroundColor: "#FFFFFF", borderColor: colors.border }]}>
                  <Image
                    source={{ uri: waiverData.signatureData }}
                    style={styles.waiverSigImage}
                    resizeMode="contain"
                  />
                </View>

                <View style={[styles.waiverLegalNote, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Feather name="shield" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.waiverLegalText, { color: colors.mutedForeground }]}>
                    This waiver was digitally signed by the client and is recorded for legal recordkeeping purposes.
                  </Text>
                </View>
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  colors,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={styles.infoRow}>
      <Feather name={icon} size={15} color={colors.mutedForeground} />
      <Text style={[styles.infoText, { color: colors.foreground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  deleteHeaderBtn: { padding: 4 },
  content: { padding: 20, gap: 14 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  cardTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  clientBookedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
  },
  clientBookedText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  clientTop: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 4 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#FFFFFF" },
  clientInfo: { flex: 1, gap: 6 },
  clientName: { fontSize: 20, fontFamily: "Inter_700Bold" },
  savingRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  savingSpinner: { transform: [{ scale: 0.65 }] },
  savingText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoText: { fontSize: 15, fontFamily: "Inter_400Regular", flex: 1 },
  notesText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  notesPlaceholder: { fontSize: 14, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  notesHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  editNoteBtn: { flexDirection: "row", alignItems: "center", gap: 4, padding: 4 },
  editNoteBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  notesInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    minHeight: 90,
  },
  notesActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  notesCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  notesCancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  notesSaveBtn: {
    flex: 2,
    flexDirection: "row",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  notesSaveText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  fieldEditWrap: { gap: 8 },
  fieldInputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  fieldIcon: { flexShrink: 0 },
  fieldInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  fieldInputInline: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  fieldActions: { flexDirection: "row", gap: 8 },
  fieldCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldCancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  fieldSaveBtn: {
    flex: 2,
    flexDirection: "row",
    borderRadius: 9,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  fieldSaveText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  addFieldBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 2 },
  addFieldText: { fontSize: 14, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  fieldErrorText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#FF3B30" },
  paymentBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 2,
  },
  paymentText: { fontSize: 12, fontFamily: "Inter_600SemiBold", flex: 1 },
  rescheduledBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 2,
  },
  rescheduledText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  waiverBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 2,
  },
  waiverText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  rescheduleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  rescheduleBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  actions: { gap: 10 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 12,
    gap: 8,
  },
  actionText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    marginTop: 4,
  },
  deleteBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
  notFoundText: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  link: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  // Modal styles
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  modalContent: { paddingHorizontal: 20, paddingTop: 16 },
  stepIndicator: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 16 },
  stepDot: { height: 6, borderRadius: 3 },
  stepTitle: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 4 },
  stepSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 16 },
  dateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 20 },
  dateCard: {
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    paddingVertical: 6,
  },
  dateDay: { fontSize: 10, fontFamily: "Inter_500Medium" },
  dateNum: { fontSize: 15, fontFamily: "Inter_700Bold" },
  dateMon: { fontSize: 9, fontFamily: "Inter_400Regular" },
  todayDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12, marginBottom: 20 },
  slotCard: { paddingVertical: 18, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  slotStart: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  slotEnd: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  noSlots: { alignItems: "center", paddingVertical: 40, gap: 10 },
  noSlotsTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  noSlotsSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  linkText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  linkCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  linkUrl: { fontSize: 12, fontFamily: "Inter_400Regular" },
  linkActions: { flexDirection: "row", gap: 10 },
  linkBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  linkBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 2,
  },
  ctaText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  editableInfoRow: { flexDirection: "row", alignItems: "center" },
  editRowIcon: { marginLeft: 6, flexShrink: 0 },
  inlinePickerWrap: { gap: 10 },
  inlinePickerHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  inlinePickerLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  inlineDateGrid: { flexDirection: "row", flexWrap: "wrap" },
  inlineDateCard: {
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    paddingVertical: 4,
  },
  inlineSlotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  inlineSlotCard: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    minWidth: 100,
  },
  inlineNoSlots: { fontSize: 13, fontFamily: "Inter_400Regular", fontStyle: "italic", paddingVertical: 4 },
  inlineDateWarning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  inlineDateWarningText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1, lineHeight: 17 },
  waiverModalContent: { padding: 20, gap: 16 },
  waiverCenter: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 14 },
  waiverLoadingText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  waiverErrorTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  waiverErrorSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 20 },
  waiverInfoCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  waiverInfoRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  waiverInfoTextWrap: { flex: 1 },
  waiverInfoLabel: { fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 2 },
  waiverInfoValue: { fontSize: 15, fontFamily: "Inter_400Regular" },
  waiverInfoDivider: { height: 1 },
  waiverSigLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: -8 },
  waiverSigBox: { borderRadius: 14, borderWidth: 1, padding: 12, alignItems: "center", justifyContent: "center" },
  waiverSigImage: { width: "100%", height: 180 },
  waiverLegalNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, borderWidth: 1, padding: 12 },
  waiverLegalText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
