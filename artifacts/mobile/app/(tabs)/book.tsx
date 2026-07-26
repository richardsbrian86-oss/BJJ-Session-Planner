import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Service, useServices } from "@/context/ServicesContext";
import { TimeSlot, useScheduler } from "@/context/SchedulerContext";
import { useColors } from "@/hooks/useColors";

type Step = 1 | 2 | 3 | 4 | 5;

const PACKAGE_OPTIONS: { count: number; label: string }[] = [
  { count: 1,  label: "Single" },
  { count: 4,  label: "4-Session Pack" },
  { count: 6,  label: "6-Session Pack" },
  { count: 8,  label: "8-Session Pack" },
  { count: 10, label: "10-Session Pack" },
];

const PACKAGE_DISCOUNT = 0.20; // 20% off all multi-session packages

function calcPackageTotal(count: number, pricePerSession: number): number {
  const full = count * pricePerSession;
  return count > 1 ? full * (1 - PACKAGE_DISCOUNT) : full;
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

function formatTime12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function formatDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

// Steps shown in the indicator (step 5 is success, not shown)
const STEPS = ["Service", "Date", "Time", "Details"];

export default function BookScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: screenW } = useWindowDimensions();
  const { getAvailableSlotsForDate, availability, addSession } = useScheduler();
  const { services } = useServices();

  const [step, setStep] = useState<Step>(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedPackageCount, setSelectedPackageCount] = useState<number>(1);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = getTodayStr();
  const HPAD = 20;
  const GAP = 6;
  const COLS = 7;
  const dateCardW = Math.floor((screenW - HPAD * 2 - GAP * (COLS - 1)) / COLS);
  const slotCardW = Math.floor((screenW - HPAD * 2 - 10) / 2);

  const dates = useMemo(() => {
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

  const availableSlots = useMemo(() => {
    if (!selectedDate) return [];
    return getAvailableSlotsForDate(selectedDate);
  }, [selectedDate, getAvailableSlotsForDate]);

  function goBack() { setStep((s) => (s - 1) as Step); }

  function handleDateSelect(dateStr: string, has: boolean) {
    if (!has) return;
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    Haptics.selectionAsync();
  }

  function handleSlotSelect(slot: TimeSlot) {
    setSelectedSlot(slot);
    Haptics.selectionAsync();
  }

  async function handleSubmit() {
    if (!clientName.trim()) {
      Alert.alert("Required", "Please enter the client's name.");
      return;
    }
    if (!selectedDate || !selectedSlot) return;
    setIsSubmitting(true);
    try {
      const pkgCount = selectedService && selectedPackageCount > 1 ? selectedPackageCount : undefined;
      const pkgTotal = pkgCount && selectedService
        ? calcPackageTotal(pkgCount, selectedService.price)
        : undefined;
      await addSession({
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        clientEmail: clientEmail.trim() || undefined,
        date: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        status: "pending",
        notes: notes.trim() || undefined,
        serviceName: selectedService?.name,
        servicePrice: selectedService?.price,
        packageCount: pkgCount,
        packageTotal: pkgTotal,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep(5);
    } catch {
      Alert.alert("Error", "Failed to book session. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function reset() {
    setSelectedService(null); setSelectedPackageCount(1); setSelectedDate("");
    setSelectedSlot(null); setClientName(""); setClientPhone("");
    setClientEmail(""); setNotes(""); setStep(1);
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 82 : insets.bottom + 20;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        {step > 1 && step < 5 ? (
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: colors.secondary }]}
            onPress={goBack}
          >
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtnPlaceholder} />
        )}
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Book Session</Text>
        <View style={styles.backBtnPlaceholder} />
      </View>

      {/* Step indicator */}
      {step < 5 && (
        <View style={styles.stepWrap}>
          {STEPS.map((label, i) => {
            const s = i + 1;
            const active = s === step;
            const done = s < step;
            return (
              <React.Fragment key={label}>
                <View style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepCircle,
                      {
                        backgroundColor: done
                          ? colors.primary
                          : active
                          ? colors.primary + "22"
                          : colors.secondary,
                        borderColor: done || active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    {done ? (
                      <Feather name="check" size={11} color="#FFFFFF" />
                    ) : (
                      <Text style={[styles.stepNum, { color: active ? colors.primary : colors.mutedForeground }]}>
                        {s}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      {
                        color: active ? colors.foreground : colors.mutedForeground,
                        fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </View>
                {i < STEPS.length - 1 && (
                  <View style={[styles.stepLine, { backgroundColor: done ? colors.primary : colors.border }]} />
                )}
              </React.Fragment>
            );
          })}
        </View>
      )}

      {/* ── STEP 1: Service + Package ── */}
      {step === 1 && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>Choose a service</Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
            Select a training type, then pick a package.
          </Text>

          {services.length === 0 ? (
            <View style={styles.noServices}>
              <View style={[styles.noServicesIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="dollar-sign" size={28} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.noServicesTitle, { color: colors.foreground }]}>No services set up</Text>
              <Text style={[styles.noServicesSub, { color: colors.mutedForeground }]}>
                Add services in the Services tab to enable packages. You can still book without one.
              </Text>
              <TouchableOpacity
                style={[styles.cta, { backgroundColor: colors.primary }]}
                onPress={() => setStep(2)}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaText}>Skip · Pick a Date</Text>
                <Feather name="arrow-right" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.serviceList}>
              {/* Service cards */}
              {services.map((svc) => {
                const sel = selectedService?.id === svc.id;
                return (
                  <TouchableOpacity
                    key={svc.id}
                    style={[
                      styles.serviceCard,
                      {
                        backgroundColor: sel ? colors.primary + "18" : colors.card,
                        borderColor: sel ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => {
                      setSelectedService(svc);
                      setSelectedPackageCount(1);
                      Haptics.selectionAsync();
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.serviceIcon, { backgroundColor: sel ? colors.primary : colors.secondary }]}>
                      <Feather name="award" size={18} color={sel ? "#FFFFFF" : colors.mutedForeground} />
                    </View>
                    <View style={styles.serviceBody}>
                      <Text style={[styles.serviceName, { color: colors.foreground }]}>{svc.name}</Text>
                      <Text style={[styles.servicePrice, { color: sel ? colors.primary : colors.mutedForeground }]}>
                        ${svc.price.toFixed(2)} / session
                      </Text>
                    </View>
                    {sel && <Feather name="check-circle" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}

              {/* Package selection — shown once a service is chosen */}
              {selectedService && (
                <View style={styles.packageSection}>
                  <Text style={[styles.packageSectionTitle, { color: colors.foreground }]}>
                    Choose a package
                  </Text>
                  <Text style={[styles.packageSectionSub, { color: colors.mutedForeground }]}>
                    Multi-session packs save 20% off the regular rate.
                  </Text>
                  <View style={styles.packageGrid}>
                    {PACKAGE_OPTIONS.map((opt) => {
                      const sel = selectedPackageCount === opt.count;
                      const fullTotal = opt.count * selectedService.price;
                      const discountedTotal = calcPackageTotal(opt.count, selectedService.price);
                      const isPkg = opt.count > 1;
                      return (
                        <TouchableOpacity
                          key={opt.count}
                          style={[
                            styles.packageCard,
                            {
                              backgroundColor: sel ? colors.primary + "18" : colors.card,
                              borderColor: sel ? colors.primary : colors.border,
                            },
                          ]}
                          onPress={() => {
                            setSelectedPackageCount(opt.count);
                            Haptics.selectionAsync();
                          }}
                          activeOpacity={0.7}
                        >
                          {/* Save badge — top-right corner */}
                          {isPkg && (
                            <View style={[styles.discountBadge, { backgroundColor: "#34C759" }]}>
                              <Text style={styles.discountBadgeText}>–20%</Text>
                            </View>
                          )}

                          <View style={styles.packageCardTop}>
                            <Text style={[styles.packageCount, { color: sel ? colors.primary : colors.foreground }]}>
                              {opt.count}
                            </Text>
                            <Text style={[styles.packageLabel, { color: sel ? colors.primary : colors.mutedForeground }]}>
                              {opt.count === 1 ? "session" : "sessions"}
                            </Text>
                          </View>

                          {/* Discounted total */}
                          <Text style={[styles.packageTotal, { color: sel ? colors.primary : colors.foreground }]}>
                            ${discountedTotal.toFixed(2)}
                          </Text>

                          {/* Original total (strikethrough) + per-session */}
                          {isPkg && (
                            <Text style={[styles.packageOriginalTotal, { color: colors.mutedForeground }]}>
                              ${fullTotal.toFixed(2)}
                            </Text>
                          )}
                          {isPkg && (
                            <Text style={[styles.packagePerSession, { color: colors.mutedForeground }]}>
                              ${(discountedTotal / opt.count).toFixed(2)} / session
                            </Text>
                          )}

                          {sel && (
                            <View style={[styles.packageCheck, { backgroundColor: colors.primary }]}>
                              <Feather name="check" size={9} color="#FFFFFF" />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={styles.skipLink}
                onPress={() => { setSelectedService(null); setSelectedPackageCount(1); setStep(2); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.skipText, { color: colors.mutedForeground }]}>
                  Skip — book without a service
                </Text>
              </TouchableOpacity>

              {selectedService && (
                <TouchableOpacity
                  style={[styles.cta, { backgroundColor: colors.primary }]}
                  onPress={() => setStep(2)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.ctaText}>Next · Pick a Date</Text>
                  <Feather name="arrow-right" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── STEP 2: Date ── */}
      {step === 2 && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>Pick a date</Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
            {selectedService ? `${selectedService.name} · $${selectedService.price.toFixed(2)}` : "Available training days are highlighted"}
          </Text>
          <View style={styles.dateGrid}>
            {dates.map(({ dateStr, dayName, dayNum, month, hasAvailability, isToday }) => {
              const sel = dateStr === selectedDate;
              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[
                    styles.dateCard,
                    {
                      width: dateCardW,
                      height: Math.round(dateCardW * 1.5),
                      backgroundColor: sel ? colors.primary : colors.card,
                      borderColor: sel ? colors.primary : hasAvailability ? colors.border : "transparent",
                      opacity: hasAvailability ? 1 : 0.22,
                    },
                  ]}
                  onPress={() => handleDateSelect(dateStr, hasAvailability)}
                  disabled={!hasAvailability}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dateDay, { color: sel ? "rgba(255,255,255,0.7)" : colors.mutedForeground }]}>{dayName}</Text>
                  <Text style={[styles.dateNum, { color: sel ? "#FFFFFF" : colors.foreground }]}>{dayNum}</Text>
                  <Text style={[styles.dateMon, { color: sel ? "rgba(255,255,255,0.5)" : colors.mutedForeground }]}>{month}</Text>
                  {isToday && <View style={[styles.todayDot, { backgroundColor: sel ? "#FFFFFF" : colors.primary }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedDate && (
            <TouchableOpacity style={[styles.cta, { backgroundColor: colors.primary }]} onPress={() => setStep(3)} activeOpacity={0.85}>
              <Text style={styles.ctaText}>Choose Time</Text>
              <Feather name="arrow-right" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* ── STEP 3: Time slot ── */}
      {step === 3 && (
        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>Pick a time</Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>{formatDateLong(selectedDate)}</Text>
          {availableSlots.length === 0 ? (
            <View style={styles.noSlots}>
              <View style={[styles.noSlotsIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="clock" size={28} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.noSlotsTitle, { color: colors.foreground }]}>All slots booked</Text>
              <Text style={[styles.noSlotsSub, { color: colors.mutedForeground }]}>No available times for this date.</Text>
              <TouchableOpacity style={[styles.outlineBtn, { borderColor: colors.border }]} onPress={() => setStep(2)}>
                <Text style={[styles.outlineBtnText, { color: colors.foreground }]}>Pick a different date</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.slotGrid}>
                {availableSlots.map((slot, i) => {
                  const sel = selectedSlot?.startTime === slot.startTime;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.slotCard, { width: slotCardW, backgroundColor: sel ? colors.primary : colors.card, borderColor: sel ? colors.primary : colors.border }]}
                      onPress={() => handleSlotSelect(slot)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.slotStart, { color: sel ? "#FFFFFF" : colors.foreground }]}>{formatTime12(slot.startTime)}</Text>
                      <Text style={[styles.slotEnd, { color: sel ? "rgba(255,255,255,0.6)" : colors.mutedForeground }]}>→ {formatTime12(slot.endTime)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {selectedSlot && (
                <TouchableOpacity style={[styles.cta, { backgroundColor: colors.primary }]} onPress={() => setStep(4)} activeOpacity={0.85}>
                  <Text style={styles.ctaText}>Client Details</Text>
                  <Feather name="arrow-right" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* ── STEP 4: Client info ── */}
      {step === 4 && (
        <KeyboardAwareScrollViewCompat
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          bottomOffset={16}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>Client details</Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
            {formatDateLong(selectedDate)} at {formatTime12(selectedSlot!.startTime)}
            {selectedService ? ` · ${selectedService.name}` : ""}
          </Text>

          {/* Summary card */}
          {selectedService && (() => {
            const isPkg = selectedPackageCount > 1;
            const fullTotal = selectedPackageCount * selectedService.price;
            const discountedTotal = calcPackageTotal(selectedPackageCount, selectedService.price);
            const saved = fullTotal - discountedTotal;
            return (
              <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Service</Text>
                  <Text style={[styles.summaryValue, { color: colors.foreground }]}>{selectedService.name}</Text>
                </View>
                {isPkg && (
                  <>
                    <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Package</Text>
                      <Text style={[styles.summaryValue, { color: colors.foreground }]}>
                        {selectedPackageCount}-Session Pack
                      </Text>
                    </View>
                    <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Regular price</Text>
                      <Text style={[styles.summaryValue, styles.summaryStrike, { color: colors.mutedForeground }]}>
                        ${fullTotal.toFixed(2)}
                      </Text>
                    </View>
                    <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.summaryRow}>
                      <View style={[styles.discountRowBadge, { backgroundColor: "#34C75920" }]}>
                        <Text style={[styles.discountRowBadgeText, { color: "#34C759" }]}>20% discount</Text>
                      </View>
                      <Text style={[styles.summaryValue, { color: "#34C759" }]}>–${saved.toFixed(2)}</Text>
                    </View>
                  </>
                )}
                <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
                    {isPkg ? "Total" : "Price"}
                  </Text>
                  <Text style={[styles.summaryPrice, { color: colors.primary }]}>
                    ${discountedTotal.toFixed(2)}
                  </Text>
                </View>
              </View>
            );
          })()}

          <View style={styles.form}>
            <FormField label="Full Name *" colors={colors}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground }]}
                placeholder="e.g. Alex Johnson"
                placeholderTextColor={colors.mutedForeground}
                value={clientName}
                onChangeText={setClientName}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </FormField>
            <FormField label="Phone Number" colors={colors}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground }]}
                placeholder="e.g. (555) 123-4567"
                placeholderTextColor={colors.mutedForeground}
                value={clientPhone}
                onChangeText={setClientPhone}
                keyboardType="phone-pad"
              />
            </FormField>
            <FormField label="Email Address" colors={colors}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground }]}
                placeholder="e.g. alex@email.com (optional)"
                placeholderTextColor={colors.mutedForeground}
                value={clientEmail}
                onChangeText={setClientEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </FormField>
            <FormField label="Notes" colors={colors}>
              <TextInput
                style={[styles.input, styles.notesInput, { backgroundColor: colors.secondary, color: colors.foreground }]}
                placeholder="Rank, goals, focus areas... (optional)"
                placeholderTextColor={colors.mutedForeground}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </FormField>
          </View>

          <TouchableOpacity
            style={[styles.cta, { backgroundColor: colors.primary, opacity: isSubmitting ? 0.7 : 1 }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.ctaText}>Confirm Booking</Text>
                <Feather name="check" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </KeyboardAwareScrollViewCompat>
      )}

      {/* ── STEP 5: Success ── */}
      {step === 5 && (
        <View style={[styles.successWrap, { paddingBottom: bottomPad }]}>
          <View style={[styles.successRing, { borderColor: "#34C75940" }]}>
            <View style={[styles.successIcon, { backgroundColor: "#34C75918" }]}>
              <Feather name="check" size={44} color="#34C759" />
            </View>
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>Booked!</Text>
          <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
            {clientName} · {formatDateLong(selectedDate)}{"\n"}
            {formatTime12(selectedSlot!.startTime)} – {formatTime12(selectedSlot!.endTime)}
            {selectedService
              ? selectedPackageCount > 1
                ? `\n${selectedService.name} · ${selectedPackageCount}-Session Pack\n$${calcPackageTotal(selectedPackageCount, selectedService.price).toFixed(2)} (20% off)`
                : `\n${selectedService.name} · $${selectedService.price.toFixed(2)}`
              : ""}
          </Text>
          <View style={styles.successBtns}>
            <TouchableOpacity style={[styles.cta, { backgroundColor: colors.primary }]} onPress={reset} activeOpacity={0.85}>
              <Text style={styles.ctaText}>Book Another</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cta, { backgroundColor: colors.secondary }]} onPress={() => { reset(); router.push("/"); }} activeOpacity={0.85}>
              <Text style={[styles.ctaText, { color: colors.foreground }]}>View Schedule</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function FormField({ label, children, colors }: { label: string; children: React.ReactNode; colors: ReturnType<typeof import("@/hooks/useColors").useColors>; }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 16,
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  backBtnPlaceholder: { width: 36 },
  stepWrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingVertical: 14, marginBottom: 4 },
  stepItem: { alignItems: "center", gap: 5 },
  stepCircle: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  stepNum: { fontSize: 12, fontFamily: "Inter_700Bold" },
  stepLabel: { fontSize: 10 },
  stepLine: { flex: 1, height: 1.5, marginBottom: 18, marginHorizontal: 5 },
  scroll: { flex: 1, paddingHorizontal: 20 },
  stepTitle: { fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 4, marginBottom: 4 },
  stepSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 20 },
  serviceList: { gap: 10 },
  serviceCard: { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1.5, padding: 16, gap: 14 },
  serviceIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  serviceBody: { flex: 1, gap: 4 },
  serviceName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  servicePrice: { fontSize: 20, fontFamily: "Inter_700Bold" },
  skipLink: { alignItems: "center", paddingVertical: 12 },
  skipText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  noServices: { alignItems: "center", paddingVertical: 40, gap: 12 },
  noServicesIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  noServicesTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  noServicesSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22, maxWidth: 280 },
  dateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 24 },
  dateCard: { borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 1, paddingVertical: 6 },
  dateDay: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
  dateNum: { fontSize: 16, fontFamily: "Inter_700Bold" },
  dateMon: { fontSize: 9, fontFamily: "Inter_400Regular" },
  todayDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  slotCard: { paddingVertical: 20, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, alignItems: "center", gap: 4 },
  slotStart: { fontSize: 16, fontFamily: "Inter_700Bold" },
  slotEnd: { fontSize: 12, fontFamily: "Inter_400Regular" },
  noSlots: { alignItems: "center", paddingVertical: 40, gap: 12 },
  noSlotsIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  noSlotsTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  noSlotsSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  outlineBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, borderWidth: 1, marginTop: 4 },
  outlineBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  summaryCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 20, gap: 10 },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  summaryLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  summaryValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1, textAlign: "right" },
  summaryPrice: { fontSize: 20, fontFamily: "Inter_700Bold" },
  summaryDivider: { height: 1 },
  form: { gap: 16, marginBottom: 24 },
  field: { gap: 8 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3, textTransform: "uppercase" },
  input: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: "Inter_400Regular" },
  notesInput: { height: 100, paddingTop: 14 },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 14, gap: 8, marginBottom: 4 },
  ctaText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  successWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 16 },
  successRing: { width: 120, height: 120, borderRadius: 60, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  successIcon: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center" },
  successTitle: { fontSize: 30, fontFamily: "Inter_700Bold" },
  successSub: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 24 },
  successBtns: { width: "100%", gap: 10, marginTop: 8 },
  packageSection: { gap: 10, marginTop: 6 },
  packageSectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  packageSectionSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 4 },
  packageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  packageCard: {
    width: "47%",
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    gap: 3,
    position: "relative",
  },
  packageCardTop: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  packageCount: { fontSize: 28, fontFamily: "Inter_700Bold" },
  packageLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  packageTotal: { fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 2 },
  packagePerSession: { fontSize: 11, fontFamily: "Inter_400Regular" },
  packageCheck: {
    position: "absolute", top: 10, right: 10,
    width: 18, height: 18, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },
  packageOriginalTotal: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textDecorationLine: "line-through",
  },
  discountBadge: {
    position: "absolute", top: 8, right: 8,
    borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2,
  },
  discountBadgeText: {
    fontSize: 10, fontFamily: "Inter_700Bold", color: "#FFFFFF",
  },
  summaryStrike: {
    textDecorationLine: "line-through",
  },
  discountRowBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  discountRowBadgeText: {
    fontSize: 12, fontFamily: "Inter_600SemiBold",
  },
});
