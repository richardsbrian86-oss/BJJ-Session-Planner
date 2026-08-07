import React, { useEffect, useState } from "react";
import { api } from "@/utils/apiClient";

let NativeStripeProvider: React.ComponentType<{
  publishableKey: string;
  googlePay?: { enabled: boolean; testEnv?: boolean };
  children: React.ReactNode;
}> | null = null;

try {
  NativeStripeProvider = require("@stripe/stripe-react-native").StripeProvider;
} catch {
  // stripe-react-native not available (e.g. Expo Go without dev build)
}

export function ConditionalStripeProvider({ children }: { children: React.ReactNode }) {
  const [publishableKey, setPublishableKey] = useState("");

  useEffect(() => {
    api.public.getStripeKey()
      .then((data) => { if (data.publishableKey) setPublishableKey(data.publishableKey); })
      .catch(() => {});
  }, []);

  if (NativeStripeProvider && publishableKey) {
    return (
      <NativeStripeProvider
        publishableKey={publishableKey}
        googlePay={{ enabled: true, testEnv: true }}
      >
        {children}
      </NativeStripeProvider>
    );
  }

  return <>{children}</>;
}
