---
name: new-mobile-tab
description: Add a new tab screen to the Let's Roll Expo mobile app. Use when adding any new top-level tab — requires updating both the NativeTabs layout (iOS Liquid Glass) and the ClassicTabLayout (Expo Tabs), plus creating the screen file. Covers file creation, icon selection (SF Symbols + Feather), and auth-guarding.
---

# New Mobile Tab — Scaffolding Pattern

The tab layout has two render paths that must both be updated:
- **`NativeTabLayout`** — iOS 26+ Liquid Glass tabs via `expo-router/unstable-native-tabs`
- **`ClassicTabLayout`** — Expo `<Tabs>` for Android, web, and older iOS

## Files to touch

| File | Action |
|------|--------|
| `artifacts/mobile/app/(tabs)/<name>.tsx` | Create |
| `artifacts/mobile/app/(tabs)/_layout.tsx` | Add tab to both `NativeTabLayout` and `ClassicTabLayout` |

## 1. Create the screen file

```tsx
// artifacts/mobile/app/(tabs)/<name>.tsx
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { api } from "@/utils/apiClient";

export default function MyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, instructorId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MyDataType[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load data whenever the tab is focused
  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated || !instructorId) return;
      let cancelled = false;

      async function load() {
        setLoading(true);
        setError(null);
        try {
          const result = await api.myNamespace.getAll();
          if (!cancelled) setData(result);
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      load();
      return () => { cancelled = true; };
    }, [isAuthenticated, instructorId])
  );

  // Auth guard
  if (!isAuthenticated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>Please log in.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={data}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100, paddingHorizontal: 16 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 28, fontFamily: "Inter_700Bold", color: colors.text }}>Screen Title</Text>
            <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 4 }}>Subtitle</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 10 }}>
            <Text style={{ color: colors.text, fontFamily: "Inter_600SemiBold" }}>{String(item.id)}</Text>
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={{ alignItems: "center", paddingTop: 60, gap: 12 }}>
              <Feather name="inbox" size={40} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>Nothing here yet.</Text>
            </View>
          )
        }
      />
    </View>
  );
}
```

## 2. Register in _layout.tsx

Two blocks must be updated — `NativeTabLayout` and `ClassicTabLayout`.

### NativeTabLayout block (iOS Liquid Glass)

```tsx
<NativeTabs.Trigger name="<name>">
  <Icon sf={{ default: "star", selected: "star.fill" }} />
  <Label>Tab Label</Label>
</NativeTabs.Trigger>
```

Add inside the `<NativeTabs>` wrapper, in the desired tab order.

### ClassicTabLayout block (Expo Tabs)

```tsx
<Tabs.Screen
  name="<name>"
  options={{
    title: "Tab Label",
    tabBarIcon: ({ color }) =>
      isIOS ? (
        <SymbolView name="star" tintColor={color} size={22} />
      ) : (
        <Feather name="star" size={21} color={color} />
      ),
  }}
/>
```

Add inside the `<Tabs>` wrapper, matching the order in `NativeTabLayout`.

## Icon pairing reference

Match SF Symbol names (iOS) to Feather icon names (Android/web):

| SF Symbol | Feather | Meaning |
|-----------|---------|---------|
| `calendar` / `calendar.fill` | `calendar` | Schedule |
| `plus.circle` / `plus.circle.fill` | `plus-circle` | Add/Book |
| `dollarsign.circle` / `dollarsign.circle.fill` | `dollar-sign` | Services/Money |
| `clock` / `clock.fill` | `clock` | Time/Availability |
| `shield` / `shield.fill` | `shield` | Security |
| `person.circle` / `person.circle.fill` | `user` | Profile |
| `star` / `star.fill` | `star` | Favorites |
| `bell` / `bell.fill` | `bell` | Notifications |
| `chart.bar` / `chart.bar.fill` | `bar-chart-2` | Analytics |
| `gear` / `gear.fill` | `settings` | Settings |

For a tab with a **badge** (notification count), create a custom icon component following the pattern in `SecurityTabIcon` in `_layout.tsx`.

## useColors token reference

```typescript
const colors = useColors();

colors.primary         // #f97316 — orange accent
colors.background      // deep navy
colors.surface         // card/panel background
colors.card            // same as surface, use interchangeably
colors.border          // subtle border
colors.text            // primary text
colors.mutedForeground // secondary/placeholder text
```

## Key rules

- **Tab order must match** between `NativeTabLayout` and `ClassicTabLayout` — users expect the same tab order regardless of iOS version.
- **Always use `useFocusEffect`** (not `useEffect`) for data loading in tab screens — fires on every tab focus, not just mount.
- **`paddingBottom: insets.bottom + 100`** in `contentContainerStyle` prevents content hiding behind the tab bar.
- **The file name is the tab name** — `artifacts/mobile/app/(tabs)/myscreen.tsx` → `name="myscreen"` in the layout.
