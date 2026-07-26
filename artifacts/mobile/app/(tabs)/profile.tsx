import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { api, ApiInstructorProfile } from "@/utils/apiClient";
import { Service, useServices } from "@/context/ServicesContext";

interface ProfileForm {
  name: string;
  bio: string;
  location: string;
  phone: string;
  website: string;
  photoUrl: string;
}

interface ServiceForm {
  name: string;
  price: string;
}

function getBookingUrl(slug: string | null) {
  if (!slug) return null;
  return `https://bjj-session-planner.replit.app/book/${slug}`;
}

function completionItems(form: ProfileForm, services: Service[]) {
  return [
    { label: "Display name", done: !!form.name.trim() },
    { label: "Bio", done: !!form.bio.trim() },
    { label: "Location", done: !!form.location.trim() },
    { label: "At least one service", done: services.length > 0 },
    { label: "Photo", done: !!form.photoUrl.trim() },
  ];
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { instructorName, instructorSlug } = useAuth();
  const { services, addService, updateService, deleteService } = useServices();

  const [profile, setProfile] = useState<ApiInstructorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState<ProfileForm>({
    name: instructorName,
    bio: "",
    location: "",
    phone: "",
    website: "",
    photoUrl: "",
  });

  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceForm, setServiceForm] = useState<ServiceForm>({ name: "", price: "" });

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 90 : insets.bottom + 24;

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.instructor.getProfile();
      setProfile(data.profile);
      setForm({
        name: data.profile.name,
        bio: data.profile.bio ?? "",
        location: data.profile.location ?? "",
        phone: data.profile.phone ?? "",
        website: data.profile.website ?? "",
        photoUrl: data.profile.photoUrl ?? "",
      });
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  async function handleSave() {
    if (!form.name.trim()) {
      Alert.alert("Required", "Display name cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      const updated = await api.instructor.updateProfile({
        name: form.name.trim(),
        bio: form.bio.trim() || undefined,
        location: form.location.trim() || undefined,
        phone: form.phone.trim() || undefined,
        website: form.website.trim() || undefined,
        photoUrl: form.photoUrl.trim() || undefined,
      });
      setProfile(updated.profile);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved", "Your profile has been updated.");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyLink() {
    const url = getBookingUrl(instructorSlug);
    if (!url) return;
    await Clipboard.setStringAsync(url);
    setCopied(true);
    Haptics.selectionAsync();
    setTimeout(() => setCopied(false), 2000);
  }

  function openAddService() {
    setEditingService(null);
    setServiceForm({ name: "", price: "" });
    setServiceModalVisible(true);
  }

  function openEditService(service: Service) {
    setEditingService(service);
    setServiceForm({ name: service.name, price: service.price.toString() });
    setServiceModalVisible(true);
  }

  async function handleSaveService() {
    const name = serviceForm.name.trim();
    const price = parseFloat(serviceForm.price);
    if (!name) {
      Alert.alert("Required", "Please enter a service name.");
      return;
    }
    if (isNaN(price) || price < 0) {
      Alert.alert("Invalid price", "Please enter a valid price.");
      return;
    }
    if (editingService) {
      await updateService({ ...editingService, name, price });
    } else {
      await addService({ name, price });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setServiceModalVisible(false);
  }

  function confirmDeleteService(service: Service) {
    Alert.alert(
      "Delete Service",
      `Remove "${service.name}" from your menu?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteService(service.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  }

  const hasPhoto = !!form.photoUrl.trim();
  const bookingUrl = getBookingUrl(instructorSlug);
  const items = completionItems(form, services);
  const completedCount = items.filter((i) => i.done).length;
  const isProfileIncomplete = completedCount < items.length;
  const isNewProfile = !form.bio.trim() && !form.location.trim() && services.length === 0;

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 16, paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Your Profile</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            This is what clients see when they book with you.
          </Text>
        </View>

        {isNewProfile && (
          <View style={[styles.onboardingCard, { backgroundColor: colors.primary + "14", borderColor: colors.primary + "40" }]}>
            <View style={styles.onboardingHeader}>
              <Text style={styles.onboardingEmoji}>👋</Text>
              <View style={styles.onboardingHeaderText}>
                <Text style={[styles.onboardingTitle, { color: colors.foreground }]}>
                  Welcome, {form.name.split(" ")[0] || "Coach"}!
                </Text>
                <Text style={[styles.onboardingSub, { color: colors.mutedForeground }]}>
                  Fill in your profile so clients know who they're booking with.
                </Text>
              </View>
            </View>
            <View style={styles.checklistItems}>
              {items.map((item) => (
                <View key={item.label} style={styles.checklistRow}>
                  <View
                    style={[
                      styles.checkDot,
                      { backgroundColor: item.done ? colors.primary : colors.primary + "30" },
                    ]}
                  >
                    {item.done && <Feather name="check" size={10} color="#fff" />}
                  </View>
                  <Text
                    style={[
                      styles.checkLabel,
                      {
                        color: item.done ? colors.foreground : colors.mutedForeground,
                        textDecorationLine: item.done ? "line-through" : "none",
                        opacity: item.done ? 0.6 : 1,
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {!isNewProfile && isProfileIncomplete && (
          <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.progressRow}>
              <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
                Profile completeness
              </Text>
              <Text style={[styles.progressCount, { color: colors.primary }]}>
                {completedCount}/{items.length}
              </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: colors.primary,
                    width: `${(completedCount / items.length) * 100}%` as any,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {bookingUrl && (
          <View style={[styles.linkCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.linkCardTop}>
              <Feather name="link" size={15} color={colors.primary} />
              <Text style={[styles.linkCardTitle, { color: colors.foreground }]}>Your Booking Link</Text>
            </View>
            <Text style={[styles.linkUrl, { color: colors.primary }]} numberOfLines={1}>
              {bookingUrl}
            </Text>
            <TouchableOpacity
              style={[styles.copyBtn, { backgroundColor: copied ? colors.primary : colors.primary + "18" }]}
              onPress={handleCopyLink}
              activeOpacity={0.8}
            >
              <Feather name={copied ? "check" : "copy"} size={14} color={copied ? "#fff" : colors.primary} />
              <Text style={[styles.copyBtnText, { color: copied ? "#fff" : colors.primary }]}>
                {copied ? "Copied!" : "Copy link"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.photoSection}>
          {hasPhoto ? (
            <Image source={{ uri: form.photoUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + "18" }]}>
              <Feather name="user" size={36} color={colors.primary} />
            </View>
          )}
          {!hasPhoto && (
            <Text style={[styles.photoHint, { color: colors.mutedForeground }]}>
              Add a photo URL below to show your face to clients
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Personal Info</Text>

          <Field
            label="Display Name"
            value={form.name}
            onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
            placeholder="Your name"
            colors={colors}
            autoCapitalize="words"
          />
          <Field
            label="Bio"
            value={form.bio}
            onChangeText={(t) => setForm((f) => ({ ...f, bio: t }))}
            placeholder="Tell clients about your background, style, and experience…"
            colors={colors}
            multiline
            numberOfLines={4}
          />
          <Field
            label="Location"
            value={form.location}
            onChangeText={(t) => setForm((f) => ({ ...f, location: t }))}
            placeholder="City or gym name"
            colors={colors}
          />
          <Field
            label="Phone"
            value={form.phone}
            onChangeText={(t) => setForm((f) => ({ ...f, phone: t }))}
            placeholder="+1 (555) 000-0000"
            colors={colors}
            keyboardType="phone-pad"
          />
          <Field
            label="Website"
            value={form.website}
            onChangeText={(t) => setForm((f) => ({ ...f, website: t }))}
            placeholder="https://yoursite.com"
            colors={colors}
            keyboardType="url"
            autoCapitalize="none"
          />
          <Field
            label="Profile Photo URL"
            value={form.photoUrl}
            onChangeText={(t) => setForm((f) => ({ ...f, photoUrl: t }))}
            placeholder="https://example.com/your-photo.jpg"
            colors={colors}
            keyboardType="url"
            autoCapitalize="none"
            hint="Paste a direct link to your photo (JPG or PNG)"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Feather name="save" size={16} color="#fff" />
              <Text style={styles.saveBtnText}>Save Profile</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <View style={styles.sectionTitleGroup}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Services</Text>
              <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
                What you offer and what you charge
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.addServiceBtn, { backgroundColor: colors.primary }]}
              onPress={openAddService}
              activeOpacity={0.85}
            >
              <Feather name="plus" size={15} color="#fff" />
              <Text style={styles.addServiceBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {services.length === 0 ? (
            <TouchableOpacity
              style={[styles.emptyServices, { backgroundColor: colors.card, borderColor: colors.primary + "40", borderStyle: "dashed" }]}
              onPress={openAddService}
              activeOpacity={0.8}
            >
              <Feather name="plus-circle" size={22} color={colors.primary} />
              <Text style={[styles.emptyServicesText, { color: colors.foreground }]}>
                Add your first service
              </Text>
              <Text style={[styles.emptyServicesHint, { color: colors.mutedForeground }]}>
                e.g. "60-min Private Session — $80"
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.serviceList}>
              {services.map((service) => (
                <View
                  key={service.id}
                  style={[styles.serviceCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={[styles.serviceIcon, { backgroundColor: colors.primary + "18" }]}>
                    <Feather name="award" size={16} color={colors.primary} />
                  </View>
                  <View style={styles.serviceBody}>
                    <Text style={[styles.serviceName, { color: colors.foreground }]}>{service.name}</Text>
                    <Text style={[styles.servicePrice, { color: colors.primary }]}>
                      ${service.price.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.serviceActions}>
                    <TouchableOpacity
                      style={[styles.iconBtn, { backgroundColor: colors.secondary }]}
                      onPress={() => openEditService(service)}
                      activeOpacity={0.75}
                    >
                      <Feather name="edit-2" size={14} color={colors.foreground} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.iconBtn, { backgroundColor: colors.secondary }]}
                      onPress={() => confirmDeleteService(service)}
                      activeOpacity={0.75}
                    >
                      <Feather name="trash-2" size={14} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {serviceModalVisible && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setServiceModalVisible(false)}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.sheetWrap}
          >
            <View
              style={[
                styles.sheet,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  paddingBottom: insets.bottom + 24,
                },
              ]}
            >
              <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
                {editingService ? "Edit Service" : "Add Service"}
              </Text>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Service Name</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border },
                  ]}
                  placeholder="e.g. 60-min Private Session"
                  placeholderTextColor={colors.mutedForeground}
                  value={serviceForm.name}
                  onChangeText={(t) => setServiceForm((f) => ({ ...f, name: t }))}
                  autoCapitalize="words"
                  autoFocus
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Price ($)</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border },
                  ]}
                  placeholder="e.g. 80"
                  placeholderTextColor={colors.mutedForeground}
                  value={serviceForm.price}
                  onChangeText={(t) => setServiceForm((f) => ({ ...f, price: t }))}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.sheetBtns}>
                <TouchableOpacity
                  style={[styles.sheetBtn, { backgroundColor: colors.secondary }]}
                  onPress={() => setServiceModalVisible(false)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.sheetBtnText, { color: colors.foreground }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sheetBtn, { backgroundColor: colors.primary, flex: 1.5 }]}
                  onPress={handleSaveService}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.sheetBtnText, { color: "#FFFFFF" }]}>
                    {editingService ? "Save Changes" : "Add Service"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  colors: ReturnType<typeof useColors>;
  multiline?: boolean;
  numberOfLines?: number;
  keyboardType?: "default" | "phone-pad" | "url" | "decimal-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  hint?: string;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
  multiline,
  numberOfLines,
  keyboardType = "default",
  autoCapitalize = "sentences",
  hint,
}: FieldProps) {
  return (
    <View style={styles.formGroup}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border },
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        numberOfLines={numberOfLines}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        textAlignVertical={multiline ? "top" : "auto"}
      />
      {hint && (
        <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>{hint}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: 20, gap: 0 },
  header: { marginBottom: 16 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 3, lineHeight: 18 },

  onboardingCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 14,
    marginBottom: 16,
  },
  onboardingHeader: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  onboardingEmoji: { fontSize: 26, lineHeight: 32 },
  onboardingHeaderText: { flex: 1, gap: 2 },
  onboardingTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  onboardingSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  checklistItems: { gap: 8, paddingLeft: 4 },
  checklistRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  checkLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },

  progressCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    marginBottom: 16,
  },
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  progressCount: { fontSize: 12, fontFamily: "Inter_700Bold" },
  progressTrack: { height: 5, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 5, borderRadius: 3 },

  linkCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    marginBottom: 20,
  },
  linkCardTop: { flexDirection: "row", alignItems: "center", gap: 7 },
  linkCardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  linkUrl: { fontSize: 13, fontFamily: "Inter_400Regular", opacity: 0.9 },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  copyBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  photoSection: { alignItems: "center", gap: 8, marginBottom: 24 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  photoHint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 220, lineHeight: 17 },

  section: { gap: 14 },
  sectionRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  sectionTitleGroup: { flex: 1, gap: 2 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 2 },
  sectionHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
  formGroup: { gap: 6 },
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  fieldHint: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16, marginTop: 2 },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  inputMultiline: {
    minHeight: 100,
    paddingTop: 13,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 24,
    marginBottom: 4,
  },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  divider: { height: 1, marginVertical: 28 },
  addServiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    marginTop: 4,
  },
  addServiceBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  serviceList: { gap: 10 },
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  serviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  serviceBody: { flex: 1, gap: 2 },
  serviceName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  servicePrice: { fontSize: 16, fontFamily: "Inter_700Bold" },
  serviceActions: { flexDirection: "row", gap: 6 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyServices: {
    padding: 24,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    gap: 6,
  },
  emptyServicesText: { fontSize: 15, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  emptyServicesHint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  modalOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheetWrap: { justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingTop: 14,
    paddingHorizontal: 24,
    gap: 16,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  sheetBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  sheetBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  sheetBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
