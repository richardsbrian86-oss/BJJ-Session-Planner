import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
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

import { api, ApiPublicProfile, ApiService } from "@/utils/apiClient";
import { useColors } from "@/hooks/useColors";
import { PaymentStep } from "./PaymentStep";

type Step = "code" | "service" | "date" | "time" | "details" | "payment" | "success";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const PACKAGE_OPTIONS = [
  { count: 1, label: "Single" },
  { count: 4, label: "4-Session Pack" },
  { count: 6, label: "6-Session Pack" },
  { count: 8, label: "8-Session Pack" },
  { count: 10, label: "10-Session Pack" },
];
const PACKAGE_DISCOUNT = 0.2;

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

function calcPackageTotal(count: number, price: number): number {
  const full = count * price;
  return count > 1 ? Math.round(full * (1 - PACKAGE_DISCOUNT)) : full;
}

interface Props {
  onSwitchToInstructor: () => void;
}

export function ClientBookingFlow({ onSwitchToInstructor }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();

  const [step, setStep] = useState<Step>("code");
  const [slugInput, setSlugInput] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profile, setProfile] = useState<ApiPublicProfile | null>(null);

  const [selectedService, setSelectedService] = useState<ApiService | null>(null);
  const [packageCount, setPackageCount] = useState(1);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bookedSession, setBookedSession] = useState<{ date: string; time: string; serviceName: string; cancellationToken?: string | null; amountPaid?: number } | null>(null);

  const [pendingClientSecret, setPendingClientSecret] = useState<string | null>(null);
  const [pendingPaymentAmount, setPendingPaymentAmount] = useState<number>(0);

  const [stripePublishableKey, setStripePublishableKey] = useState("");

  useEffect(() => {
    api.public.getStripeKey()
      .then((data) => { if (data.publishableKey) setStripePublishableKey(data.publishableKey); })
      .catch(() => {});
  }, []);

  const today = getTodayStr();
  const HPAD = 20;
  const GAP = 6;
  const COLS = 7;
  const dateCardW = Math.floor((screenW - HPAD * 2 - GAP * (COLS - 1)) / COLS);
  const slotCardW = Math.floor((screenW - HPAD * 2 - 10) / 2);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 104 : insets.bottom + 20;

  const dates = useMemo(() => {
    if (!profile) return [];
    return Array.from({ length: 35 }, (_, i) => {
      const dateStr = addDays(today, i);
      const [y, m, d] = dateStr.split("-").map(Number);
      const dow = new Date(y, m - 1, d).getDay();
      const avail = profile.availability.find(
        (a) => a.day === String(dow) && a.enabled
      );
      return {
        dateStr,
        dayName: DAY_NAMES[dow],
        dayNum: d,
        month: MONTH_NAMES[m - 1],
        hasAvailability: !!avail,
        isToday: i === 0,
      };
    });
  }, [today, profile]);

  async function handleFetchProfile() {
    const slug = slugInput.trim().toLowerCase();
    if (!slug) return;
    setLoadingProfile(true);
    try {
      const p = await api.public.getProfile(slug);
      setProfile(p);
      setStep("service");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Instructor not found";
      Alert.alert("Not Found", msg);
    } finally {
      setLoadingProfile(false);
    }
  }

  async function handleDateSelect(dateStr: string) {
    if (!profile) return;
    setSelectedDate(dateStr);
    setSelectedTime("");
    setLoadingSlots(true);
    try {
      const res = await api.public.getSlots(profile.instructor.slug, dateStr);
      setAvailableSlots(res.slots);
      setStep("time");
    } catch {
      Alert.alert("Error", "Could not load available slots.");
    } finally {
      setLoadingSlots(false);
    }
  }

  async function handleSubmit() {
    if (!clientName.trim()) {
      Alert.alert("Required", "Please enter your name.");
      return;
    }
    if (!profile || !selectedDate || !selectedTime) return;

    setSubmitting(true);

    if (selectedService) {
      try {
        const intent = await api.public.createIntent(profile.instructor.slug, {
          serviceId: selectedService.id,
          packageCount,
          clientName: clientName.trim(),
        });
        if (intent.clientSecret && intent.id && stripePublishableKey) {
          const total = calcPackageTotal(packageCount, selectedService.price);
          setPendingClientSecret(intent.clientSecret);
          setPendingPaymentAmount(total);
          setStep("payment");
          setSubmitting(false);
          return;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (!msg.includes("not configured") && !msg.includes("503") && !msg.includes("payment configuration")) {
          Alert.alert("Error", msg || "Could not initiate payment. Please try again.");
          setSubmitting(false);
          return;
        }
      }
    }

    await doCreateSession();
  }

  async function doCreateSession(paymentIntentId?: string, amountPaid?: number) {
    if (!profile || !selectedDate || !selectedTime) return;
    setSubmitting(true);
    try {
      const session = await api.public.createSession(profile.instructor.slug, {
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
        date: selectedDate,
        time: selectedTime,
        serviceId: selectedService?.id,
        packageCount: selectedService ? packageCount : undefined,
        notes: notes.trim() || undefined,
        paymentIntentId,
      });
      setBookedSession({
        date: session.date,
        time: session.time,
        serviceName: session.serviceName,
        cancellationToken: session.cancellationToken,
        amountPaid,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Booking failed. Please try again.";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePaymentSuccess(paymentIntentId: string) {
    await doCreateSession(paymentIntentId, pendingPaymentAmount);
  }

  function reset() {
    setStep("code");
    setSlugInput("");
    setProfile(null);
    setSelectedService(null);
    setPackageCount(1);
    setSelectedDate("");
    setSelectedTime("");
    setClientName("");
    setClientEmail("");
    setClientPhone("");
    setNotes("");
    setBookedSession(null);
    setPendingClientSecret(null);
    setPendingPaymentAmount(0);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
        <Image
          source={require("@/assets/images/logo.png") as number}
          style={styles.brandLogo}
          resizeMode="contain"
        />
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {step === "code" ? "Book a Session" : profile?.instructor.name ?? "Book a Session"}
        </Text>
        <TouchableOpacity onPress={onSwitchToInstructor} style={styles.switchBtn}>
          <Text style={[styles.switchText, { color: colors.mutedForeground }]}>Instructor?</Text>
        </TouchableOpacity>
      </View>

      {/* CODE step */}
      {step === "code" && (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>Enter instructor code</Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
            Ask your instructor for their booking code or link
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
            placeholder="e.g. coach-alex"
            placeholderTextColor={colors.mutedForeground}
            value={slugInput}
            onChangeText={setSlugInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={handleFetchProfile}
          />
          <TouchableOpacity
            style={[styles.cta, { backgroundColor: colors.primary, opacity: slugInput.trim() ? 1 : 0.45 }]}
            onPress={handleFetchProfile}
            disabled={!slugInput.trim() || loadingProfile}
            activeOpacity={0.85}
          >
            {loadingProfile ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.ctaText}>Find Instructor</Text>
                <Feather name="arrow-right" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* SERVICE step */}
      {step === "service" && profile && (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>Choose a service</Text>
          {profile.services.map((svc) => {
            const sel = selectedService?.id === svc.id;
            return (
              <TouchableOpacity
                key={svc.id}
                style={[styles.serviceCard, { backgroundColor: sel ? colors.primary + "18" : colors.card, borderColor: sel ? colors.primary : colors.border }]}
                onPress={() => { setSelectedService(svc); setPackageCount(1); Haptics.selectionAsync(); }}
                activeOpacity={0.7}
              >
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

          {selectedService && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Package</Text>
              <View style={styles.packageGrid}>
                {PACKAGE_OPTIONS.map((opt) => {
                  const sel = packageCount === opt.count;
                  const total = calcPackageTotal(opt.count, selectedService.price);
                  return (
                    <TouchableOpacity
                      key={opt.count}
                      style={[styles.packageCard, { backgroundColor: sel ? colors.primary + "18" : colors.card, borderColor: sel ? colors.primary : colors.border }]}
                      onPress={() => { setPackageCount(opt.count); Haptics.selectionAsync(); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.packageCount, { color: sel ? colors.primary : colors.foreground }]}>{opt.count}</Text>
                      <Text style={[styles.packageLabel, { color: sel ? colors.primary : colors.mutedForeground }]}>
                        {opt.count === 1 ? "session" : "sessions"}
                      </Text>
                      <Text style={[styles.packageTotal, { color: sel ? colors.primary : colors.foreground }]}>
                        ${total.toFixed(2)}
                      </Text>
                      {opt.count > 1 && (
                        <View style={[styles.discountBadge, { backgroundColor: "#34C759" }]}>
                          <Text style={styles.discountText}>–20%</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {selectedService && (
            <TouchableOpacity
              style={[styles.cta, { backgroundColor: colors.primary }]}
              onPress={() => setStep("date")}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaText}>Choose Date</Text>
              <Feather name="arrow-right" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {!profile?.stripeEnabled && (
            <TouchableOpacity
              style={styles.skipLink}
              onPress={() => { setSelectedService(null); setPackageCount(1); setStep("date"); }}
            >
              <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip — book without a service</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* DATE step */}
      {step === "date" && (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>Pick a date</Text>
          {loadingSlots && <ActivityIndicator color={colors.primary} />}
          <View style={styles.dateGrid}>
            {dates.map(({ dateStr, dayName, dayNum, month, hasAvailability, isToday }) => {
              const sel = dateStr === selectedDate;
              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[styles.dateCard, {
                    width: dateCardW,
                    height: Math.round(dateCardW * 1.5),
                    backgroundColor: sel ? colors.primary : colors.card,
                    borderColor: sel ? colors.primary : hasAvailability ? colors.border : "transparent",
                    opacity: hasAvailability ? 1 : 0.22,
                  }]}
                  onPress={() => hasAvailability && handleDateSelect(dateStr)}
                  disabled={!hasAvailability || loadingSlots}
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
          <TouchableOpacity style={styles.backLink} onPress={() => setStep("service")}>
            <Text style={[styles.backLinkText, { color: colors.primary }]}>← Back</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* TIME step */}
      {step === "time" && (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>Pick a time</Text>
          {availableSlots.length === 0 ? (
            <View style={styles.noSlots}>
              <Feather name="clock" size={36} color={colors.mutedForeground} />
              <Text style={[styles.stepTitle, { color: colors.foreground }]}>No slots available</Text>
              <TouchableOpacity onPress={() => setStep("date")}>
                <Text style={[styles.backLinkText, { color: colors.primary }]}>Choose a different date</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.slotGrid}>
                {availableSlots.map((slot) => {
                  const sel = selectedTime === slot;
                  return (
                    <TouchableOpacity
                      key={slot}
                      style={[styles.slotCard, { width: slotCardW, backgroundColor: sel ? colors.primary : colors.card, borderColor: sel ? colors.primary : colors.border }]}
                      onPress={() => { setSelectedTime(slot); Haptics.selectionAsync(); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.slotTime, { color: sel ? "#FFFFFF" : colors.foreground }]}>
                        {formatTime12(slot)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {selectedTime && (
                <TouchableOpacity
                  style={[styles.cta, { backgroundColor: colors.primary }]}
                  onPress={() => setStep("details")}
                  activeOpacity={0.85}
                >
                  <Text style={styles.ctaText}>Your Details</Text>
                  <Feather name="arrow-right" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* DETAILS step */}
      {step === "details" && (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>Your details</Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
            {selectedDate} at {formatTime12(selectedTime)}
          </Text>

          {[
            { label: "Full Name *", value: clientName, setter: setClientName, placeholder: "e.g. Jamie Lee", keyboard: "default" as const, autoCapitalize: "words" as const },
            { label: "Email", value: clientEmail, setter: setClientEmail, placeholder: "you@example.com", keyboard: "email-address" as const, autoCapitalize: "none" as const },
            { label: "Phone", value: clientPhone, setter: setClientPhone, placeholder: "+1 555 000 0000", keyboard: "phone-pad" as const, autoCapitalize: "none" as const },
            { label: "Notes (optional)", value: notes, setter: setNotes, placeholder: "Anything the instructor should know", keyboard: "default" as const, autoCapitalize: "sentences" as const },
          ].map(({ label, value, setter, placeholder, keyboard, autoCapitalize }) => (
            <View key={label} style={styles.fieldWrap}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                placeholder={placeholder}
                placeholderTextColor={colors.mutedForeground}
                value={value}
                onChangeText={setter}
                keyboardType={keyboard}
                autoCapitalize={autoCapitalize}
              />
            </View>
          ))}

          <TouchableOpacity
            style={[styles.cta, { backgroundColor: colors.primary, opacity: submitting || !clientName.trim() ? 0.6 : 1 }]}
            onPress={handleSubmit}
            disabled={submitting || !clientName.trim()}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.ctaText}>Confirm Booking</Text>
                <Feather name="check" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* PAYMENT step */}
      {step === "payment" && pendingClientSecret && (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
          {submitting ? (
            <View style={{ alignItems: "center", paddingTop: 40 }}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.stepSub, { color: colors.mutedForeground, marginTop: 12 }]}>
                Confirming your booking…
              </Text>
            </View>
          ) : (
            <PaymentStep
              clientSecret={pendingClientSecret}
              publishableKey={stripePublishableKey}
              amount={pendingPaymentAmount}
              merchantName={profile?.instructor.name}
              sessionDescription={selectedService?.name}
              sessionDate={selectedDate && selectedTime ? `${selectedDate} · ${formatTime12(selectedTime)}` : selectedDate || undefined}
              onSuccess={handlePaymentSuccess}
              onBack={() => setStep("details")}
            />
          )}
        </ScrollView>
      )}

      {/* SUCCESS step */}
      {step === "success" && (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
          <View style={styles.successContent}>
            <View style={[styles.successIcon, { backgroundColor: "#34C75918" }]}>
              <Feather name="check-circle" size={52} color="#34C759" />
            </View>
            <Text style={[styles.successTitle, { color: colors.foreground }]}>Booking Confirmed!</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              Your session with {profile?.instructor.name} is scheduled.
            </Text>
          </View>

          <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {bookedSession?.serviceName && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Service</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{bookedSession.serviceName}</Text>
              </View>
            )}
            <View style={[styles.detailRow, { borderTopWidth: bookedSession?.serviceName ? 1 : 0, borderTopColor: colors.border }]}>
              <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Date</Text>
              <Text style={[styles.detailValue, { color: colors.foreground }]}>{bookedSession?.date ?? selectedDate}</Text>
            </View>
            <View style={[styles.detailRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Time</Text>
              <Text style={[styles.detailValue, { color: colors.foreground }]}>{formatTime12(bookedSession?.time ?? selectedTime)}</Text>
            </View>
          </View>

          {(bookedSession?.amountPaid ?? 0) > 0 && (
            <View style={[styles.receiptCard, { backgroundColor: "#34C75910", borderColor: "#34C75930" }]}>
              <View style={styles.receiptHeader}>
                <Feather name="check-circle" size={14} color="#34C759" />
                <Text style={styles.receiptTitle}>Payment Receipt</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: colors.mutedForeground }]}>Amount Paid</Text>
                <Text style={styles.receiptAmount}>${(bookedSession!.amountPaid! / 100).toFixed(2)}</Text>
              </View>
            </View>
          )}

          {bookedSession?.cancellationToken && (
            <TouchableOpacity
              style={[styles.linkCard, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}
              onPress={() => {
                const domain =
                  typeof process !== "undefined"
                    ? (process.env.EXPO_PUBLIC_DOMAIN ?? "")
                    : "";
                const url = domain
                  ? `https://${domain}/book/booking/${bookedSession.cancellationToken}`
                  : `https://your-app.replit.app/book/booking/${bookedSession.cancellationToken}`;
                Linking.openURL(url);
              }}
              activeOpacity={0.7}
            >
              <Feather name="external-link" size={16} color={colors.primary} />
              <Text style={[styles.linkCardText, { color: colors.primary }]}>View or cancel booking</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.cta, { backgroundColor: colors.primary }]}
            onPress={reset}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>Book Another</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 10,
    borderBottomWidth: 1,
  },
  brandLogo: { width: 36, height: 36 },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold" },
  switchBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  switchText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  content: { padding: 20, gap: 16 },
  successContent: { alignItems: "center", paddingVertical: 8 },
  detailCard: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  detailLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  detailValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "right", flex: 1, marginLeft: 12 },
  linkCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  linkCardText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  stepTitle: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  stepSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  input: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  cta: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
  },
  ctaText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  skipLink: { alignItems: "center", paddingVertical: 4 },
  skipText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  backLink: { alignItems: "center", paddingVertical: 8 },
  backLinkText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  serviceBody: { flex: 1 },
  serviceName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  servicePrice: { fontSize: 13, fontFamily: "Inter_400Regular" },
  sectionLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8 },
  packageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  packageCard: {
    width: "30%",
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    alignItems: "center",
    gap: 2,
  },
  packageCount: { fontSize: 22, fontFamily: "Inter_700Bold" },
  packageLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  packageTotal: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  discountBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginTop: 2 },
  discountText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#FFFFFF" },
  dateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dateCard: {
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 4,
  },
  dateDay: { fontSize: 9, fontFamily: "Inter_500Medium" },
  dateNum: { fontSize: 15, fontFamily: "Inter_700Bold" },
  dateMon: { fontSize: 8, fontFamily: "Inter_400Regular" },
  todayDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  slotCard: {
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  slotTime: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  noSlots: { alignItems: "center", gap: 12, paddingVertical: 40 },
  fieldWrap: { width: "100%", gap: 6 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  successIcon: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center" },
  successTitle: { fontSize: 26, fontFamily: "Inter_700Bold", textAlign: "center" },
  receiptCard: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  receiptHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  receiptTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#34C759" },
  receiptRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  receiptLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  receiptAmount: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#34C759" },
});
