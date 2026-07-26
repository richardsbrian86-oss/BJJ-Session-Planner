---
name: expo-action-modal
description: Add a slide-up action modal to an Expo screen (React Native). Use when adding any authenticated action that needs a form with inputs, loading state, error display, and success feedback inside a tab screen — e.g. Change PIN, Edit Profile, Set Availability, Add Service. Covers Modal + KeyboardAvoidingView + state management + auto-close on success.
---

# Expo Action Modal Pattern

Use this whenever a tab screen needs an inline "action sheet" with form inputs — rather than navigating to a new screen.

## Required imports (add to existing react-native import block)

```typescript
import {
  // ... existing imports ...
  KeyboardAvoidingView,
  Modal,
  TextInput,
} from "react-native";
```

## State variables (add to component)

```typescript
const [modalVisible, setModalVisible] = useState(false);
const [fieldA, setFieldA] = useState("");
const [fieldB, setFieldB] = useState("");
const [fieldC, setFieldC] = useState("");
const [modalError, setModalError] = useState<string | null>(null);
const [modalLoading, setModalLoading] = useState(false);
const [modalSuccess, setModalSuccess] = useState(false);
```

## Open/close helpers

```typescript
function openModal() {
  setFieldA(""); setFieldB(""); setFieldC("");
  setModalError(null); setModalSuccess(false);
  setModalVisible(true);
}

function closeModal() {
  setModalVisible(false);
}
```

## Submit handler pattern

```typescript
async function handleSubmit() {
  setModalError(null);
  // Validate inputs first (before any async work)
  if (!fieldA.trim()) { setModalError("Field A is required"); return; }
  if (fieldB !== fieldC) { setModalError("Values do not match"); return; }

  setModalLoading(true);
  try {
    await api.someNamespace.someAction({ fieldA, fieldB });
    setModalSuccess(true);
    setFieldA(""); setFieldB(""); setFieldC("");
    // Auto-close after success animation
    setTimeout(() => { setModalSuccess(false); setModalVisible(false); }, 1500);
  } catch (e) {
    setModalError(e instanceof Error ? e.message : "Action failed");
  } finally {
    setModalLoading(false);
  }
}
```

## Trigger card (in ListHeaderComponent or ScrollView content)

```tsx
<TouchableOpacity
  style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
  onPress={openModal}
  activeOpacity={0.7}
>
  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
    <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary + "20" }}>
      <Feather name="lock" size={18} color={colors.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.text }}>Action Title</Text>
      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 1 }}>Short description</Text>
    </View>
    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
  </View>
</TouchableOpacity>
```

## Modal JSX (add as sibling of FlatList/ScrollView, inside the outermost View)

```tsx
<Modal
  visible={modalVisible}
  animationType="slide"
  presentationStyle="pageSheet"
  onRequestClose={closeModal}
>
  <KeyboardAvoidingView
    behavior={Platform.OS === "ios" ? "padding" : undefined}
    style={{ flex: 1, backgroundColor: colors.background }}
  >
    {/* Header */}
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.text }}>Modal Title</Text>
      <TouchableOpacity onPress={closeModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Feather name="x" size={22} color={colors.mutedForeground} />
      </TouchableOpacity>
    </View>

    {/* Body */}
    <View style={{ padding: 20, gap: 20 }}>
      {modalSuccess ? (
        <View style={{ alignItems: "center", paddingTop: 60, gap: 16 }}>
          <Feather name="check-circle" size={52} color="#22c55e" />
          <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.text }}>Done!</Text>
        </View>
      ) : (
        <>
          {/* Error banner */}
          {modalError && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, backgroundColor: "#ef444415", borderColor: "#ef444440" }}>
              <Feather name="alert-circle" size={14} color="#ef4444" />
              <Text style={{ color: "#ef4444", fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 }}>{modalError}</Text>
            </View>
          )}

          {/* Input field */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Field Label
            </Text>
            <TextInput
              style={{ borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 13, fontSize: 16, fontFamily: "Inter_400Regular", backgroundColor: colors.card, borderColor: colors.border, color: colors.text }}
              value={fieldA}
              onChangeText={setFieldA}
              keyboardType="default"  // or "number-pad" for PINs
              secureTextEntry={false}  // true for passwords/PINs
              placeholder="Placeholder"
              placeholderTextColor={colors.mutedForeground}
              maxLength={100}
            />
          </View>

          {/* Submit button */}
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 12, marginTop: 8, backgroundColor: colors.primary, opacity: modalLoading ? 0.6 : 1 }}
            onPress={handleSubmit}
            disabled={modalLoading}
            activeOpacity={0.8}
          >
            {modalLoading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Feather name="check" size={18} color="#ffffff" />
            )}
            <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#ffffff" }}>
              {modalLoading ? "Saving…" : "Save"}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  </KeyboardAvoidingView>
</Modal>
```

## Key rules

- **Place Modal as sibling of FlatList/ScrollView**, inside the outermost `<View>` of the return — NOT inside the list itself.
- **`presentationStyle="pageSheet"`** gives the native iOS bottom-sheet feel; works on Android and web too.
- **`onRequestClose={closeModal}`** required for Android back-button support.
- **Clear all field state in `openModal()`**, not `closeModal()` — so fields don't flash empty while the close animation plays.
- **Always show a success state** before auto-closing (1.5s delay) — immediate closes feel abrupt.
- **Validate synchronously before setting loading** — avoids a flicker where the button goes into loading state just to immediately show an error.

## Relevant files in this project

- `artifacts/mobile/app/(tabs)/security.tsx` — Change PIN implementation (complete reference)
- `artifacts/mobile/hooks/useColors.ts` — `colors.primary`, `colors.surface`, `colors.border`, `colors.text`, `colors.mutedForeground`, `colors.card`
