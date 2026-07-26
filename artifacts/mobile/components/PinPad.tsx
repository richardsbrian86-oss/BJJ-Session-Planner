import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

import { useColors } from "@/hooks/useColors";

interface Props {
  pinLength?: number;
  onComplete: (pin: string) => void;
  error?: boolean;
  onErrorClear?: () => void;
  subtitle?: string;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

export function PinPad({
  pinLength = 6,
  onComplete,
  error,
  onErrorClear,
  subtitle,
}: Props) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const [pin, setPin] = useState("");
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const justCompleted = useRef(false);

  // Responsive key size — fits comfortably in any screen width
  const keySize = Math.min(68, Math.floor((width - 64 - 20) / 3));
  const gridWidth = keySize * 3 + 10 * 2;

  useEffect(() => {
    if (error) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 7, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -7, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: true }),
      ]).start(() => {
        setPin("");
        justCompleted.current = false;
        onErrorClear?.();
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [error]);

  function press(key: string) {
    if (key === "⌫") {
      setPin((p) => p.slice(0, -1));
      justCompleted.current = false;
      Haptics.selectionAsync();
      return;
    }
    if (key === "") return;
    if (justCompleted.current) return;
    const next = pin + key;
    setPin(next);
    Haptics.selectionAsync();
    if (next.length === pinLength) {
      justCompleted.current = true;
      setTimeout(() => onComplete(next), 80);
    }
  }

  return (
    <View style={styles.container}>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: error ? colors.destructive : colors.mutedForeground }]}>
          {subtitle}
        </Text>
      ) : null}

      <Animated.View style={[styles.dots, { transform: [{ translateX: shakeAnim }] }]}>
        {Array.from({ length: pinLength }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor:
                  i < pin.length
                    ? error
                      ? colors.destructive
                      : colors.primary
                    : colors.border,
                transform: [{ scale: i < pin.length ? 1.15 : 1 }],
              },
            ]}
          />
        ))}
      </Animated.View>

      <View style={[styles.grid, { width: gridWidth }]}>
        {KEYS.map((key, i) => (
          <TouchableOpacity
            key={i}
            style={[
              styles.key,
              {
                width: keySize,
                height: keySize,
                borderRadius: keySize / 2,
                backgroundColor:
                  key === ""
                    ? "transparent"
                    : key === "⌫"
                    ? colors.secondary
                    : colors.card,
                borderColor:
                  key === "" || key === "⌫" ? "transparent" : colors.border,
              },
            ]}
            onPress={() => press(key)}
            disabled={key === ""}
            activeOpacity={key === "" ? 1 : 0.55}
          >
            {key === "⌫" ? (
              <Feather name="delete" size={20} color={colors.mutedForeground} />
            ) : (
              <Text style={[styles.keyText, { color: colors.foreground, fontSize: keySize * 0.34 }]}>
                {key}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: 22, width: "100%" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  dots: { flexDirection: "row", gap: 14 },
  dot: { width: 13, height: 13, borderRadius: 6.5 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  key: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  keyText: { fontFamily: "Inter_400Regular" },
});
