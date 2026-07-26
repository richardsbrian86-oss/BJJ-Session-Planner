import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface PaymentStepProps {
  clientSecret: string;
  publishableKey: string;
  amount: number;
  merchantName?: string;
  sessionDescription?: string;
  sessionDate?: string;
  onSuccess: (paymentIntentId: string) => void;
  onBack: () => void;
}

type UsePaymentSheetResult = {
  loading: boolean;
  initPaymentSheet: (params: object) => Promise<{ error?: { code?: string; message?: string } }>;
  presentPaymentSheet: () => Promise<{ error?: { code?: string; message?: string } }>;
};

let usePaymentSheet: (() => UsePaymentSheetResult) | null = null;

try {
  usePaymentSheet = require("@stripe/stripe-react-native").usePaymentSheet;
} catch {
  // stripe-react-native not available (e.g. Expo Go without dev build)
}

interface NativeCheckoutFormProps {
  clientSecret: string;
  amount: number;
  merchantName?: string;
  onSuccess: (paymentIntentId: string) => void;
  onBack: () => void;
  colors: ReturnType<typeof useColors>;
}

function NativeCheckoutForm({ clientSecret, amount, merchantName, onSuccess, onBack, colors }: NativeCheckoutFormProps) {
  const { loading, initPaymentSheet, presentPaymentSheet } = (usePaymentSheet as () => UsePaymentSheetResult)();
  const [initError, setInitError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      const { error } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: merchantName ?? "BJJ Training",
        style: "alwaysDark",
      });
      if (error) {
        setInitError(error.message ?? "Could not initialize payment.");
      } else {
        setReady(true);
      }
    }
    init();
  }, [clientSecret, merchantName]);

  async function handlePay() {
    setPayError(null);
    setPaying(true);
    const { error } = await presentPaymentSheet();
    setPaying(false);
    if (error) {
      if (error.code !== "Canceled") {
        setPayError(error.message ?? "Payment failed. Please try again.");
      }
    } else {
      const paymentIntentId = clientSecret.split("_secret_")[0];
      onSuccess(paymentIntentId);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
          Preparing payment…
        </Text>
      </View>
    );
  }

  if (initError) {
    return (
      <View style={styles.unsupportedWrap}>
        <Text style={[styles.unsupportedText, { color: colors.mutedForeground }]}>
          {initError}
        </Text>
        <TouchableOpacity style={styles.backLink} onPress={onBack}>
          <Text style={[styles.backLinkText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      {payError && (
        <View style={[styles.errorBox, { backgroundColor: "#FF3B3018", borderColor: "#FF3B3040" }]}>
          <Text style={[styles.errorText, { color: "#FF3B30" }]}>{payError}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.payBtn,
          { backgroundColor: colors.primary, opacity: (!ready || paying) ? 0.6 : 1 },
        ]}
        onPress={handlePay}
        disabled={!ready || paying}
        activeOpacity={0.85}
      >
        {paying ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.payBtnText}>
            Pay ${(amount / 100).toFixed(2)}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.backLink} onPress={onBack}>
        <Text style={[styles.backLinkText, { color: colors.mutedForeground }]}>← Back</Text>
      </TouchableOpacity>
    </View>
  );
}

export function PaymentStep({ clientSecret, publishableKey, amount, merchantName, sessionDescription, sessionDate, onSuccess, onBack }: PaymentStepProps) {
  const colors = useColors();

  if (!publishableKey) {
    return (
      <View style={styles.unsupportedWrap}>
        <Text style={[styles.unsupportedText, { color: colors.mutedForeground }]}>
          Online payment is not configured. Please contact the instructor directly.
        </Text>
        <TouchableOpacity style={styles.backLink} onPress={onBack}>
          <Text style={[styles.backLinkText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!usePaymentSheet) {
    return (
      <View style={styles.unsupportedWrap}>
        <Text style={[styles.unsupportedText, { color: colors.mutedForeground }]}>
          In-app payment requires a development build. Please use the web version or contact your instructor.
        </Text>
        <TouchableOpacity style={styles.backLink} onPress={onBack}>
          <Text style={[styles.backLinkText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.foreground }]}>Payment</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        Complete your payment to confirm the booking.
      </Text>
      {(sessionDescription || sessionDate) ? (
        <View style={[styles.summaryRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Session</Text>
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            {sessionDescription ? (
              <Text style={[styles.summaryValue, { color: colors.foreground }]}>{sessionDescription}</Text>
            ) : null}
            {sessionDate ? (
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{sessionDate}</Text>
            ) : null}
          </View>
        </View>
      ) : null}
      <NativeCheckoutForm
        clientSecret={clientSecret}
        amount={amount}
        merchantName={merchantName}
        onSuccess={onSuccess}
        onBack={onBack}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  sub: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: "center",
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
  },
  payBtn: {
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  payBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  backLink: {
    paddingVertical: 10,
    alignSelf: "center",
  },
  backLinkText: {
    fontSize: 14,
  },
  loadingWrap: {
    paddingVertical: 32,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  unsupportedWrap: {
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  unsupportedText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "700",
  },
});
