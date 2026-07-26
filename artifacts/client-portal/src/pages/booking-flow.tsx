import { useState, useEffect } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { useGetPublicProfile, getGetPublicProfileQueryKey } from "@workspace/api-client-react";
import { ServiceSelection } from "@/components/booking/service-selection";
import { DatePicker } from "@/components/booking/date-picker";
import { TimePicker } from "@/components/booking/time-picker";
import { WaiverStep } from "@/components/booking/waiver-step";
import { ClientDetails } from "@/components/booking/client-details";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Loader2 } from "lucide-react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";

const STEP_LABELS = ["Service", "Date", "Time", "Waiver", "Confirm"];

export default function BookingFlow() {
  const [match, params] = useRoute("/:slug/book");
  const slug = params?.slug || "";
  const [, setLocation] = useLocation();

  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

  useEffect(() => {
    fetch("/api/public/stripe-key")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { publishableKey?: string } | null) => {
        if (data?.publishableKey) {
          setStripePromise(loadStripe(data.publishableKey));
        }
      })
      .catch(() => {});
  }, []);

  const [step, setStep] = useState(1);
  const [bookingData, setBookingData] = useState({
    serviceId: null as number | null,
    packageCount: 1,
    isSubscription: false,
    date: null as Date | null,
    time: null as string | null,
    waiverId: null as number | null,
    clientName: "",
    clientEmail: "",
  });

  const { data, isLoading, error } = useGetPublicProfile(slug, {
    query: {
      enabled: !!slug,
      queryKey: getGetPublicProfileQueryKey(slug),
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container max-w-md mx-auto py-16 px-4 text-center">
        <h1 className="text-2xl font-bold mb-2">Error loading booking</h1>
        <p className="text-muted-foreground mb-8">
          Unable to load availability. Please try again.
        </p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const { instructor, services, availability } = data;

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      setLocation(`/${slug}`);
    }
  };

  const handleNext = () => {
    setStep(step + 1);
  };

  const selectedService = services.find(s => s.id === bookingData.serviceId);

  const stepTitle = [
    "Select Service",
    "Choose Date",
    "Select Time",
    "Sign Waiver",
    "Confirm Booking",
  ][step - 1] ?? "";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/50">
        <div className="container max-w-md mx-auto h-14 flex items-center px-4 relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 text-muted-foreground hover:text-foreground"
            onClick={handleBack}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="w-full text-center font-medium">{stepTitle}</div>
        </div>
        <div className="w-full h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300 ease-in-out"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>
      </header>

      <main className="flex-1 container max-w-md mx-auto py-6 px-4 pb-24">
        {step === 1 && (
          <ServiceSelection
            services={services}
            value={bookingData}
            onChange={(data) => setBookingData({ ...bookingData, ...data })}
            onNext={handleNext}
          />
        )}

        {step === 2 && (
          <DatePicker
            availability={availability}
            value={bookingData.date}
            onChange={(date) => setBookingData({ ...bookingData, date, time: null })}
            onNext={handleNext}
          />
        )}

        {step === 3 && bookingData.date && (
          <TimePicker
            slug={slug}
            date={bookingData.date}
            value={bookingData.time}
            onChange={(time) => setBookingData({ ...bookingData, time })}
            onNext={handleNext}
          />
        )}

        {step === 4 && (
          <WaiverStep
            slug={slug}
            onComplete={({ waiverId, clientName, clientEmail }) => {
              setBookingData({ ...bookingData, waiverId, clientName, clientEmail });
              handleNext();
            }}
          />
        )}

        {step === 5 && selectedService && bookingData.date && bookingData.time && bookingData.waiverId !== null && (
          <ClientDetails
            slug={slug}
            instructor={instructor}
            service={selectedService}
            bookingData={{
              packageCount: bookingData.packageCount,
              isSubscription: bookingData.isSubscription,
              date: bookingData.date,
              time: bookingData.time,
            }}
            waiverId={bookingData.waiverId}
            prefilledName={bookingData.clientName}
            prefilledEmail={bookingData.clientEmail}
            stripePromise={stripePromise}
            onSuccess={(session) => {
              if (session.cancellationToken) {
                setLocation(`/booking/${session.cancellationToken}`);
              } else {
                setLocation(`/${slug}/success`, { state: { session } });
              }
            }}
          />
        )}
      </main>
    </div>
  );
}
