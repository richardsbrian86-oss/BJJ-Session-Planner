import { useState } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Service,
  usePublicCreatePaymentIntent,
  usePublicCreateSubscription,
  usePublicCreateSession
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { Loader2, AlertCircle, FileText, CheckCircle2 } from "lucide-react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import type { Stripe } from "@stripe/stripe-js";
import type { BookingSessionData } from "@/types/booking";

interface Instructor {
  id: number;
  name: string;
  slug: string;
}

interface ClientDetailsProps {
  slug: string;
  instructor: Instructor;
  service: Service;
  bookingData: {
    packageCount: number;
    isSubscription: boolean;
    date: Date;
    time: string;
  };
  waiverId?: number | string | null;
  prefilledName?: string;
  prefilledEmail?: string;
  stripePromise: Promise<Stripe | null> | null;
  onSuccess: (session: BookingSessionData) => void;
}

const formSchema = z.object({
  clientName: z.string().min(2, "Name is required"),
  clientEmail: z.string().email("Valid email is required"),
  clientPhone: z.string().min(5, "Phone number is required"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const PACKAGE_DISCOUNT = 0.2;

function computeDisplayTotal(unitPrice: number, packageCount: number): number {
  const subtotal = unitPrice * packageCount;
  const discount = packageCount > 1 ? subtotal * PACKAGE_DISCOUNT : 0;
  return Math.round(subtotal - discount);
}

type WaiverStatus = {
  isExternalStudent: boolean;
  waiverSigned: boolean;
} | null;

export function ClientDetails({ slug, instructor, service, bookingData, waiverId, prefilledName, prefilledEmail, stripePromise, onSuccess }: ClientDetailsProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [confirmedSubscriptionId, setConfirmedSubscriptionId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormValues | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const [waiverStatus, setWaiverStatus] = useState<WaiverStatus>(null);
  const [waiverChecking, setWaiverChecking] = useState(false);
  const [waiverSigning, setWaiverSigning] = useState(false);
  const [waiverError, setWaiverError] = useState<string | null>(null);
  const [waiverConfirmed, setWaiverConfirmed] = useState(false);

  const displayTotal = computeDisplayTotal(service.price, bookingData.packageCount);

  const createIntent = usePublicCreatePaymentIntent();
  const createSubscription = usePublicCreateSubscription();
  const createSession = usePublicCreateSession();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientName: prefilledName || "",
      clientEmail: prefilledEmail || "",
      clientPhone: "",
      notes: "",
    },
  });

  const stripeConfigured = stripePromise !== null;

  const checkWaiverStatus = async (email: string): Promise<WaiverStatus> => {
    setWaiverChecking(true);
    setWaiverError(null);
    try {
      const res = await fetch(`/api/public/waiver-status?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json() as WaiverStatus;
        setWaiverStatus(data);
        return data;
      }
    } catch {
    } finally {
      setWaiverChecking(false);
    }
    return waiverStatus;
  };

  const handleEmailBlur = async () => {
    const email = form.getValues("clientEmail");
    if (email && z.string().email().safeParse(email).success) {
      await checkWaiverStatus(email);
    }
  };

  const handleSignWaiver = async () => {
    if (!waiverConfirmed) {
      setWaiverError("Please confirm you have read and agree to the waiver before signing.");
      return;
    }

    const email = form.getValues("clientEmail");
    if (!email) return;

    setWaiverSigning(true);
    setWaiverError(null);
    try {
      const res = await fetch("/api/public/waiver/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, instructorName: instructor.name }),
      });

      if (res.ok) {
        await checkWaiverStatus(email);
      } else if (res.status === 404) {
        setWaiverError("Email not found in our system. Please ensure you have an account.");
      } else {
        setWaiverError("Failed to record waiver. Please try again.");
      }
    } catch {
      setWaiverError("Failed to record waiver. Please try again.");
    } finally {
      setWaiverSigning(false);
    }
  };

  const needsWaiver =
    waiverStatus !== null &&
    waiverStatus.isExternalStudent &&
    !waiverStatus.waiverSigned;

  const onSubmitDetails = async (values: FormValues) => {
    const freshStatus = await checkWaiverStatus(values.clientEmail);
    const blocked = freshStatus !== null && freshStatus.isExternalStudent && !freshStatus.waiverSigned;
    if (blocked) {
      setSetupError("Please sign the liability waiver before proceeding.");
      return;
    }

    if (!stripeConfigured) {
      setSetupError("Payment is not configured for this booking portal. Please contact the instructor directly.");
      return;
    }

    setFormData(values);
    setIsInitializing(true);
    setSetupError(null);

    try {
      if (bookingData.isSubscription) {
        const res = await createSubscription.mutateAsync({
          slug,
          data: {
            email: values.clientEmail,
            serviceId: service.id,
            packageCount: bookingData.packageCount,
            interval: "monthly",
          }
        });
        
        if (res.clientSecret) {
          setClientSecret(res.clientSecret);
          setConfirmedSubscriptionId(res.subscriptionId);
        } else if (res.subscriptionId) {
          // Subscription is immediately active — no additional auth needed
          setConfirmedSubscriptionId(res.subscriptionId);
          await handleCreateSession(values, null, res.subscriptionId);
        } else {
          setSetupError("Failed to initialize subscription. Please try again.");
        }
      } else {
        const res = await createIntent.mutateAsync({
          slug,
          data: {
            serviceId: service.id,
            packageCount: bookingData.packageCount,
            clientName: values.clientName,
          }
        });
        
        if (res.clientSecret) {
          setClientSecret(res.clientSecret);
        } else {
          setSetupError("Failed to initialize payment. Please try again.");
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to initialize payment. Please try again.";
      console.error("Payment initialization error:", err);
      setSetupError(message);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleCreateSession = async (
    values: FormValues,
    paymentIntentId: string | null,
    resolvedSubscriptionId: string | null
  ) => {
    try {
      const formattedDate = format(bookingData.date, "yyyy-MM-dd");
      
      const sessionRes = await createSession.mutateAsync({
        slug,
        data: {
          clientName: values.clientName,
          clientEmail: values.clientEmail,
          clientPhone: values.clientPhone,
          date: formattedDate,
          time: bookingData.time,
          paymentIntentId: paymentIntentId || undefined,
          subscriptionId: resolvedSubscriptionId || undefined,
          notes: values.notes,
          waiverId: waiverId != null ? Number(waiverId) : undefined,
        },
      });
      
      onSuccess({
        id: sessionRes.id,
        date: sessionRes.date,
        time: sessionRes.time,
        serviceName: sessionRes.serviceName,
        servicePrice: sessionRes.servicePrice,
        packageCount: sessionRes.packageCount ?? null,
        packageTotal: sessionRes.packageTotal ?? null,
        instructorSlug: slug,
        instructorName: instructor.name,
        cancellationToken: sessionRes.cancellationToken ?? null,
        paymentIntentId: sessionRes.paymentIntentId ?? null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to finalize booking. Please contact the instructor.";
      console.error("Session creation error:", err);
      setSetupError(message);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-card/50 border border-border/50 rounded-xl p-5 mb-6">
        <h3 className="font-semibold mb-3">Booking Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Service</span>
            <span className="font-medium text-right">{service.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date & Time</span>
            <span className="font-medium text-right">
              {format(bookingData.date, "MMM d")} at {bookingData.time}
            </span>
          </div>
          {bookingData.packageCount > 1 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Package</span>
              <span className="font-medium text-right">{bookingData.packageCount} Sessions</span>
            </div>
          )}
          <div className="pt-2 mt-2 border-t border-border/50 flex justify-between font-bold">
            <span>Total {bookingData.isSubscription ? '/ mo' : ''}</span>
            <span>{formatCurrency(displayTotal)}</span>
          </div>
        </div>
      </div>

      {!stripeConfigured && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold mb-1">Online Booking Unavailable</p>
            <p>Payment is not configured for this portal. Please contact the instructor directly to schedule a session.</p>
          </div>
        </div>
      )}

      {setupError && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl text-sm flex gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{setupError}</span>
        </div>
      )}

      {!clientSecret ? (
        <div className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight">Your Details</h2>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitDetails)} className="space-y-4">
              <FormField
                control={form.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" className="bg-card" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="clientEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="john@example.com"
                        className="bg-card"
                        {...field}
                        onBlur={async (e) => {
                          field.onBlur();
                          if (e.target.value) await handleEmailBlur();
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="clientPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="+1 (555) 000-0000" className="bg-card" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Any notes for the instructor? (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Experience level, injuries, goals..." 
                        className="bg-card resize-none" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {waiverChecking && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking waiver status…</span>
                </div>
              )}

              {needsWaiver && (
                <div className="border border-amber-500/40 bg-amber-500/10 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold text-sm text-amber-200">Liability Waiver Required</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        As an external student, you must sign the liability waiver before booking. By signing, you acknowledge
                        that participation in martial arts training involves risk of injury. You agree to release the instructor
                        and facility from liability for injuries sustained during training sessions.
                      </p>
                    </div>
                  </div>

                  <label className="flex items-start gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={waiverConfirmed}
                      onChange={(e) => {
                        setWaiverConfirmed(e.target.checked);
                        setWaiverError(null);
                      }}
                      className="mt-0.5 accent-amber-400"
                    />
                    <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                      I have read and agree to the liability waiver terms above.
                    </span>
                  </label>

                  {waiverError && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {waiverError}
                    </p>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full border-amber-500/50 text-amber-200 hover:bg-amber-500/20"
                    onClick={handleSignWaiver}
                    disabled={waiverSigning}
                  >
                    {waiverSigning ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Recording Waiver…</>
                    ) : (
                      <><FileText className="w-4 h-4 mr-2" /> Sign Waiver</>
                    )}
                  </Button>
                </div>
              )}

              {waiverStatus?.isExternalStudent && waiverStatus?.waiverSigned && (
                <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>Liability waiver on record — you're cleared to book.</span>
                </div>
              )}

              <div className="pt-4">
                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full h-14 text-base rounded-xl"
                  disabled={isInitializing || !stripeConfigured || needsWaiver}
                >
                  {isInitializing ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Preparing Payment...</>
                  ) : needsWaiver ? (
                    "Sign Waiver to Continue"
                  ) : stripeConfigured ? (
                    `Proceed to Payment (${formatCurrency(displayTotal)})`
                  ) : (
                    "Payment Unavailable"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-500">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Payment</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Paying {instructor.name}
            </p>
          </div>
          {stripePromise && clientSecret && (
            <Elements stripe={stripePromise} options={{ 
              clientSecret,
              appearance: {
                theme: 'night',
                variables: {
                  colorPrimary: '#1aab90',
                  colorBackground: '#121217',
                  colorText: '#ffffff',
                  colorDanger: '#df1b41',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  borderRadius: '8px',
                }
              } 
            }}>
              <CheckoutForm
                mode={bookingData.isSubscription ? "subscription" : "payment"}
                onPaymentSuccess={(paymentIntentId) => {
                  if (formData) handleCreateSession(formData, paymentIntentId, confirmedSubscriptionId);
                }}
                onSubscriptionSuccess={() => {
                  if (formData) handleCreateSession(formData, null, confirmedSubscriptionId);
                }}
              />
            </Elements>
          )}
        </div>
      )}
    </div>
  );
}

interface CheckoutFormProps {
  mode: "payment" | "subscription";
  onPaymentSuccess: (paymentIntentId: string) => void;
  onSubscriptionSuccess: () => void;
}

function CheckoutForm({ mode, onPaymentSuccess, onSubscriptionSuccess }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message || "An error occurred during payment.");
      setIsProcessing(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      if (mode === "subscription") {
        onSubscriptionSuccess();
      } else {
        onPaymentSuccess(paymentIntent.id);
      }
      return;
    }

    setError("Payment could not be confirmed. Please try again or contact the instructor.");
    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm border border-destructive/20">
          {error}
        </div>
      )}
      <Button 
        type="submit" 
        disabled={!stripe || isProcessing}
        size="lg"
        className="w-full h-14 text-base rounded-xl"
      >
        {isProcessing ? (
          <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
        ) : (
          "Pay & Confirm Booking"
        )}
      </Button>
    </form>
  );
}
