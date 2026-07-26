import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import React, { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SetupScreen } from "@/components/auth/SetupScreen";
import { PinScreen } from "@/components/auth/PinScreen";
import { PinUpgradeScreen } from "@/components/auth/PinUpgradeScreen";
import { ModeSelectScreen } from "@/components/auth/ModeSelectScreen";
import { EmailAuthScreen } from "@/components/auth/EmailAuthScreen";
import { ClientBookingFlow } from "@/components/client/ClientBookingFlow";
import { ConditionalStripeProvider } from "@/components/ConditionalStripeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { SchedulerProvider } from "@/context/SchedulerContext";
import { ServicesProvider } from "@/context/ServicesContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { isLoading, isSetup, isAuthenticated, isPinUpgradeRequired, authMethod, appMode, setAppMode } = useAuth();

  if (isLoading) return <View style={{ flex: 1, backgroundColor: "#0A0A0D" }} />;

  if (!appMode) return <ModeSelectScreen />;

  if (appMode === "client") {
    return (
      <ClientBookingFlow
        onSwitchToInstructor={() => setAppMode("instructor")}
      />
    );
  }

  if (!isSetup) return <SetupScreen />;
  if (!isAuthenticated && authMethod !== "email") return <PinScreen />;
  if (!isAuthenticated && authMethod === "email") return <EmailAuthScreen initialMode="login" onBack={() => setAppMode(null)} />;
  if (isAuthenticated && isPinUpgradeRequired) return <PinUpgradeScreen />;

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="session/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    SystemUI.setBackgroundColorAsync("#0A0A0D");
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: "#0A0A0D" }} />;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <SchedulerProvider>
              <ServicesProvider>
                <ConditionalStripeProvider>
                  <GestureHandlerRootView>
                    <KeyboardProvider>
                      <RootLayoutNav />
                    </KeyboardProvider>
                  </GestureHandlerRootView>
                </ConditionalStripeProvider>
              </ServicesProvider>
            </SchedulerProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
