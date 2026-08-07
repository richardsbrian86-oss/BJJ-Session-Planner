import React, { useState } from "react";
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

let Elements: React.ComponentType<{ stripe: Promise<unknown> | null; options: object; children: React.ReactNode }> | null = null;
let PaymentElement: React.ComponentType<{ onReady?: () => void; options?: object }> | null = null;
let useStripeWeb: (() => { confirmPayment: (opts: object) => Promise<{ error?: { message?: string }; paymentIntent?: { id: string; status: string } }> }) | null = null;
let useElements: (() => object | null) | null = null;
let loadStripe: ((key: string) => Promise<unknown>) | null = null;

try {
  const stripeReact = require("@stripe/react-stripe-js");
  Elements = stripeReact.Elements;
  PaymentElement = stripeReact.PaymentElement;
  useStripeWeb = stripeReact.useStripe;
  useElements = stripeReact.useElements;
  const stripeJs = require("@stripe/stripe-js");
  loadStripe = stripeJs.loadStripe;
} catch {
  // Stripe web SDK not available
}

interface CheckoutFormInnerProps {
  amount: number;
  onSuccess: (paymentIntentId: string) => void;
  onBack: () => void;
  colors: ReturnType<typeof useColors>;
}

function WebCheckoutFormInner({ amount, onSuccess, onBack, colors }: CheckoutFormInnerProps) {
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [ready, setReady] = useState(false);

  const stripe = useStripeWeb ? useStripeWeb() : null;
  const elements = useElements ? useElements() : null;

  async function handlePay() {
    if (!stripe || !elements) return;
    setError(null);
    setPaying(true);
    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {},
        redirect: "if_required",
      } as object);
      if (result.error) {
        setError(result.error.message ?? "Payment failed. Please try again.");
      } else if (result.paymentIntent && result.paymentIntent.status === "succeeded") {
        onSuccess(result.paymentIntent.id);
      } else {
        setError("Payment could not be completed. Please try again.");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setPaying(false);
    }
  }

  const PayEl = PaymentElement as React.ComponentType<{ onReady?: () => void; options?: object }>;

  return (
    <View>
      <View style={styles.paymentElementWrap}>
        <PayEl onReady={() => setReady(true)} options={{ layout: "tabs" }} />
      </View>

      {error && (
        <View style={[styles.errorBox, { backgroundColor: "#FF3B3018", borderColor: "#FF3B3040" }]}>
          <Text style={[styles.errorText, { color: "#FF3B30" }]}>{error}</Text>
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

  if (!Elements || !loadStripe) {
    return (
      <View style={styles.unsupportedWrap}>
        <Text style={[styles.unsupportedText, { color: colors.mutedForeground }]}>
          Payment can only be completed on the web version of this app.
        </Text>
        <TouchableOpacity style={styles.backLink} onPress={onBack}>
          <Text style={[styles.backLinkText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const stripePromise = loadStripe(publishableKey);

  const ElProvider = Elements as React.ComponentType<{
    stripe: Promise<unknown> | null;
    options: { clientSecret: string; appearance: object };
    children: React.ReactNode;
  }>;

  const appearance = {
    theme: "night" as const,
    variables: {
      colorPrimary: colors.primary,
      colorBackground: colors.card,
      colorText: colors.foreground,
      colorDanger: "#FF3B30",
      fontFamily: "Inter, system-ui, sans-serif",
      borderRadius: "8px",
    },
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.foreground }]}>Payment</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
        Complete your payment to confirm the booking.
      </Text>
      {(sessionDescription || sessionDate) ? (
        <View style={[styles.merchantRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.merchantLabel, { color: colors.mutedForeground }]}>Session</Text>
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            {sessionDescription ? (
              <Text style={[styles.merchantName, { color: colors.foreground }]}>{sessionDescription}</Text>
            ) : null}
            {sessionDate ? (
              <Text style={[styles.merchantLabel, { color: colors.mutedForeground }]}>{sessionDate}</Text>
            ) : null}
          </View>
        </View>
      ) : null}
      {merchantName ? (
        <View style={[styles.merchantRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.merchantLabel, { color: colors.mutedForeground }]}>Paying to</Text>
          <Text style={[styles.merchantName, { color: colors.foreground }]}>{merchantName}</Text>
        </View>
      ) : null}
      <ElProvider stripe={stripePromise} options={{ clientSecret, appearance }}>
        <WebCheckoutFormInner
          amount={amount}
          onSuccess={onSuccess}
          onBack={onBack}
          colors={colors}
        />
      </ElProvider>
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
  paymentElementWrap: {
    marginBottom: 16,
    minHeight: 200,
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
  merchantRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  merchantLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  merchantName: {
    fontSize: 14,
    fontWeight: "700",
  },
});
