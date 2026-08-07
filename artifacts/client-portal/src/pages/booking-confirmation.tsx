import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2,
  XCircle,
  Calendar,
  Clock,
  Package,
  User,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { formatCurrency, formatTime12, formatDateLong } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface BookingDetail {
  session: {
    id: number;
    date: string;
    time: string;
    status: string;
    serviceName: string;
    servicePrice: number;
    packageCount: number | null;
    packageTotal: number | null;
    clientName: string;
    notes: string | null;
    createdAt: string;
  };
  instructor: {
    name: string;
    slug: string;
  };
}

export default function BookingConfirmation() {
  const [, params] = useRoute("/booking/:token");
  const token = params?.token || "";
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<BookingDetail>({
    queryKey: ["booking", token],
    queryFn: async () => {
      const r = await fetch(`/api/public/booking/${encodeURIComponent(token)}`);
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || "Failed to load booking");
      }
      return r.json() as Promise<BookingDetail>;
    },
    retry: false,
    enabled: !!token,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(
        `/api/public/booking/${encodeURIComponent(token)}`,
        { method: "DELETE" }
      );
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || "Cancellation failed");
      }
      return r.json();
    },
    onSuccess: () => {
      setCancelError(null);
      setCancelConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["booking", token] });
    },
    onError: (err: Error) => {
      setCancelError(err.message);
      setCancelConfirm(false);
    },
  });

  useEffect(() => {
    if (!error && !data) return undefined;
    if (error || !data) {
      document.title = "Booking Not Found — Let's Roll";
      let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "robots";
        document.head.appendChild(meta);
      }
      meta.content = "noindex, follow";
      return () => {
        meta!.content = "index, follow";
      };
    }
    return undefined;
  }, [data, error]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-6">
          <XCircle className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Booking Not Found</h1>
        <p className="text-muted-foreground mb-8">
          This booking link is invalid or has expired.
        </p>
        <Button variant="outline" onClick={() => setLocation("/")}>
          Return Home
        </Button>
      </div>
    );
  }

  const { session, instructor } = data;

  const isCancelled = session.status === "cancelled";
  const isCompleted = session.status === "completed";
  const canCancel = !isCancelled && !isCompleted;

  const dateStr = formatDateLong(session.date);
  const timeStr = formatTime12(session.time);

  return (
    <div className="min-h-screen container max-w-md mx-auto py-12 px-4 flex flex-col">
      <div className="flex-1">
        <div className="text-center mb-8">
          {isCancelled ? (
            <>
              <div className="w-20 h-20 bg-muted text-muted-foreground rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight mb-2">Booking Cancelled</h1>
              <p className="text-muted-foreground">This session has been cancelled.</p>
            </>
          ) : isCompleted ? (
            <>
              <div className="w-20 h-20 bg-primary/20 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight mb-2">Session Completed</h1>
              <p className="text-muted-foreground">Great work on this session!</p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight mb-2">Booking Confirmed</h1>
              <p className="text-muted-foreground">Your session is scheduled.</p>
            </>
          )}
        </div>

        <Card className="mb-6 border-border/50 bg-card/50">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <div className="text-sm text-muted-foreground">Instructor</div>
                <div className="font-medium">{instructor.name}</div>
              </div>
            </div>

            <div className="pt-3 border-t border-border/50">
              <div className="text-sm text-muted-foreground">Client</div>
              <div className="font-medium">{session.clientName}</div>
            </div>

            <div className="pt-3 border-t border-border/50">
              <div className="text-sm text-muted-foreground">Service</div>
              <div className="font-medium">{session.serviceName}</div>
            </div>

            {(session.packageCount ?? 0) > 1 && (
              <div className="flex items-start gap-3 pt-3 border-t border-border/50">
                <Package className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <div className="text-sm text-muted-foreground">Package</div>
                  <div className="font-medium">{session.packageCount} Sessions</div>
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
                <div className="font-medium">{timeStr}</div>
              </div>
            </div>

            {(session.packageTotal || session.servicePrice) > 0 && (
              <div className="flex justify-between items-center pt-4 border-t border-border/50">
                <div className="text-muted-foreground">Amount</div>
                <div className="font-bold text-lg">
                  {formatCurrency(session.packageTotal || session.servicePrice)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {cancelError && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-4 text-sm flex gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{cancelError}</span>
          </div>
        )}

        {canCancel && !cancelConfirm && (
          <Button
            variant="outline"
            className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setCancelConfirm(true)}
          >
            Cancel This Booking
          </Button>
        )}

        {canCancel && cancelConfirm && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-5 space-y-4">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm mb-1">Cancel this session?</p>
                <p className="text-sm text-muted-foreground">
                  This will cancel your session on {dateStr} at {timeStr}.
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setCancelConfirm(false)}
                disabled={cancelMutation.isPending}
              >
                Keep Booking
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cancelling...</>
                ) : (
                  "Yes, Cancel"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8">
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => setLocation(`/${instructor.slug}`)}
        >
          Book Another Session
        </Button>
      </div>
    </div>
  );
}
