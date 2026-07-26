import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { api } from "@/utils/apiClient";
import { useAuth } from "@/context/AuthContext";

function useSecurityBadge() {
  const { isAuthenticated, instructorId } = useAuth();
  const [badgeCount, setBadgeCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || !instructorId) return;

    let cancelled = false;

    async function check() {
      try {
        const data = await api.security.getEvents();
        if (!cancelled) {
          const high = data.events.filter((e) => e.count >= data.alertThreshold);
          setBadgeCount(high.length);
        }
      } catch {
      }
    }

    check();
    const interval = setInterval(check, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAuthenticated, instructorId]);

  return badgeCount;
}

function SecurityTabIcon({ color }: { color: string }) {
  const colors = useColors();
  const badgeCount = useSecurityBadge();

  return (
    <View>
      <Feather name="shield" size={21} color={color} />
      {badgeCount > 0 && (
        <View
          style={{
            position: "absolute",
            top: -4,
            right: -6,
            backgroundColor: "#ef4444",
            borderRadius: 8,
            minWidth: 16,
            height: 16,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 3,
            borderWidth: 1.5,
            borderColor: colors.surface,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 9,
              fontFamily: "Inter_700Bold",
              lineHeight: 12,
            }}
          >
            {badgeCount > 9 ? "9+" : badgeCount}
          </Text>
        </View>
      )}
    </View>
  );
}

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "calendar", selected: "calendar.fill" }} />
        <Label>Schedule</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="book">
        <Icon sf={{ default: "plus.circle", selected: "plus.circle.fill" }} />
        <Label>Book</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="services">
        <Icon sf={{ default: "dollarsign.circle", selected: "dollarsign.circle.fill" }} />
        <Label>Services</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="availability">
        <Icon sf={{ default: "clock", selected: "clock.fill" }} />
        <Label>Availability</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="security">
        <Icon sf={{ default: "shield", selected: "shield.fill" }} />
        <Label>Security</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person.circle", selected: "person.circle.fill" }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 62 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={90}
              tint="systemChromeMaterialDark"
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />
          ),
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 10,
          marginTop: -2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Schedule",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="calendar" tintColor={color} size={22} />
            ) : (
              <Feather name="calendar" size={21} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="book"
        options={{
          title: "Book",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="plus.circle" tintColor={color} size={22} />
            ) : (
              <Feather name="plus-circle" size={21} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: "Services",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="dollarsign.circle" tintColor={color} size={22} />
            ) : (
              <Feather name="dollar-sign" size={21} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="availability"
        options={{
          title: "Hours",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="clock" tintColor={color} size={22} />
            ) : (
              <Feather name="clock" size={21} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="security"
        options={{
          title: "Security",
          tabBarIcon: ({ color }) => <SecurityTabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.circle" tintColor={color} size={22} />
            ) : (
              <Feather name="user" size={21} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
