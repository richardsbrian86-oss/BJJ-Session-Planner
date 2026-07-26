import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Calendar, Clock, Package, User, Link as LinkIcon, CreditCard, Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import type { BookingSessionData } from "@/types/booking";

const APP_STORE_URL = import.meta.env.VITE_APP_STORE_URL as string | undefined;
const PLAY_STORE_URL = import.meta.env.VITE_PLAY_STORE_URL as string | undefined;

interface ReceiptData {
  last4: string | null;
  receiptUrl: string | null;
  amount: number | null;
}

export default function BookingSuccess() {
  const [, setLocation] = useLocation();
  const sessionData = (
    window.history.state as { state?: { session?: BookingSessionData } }
  )?.state?.session;

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  useEffect(() => {
    if (!sessionData?.cancellationToken || !sessionData?.paymentIntentId) return;
    fetch(
      `/api/public/booking/${encodeURIComponent(sessionData.cancellationToken)}/receipt`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ReceiptData | null) => {
        if (data) setReceipt(data);
      })
      .catch(() => {});
  }, [sessionData?.cancellationToken, sessionData?.paymentIntentId]);

  if (!sessionData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Booking Confirmed!</h1>
        <p className="text-muted-foreground mb-8">
          Your training session has been successfully booked.
        </p>
        <Button onClick={() => setLocation("/")}>Back to Home</Button>
      </div>
    );
  }

  const dateStr = sessionData.date
    ? format(new Date(sessionData.date + "T00:00:00"), "EEEE, MMMM d, yyyy")
    : "";

  const hasAppLinks = APP_STORE_URL || PLAY_STORE_URL;

  return (
    <div className="min-h-screen container max-w-md mx-auto py-12 px-4 flex flex-col">
      <div className="flex-1">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Booking Confirmed!</h1>
          <p className="text-muted-foreground">
            Your session has been scheduled.
          </p>
        </div>

        {sessionData.cancellationToken && (
          <div className="mb-6 bg-primary/5 border border-primary/10 rounded-xl p-4 flex items-start gap-3">
            <LinkIcon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium mb-1">Save your booking link</p>
              <p className="text-xs text-muted-foreground mb-2">
                Use this link to view your booking or cancel if needed.
              </p>
              <button
                className="text-xs text-primary underline underline-offset-2 break-all text-left w-full"
                onClick={() => {
                  const url = `${window.location.origin}${import.meta.env.BASE_URL}booking/${sessionData.cancellationToken}`;
                  navigator.clipboard?.writeText(url).catch(() => {});
                  window.open(url, "_blank", "noopener,noreferrer");
                }}
              >
                {`${window.location.origin}${import.meta.env.BASE_URL}booking/${sessionData.cancellationToken}`}
              </button>
            </div>
          </div>
        )}

        <Card className="mb-6 border-border/50 bg-card/50">
          <CardContent className="p-6 space-y-4">
            {sessionData.instructorName && (
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <div className="text-sm text-muted-foreground">Instructor</div>
                  <div className="font-medium">{sessionData.instructorName}</div>
                </div>
              </div>
            )}

            <div className={`space-y-1 ${sessionData.instructorName ? "pt-3 border-t border-border/50" : ""}`}>
              <div className="text-sm text-muted-foreground">Service</div>
              <div className="font-medium">{sessionData.serviceName}</div>
            </div>

            {(sessionData.packageCount ?? 0) > 1 && (
              <div className="flex items-start gap-3 pt-3 border-t border-border/50">
                <Package className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <div className="text-sm text-muted-foreground">Package</div>
                  <div className="font-medium">{sessionData.packageCount} Sessions</div>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 pt-3 border-t border-border/50">
              <Calendar className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <div className="text-sm text-muted-foreground">Date</div>
                <div className="font-medium">{dateStr}</div>
              </div>
            </div>

            <div className="flex items-start gap-3 pt-3 border-t border-border/50">
              <Clock className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <div className="text-sm text-muted-foreground">Time</div>
                <div className="font-medium">{sessionData.time}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {sessionData.paymentIntentId && (
          <Card className="mb-8 border-green-500/20 bg-green-500/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-full bg-green-500/15 flex items-center justify-center">
                  <Receipt className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-sm font-semibold text-green-700 dark:text-green-400">Payment Receipt</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Amount Paid</span>
                  <span className="font-bold text-lg text-green-700 dark:text-green-400">
                    {formatCurrency(sessionData.packageTotal || sessionData.servicePrice || 0)}
                  </span>
                </div>
                {receipt?.last4 && (
                  <div className="flex justify-between items-center pt-2 border-t border-green-500/15">
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <CreditCard className="w-3.5 h-3.5" />
                      Card charged
                    </span>
                    <span className="font-mono text-sm">&bull;&bull;&bull;&bull; {receipt.last4}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-green-500/15">
                  <span className="text-xs text-muted-foreground">Transaction ref</span>
                  <span className="font-mono text-xs text-muted-foreground">{sessionData.paymentIntentId.slice(-12)}</span>
                </div>
                {receipt?.receiptUrl && (
                  <div className="pt-2 border-t border-green-500/15">
                    <a
                      href={receipt.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 w-full text-sm font-medium text-green-700 dark:text-green-400 hover:underline underline-offset-2"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      View full Stripe receipt →
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {!sessionData.paymentIntentId && (
          <div className="mb-8 flex justify-between items-center px-2">
            <span className="text-muted-foreground text-sm">Amount</span>
            <span className="font-bold text-lg">
              {formatCurrency(sessionData.packageTotal || sessionData.servicePrice || 0)}
            </span>
          </div>
        )}

        {hasAppLinks && (
          <div className="bg-primary/5 rounded-xl p-6 text-center border border-primary/10">
            <h3 className="font-semibold mb-2">Track Your Training</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Download the BJJ Training app to manage your sessions, track progress, and stay connected with your instructor.
            </p>
            <div className="flex gap-3 justify-center">
              {APP_STORE_URL && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.open(APP_STORE_URL, "_blank", "noopener,noreferrer")}
                >
                  iOS App
                </Button>
              )}
              {PLAY_STORE_URL && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.open(PLAY_STORE_URL, "_blank", "noopener,noreferrer")}
                >
                  Android App
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-8">
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => setLocation(`/${sessionData.instructorSlug || ""}`)}
        >
          Book Another Session
        </Button>
      </div>
    </div>
  );
}
