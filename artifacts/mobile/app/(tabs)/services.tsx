import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Service, useServices } from "@/context/ServicesContext";
import { useColors } from "@/hooks/useColors";
import { api } from "@/utils/apiClient";

interface FormState {
  name: string;
  price: string;
}

interface ConnectStatus {
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted?: boolean;
}

export default function ServicesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { services, addService, updateService, deleteService } = useServices();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState<FormState>({ name: "", price: "" });

  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 82 : insets.bottom + 20;

  useFocusEffect(
    useCallback(() => {
      fetchConnectStatus();
    }, [])
  );

  async function fetchConnectStatus() {
    try {
      const status = await api.connect.getStatus();
      setConnectStatus(status);
    } catch {
      setConnectStatus(null);
    }
  }

  async function handleConnectStripe() {
    setConnectLoading(true);
    try {
      const { url } = await api.connect.startOnboarding();
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not start Stripe onboarding.");
    } finally {
      setConnectLoading(false);
    }
  }

  function openAdd() {
    setEditingService(null);
    setForm({ name: "", price: "" });
    setModalVisible(true);
  }

  function openEdit(service: Service) {
    setEditingService(service);
    setForm({ name: service.name, price: service.price.toString() });
    setModalVisible(true);
  }

  async function handleSave() {
    const name = form.name.trim();
    const price = parseFloat(form.price);
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
    setModalVisible(false);
  }

  function confirmDelete(service: Service) {
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

  function getConnectStatusLabel(): { label: string; color: string; icon: string } {
    if (!connectStatus?.connected) {
      return { label: "Not connected", color: colors.mutedForeground, icon: "alert-circle" };
    }
    if (!connectStatus.detailsSubmitted) {
      return { label: "Setup incomplete", color: "#FF9500", icon: "clock" };
    }
    if (!connectStatus.chargesEnabled) {
      return { label: "Pending verification", color: "#FF9500", icon: "clock" };
    }
    return { label: "Active — ready to receive payments", color: "#34C759", icon: "check-circle" };
  }

  const statusInfo = getConnectStatusLabel();

  const PaymentsSection = () => (
    <View style={[styles.paymentsSection, { borderColor: colors.border }]}>
      <View style={styles.paymentsSectionHeader}>
        <View style={[styles.paymentIcon, { backgroundColor: colors.primary + "18" }]}>
          <Feather name="credit-card" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.paymentsTitle, { color: colors.foreground }]}>Stripe Payouts</Text>
          <Text style={[styles.paymentsSub, { color: colors.mutedForeground }]}>
            Receive client payments directly into your bank account
          </Text>
        </View>
      </View>

      <View style={[styles.statusRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Feather name={statusInfo.icon as "check-circle" | "clock" | "alert-circle"} size={14} color={statusInfo.color} />
        <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
      </View>

      {(!connectStatus?.connected || !connectStatus.chargesEnabled) && (
        <TouchableOpacity
          style={[styles.connectBtn, { backgroundColor: colors.primary, opacity: connectLoading ? 0.6 : 1 }]}
          onPress={handleConnectStripe}
          disabled={connectLoading}
          activeOpacity={0.85}
        >
          <Feather name="external-link" size={15} color="#FFFFFF" />
          <Text style={styles.connectBtnText}>
            {connectLoading
              ? "Opening…"
              : connectStatus?.connected
              ? "Continue Stripe Setup"
              : "Connect Stripe Account"}
          </Text>
        </TouchableOpacity>
      )}

      {connectStatus?.connected && connectStatus.chargesEnabled && (
        <TouchableOpacity
          style={[styles.recheckBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          onPress={fetchConnectStatus}
          activeOpacity={0.75}
        >
          <Feather name="refresh-cw" size={13} color={colors.mutedForeground} />
          <Text style={[styles.recheckText, { color: colors.mutedForeground }]}>Refresh status</Text>
        </TouchableOpacity>
      )}

      <Text style={[styles.paymentsNote, { color: colors.mutedForeground }]}>
        Powered by Stripe Connect. Funds are transferred to your bank within 2–7 business days.
      </Text>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Services</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {services.length} service{services.length !== 1 ? "s" : ""} on your menu
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={openAdd}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={18} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={services}
        keyExtractor={(s) => s.id}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          services.length > 0 ? (
            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="info" size={14} color={colors.mutedForeground} />
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                Clients choose a service when booking. The price is saved with each session for your records.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={<PaymentsSection />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="dollar-sign" size={30} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No services yet</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Add your training packages with pricing so clients can select them when booking.
            </Text>
            <TouchableOpacity
              style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
              onPress={openAdd}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaBtnText}>Add Your First Service</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.cardLeft, { backgroundColor: colors.primary + "18" }]}>
              <Feather name="award" size={18} color={colors.primary} />
            </View>
            <View style={styles.cardBody}>
              <Text style={[styles.cardName, { color: colors.foreground }]}>{item.name}</Text>
              <Text style={[styles.cardPrice, { color: colors.primary }]}>
                ${item.price.toFixed(2)}
              </Text>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: colors.secondary }]}
                onPress={() => openEdit(item)}
                activeOpacity={0.75}
              >
                <Feather name="edit-2" size={15} color={colors.foreground} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: colors.secondary }]}
                onPress={() => confirmDelete(item)}
                activeOpacity={0.75}
              >
                <Feather name="trash-2" size={15} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetWrap}
        >
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + 24 },
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
                value={form.name}
                onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
                autoCapitalize="words"
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
                value={form.price}
                onChangeText={(t) => setForm((f) => ({ ...f, price: t }))}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.sheetBtns}>
              <TouchableOpacity
                style={[styles.sheetBtn, { backgroundColor: colors.secondary }]}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.sheetBtnText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetBtn, { backgroundColor: colors.primary, flex: 1.5 }]}
                onPress={handleSave}
                activeOpacity={0.85}
              >
                <Text style={[styles.sheetBtnText, { color: "#FFFFFF" }]}>
                  {editingService ? "Save Changes" : "Add Service"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  list: { paddingHorizontal: 20, gap: 10 },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  infoText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 19 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  cardLeft: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  cardBody: { flex: 1, gap: 3 },
  cardName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cardPrice: { fontSize: 18, fontFamily: "Inter_700Bold" },
  cardActions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  empty: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 20, gap: 14 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  emptyTitle: { fontSize: 19, fontFamily: "Inter_700Bold" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22, maxWidth: 280 },
  ctaBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  ctaBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
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
    width: 36, height: 4, borderRadius: 2,
    alignSelf: "center", marginBottom: 8,
  },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  formGroup: { gap: 8 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.4, textTransform: "uppercase" },
  input: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1,
    fontSize: 16, fontFamily: "Inter_400Regular",
  },
  sheetBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  sheetBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  sheetBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  paymentsSection: {
    marginTop: 24,
    borderTopWidth: 1,
    paddingTop: 24,
    gap: 14,
  },
  paymentsSectionHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  paymentIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  paymentsTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 2 },
  paymentsSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  connectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  connectBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  recheckBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  recheckText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  paymentsNote: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    textAlign: "center",
  },
});
