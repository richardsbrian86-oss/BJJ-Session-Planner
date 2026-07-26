import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useClientAuth } from "@/lib/client-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock, Package, ExternalLink, Dumbbell, ChevronRight, Mail } from "lucide-react";
import { formatCurrency, formatDateLong, formatTime12 } from "@/lib/utils";

const ACCENT = "#1aab90";
const ACCENT_DARK = "#128a74";

interface Booking {
  id: number;
  date: string;
  time: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  serviceName: string;
  servicePrice: number;
  packageCount: number | null;
  packageTotal: number | null;
  paymentStatus: string;
  cancellationToken: string | null;
  instructorName: string | null;
  instructorSlug: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  scheduled: { bg: "rgba(26,171,144,0.1)",   color: "#1aab90",  label: "Upcoming"  },
  completed: { bg: "rgba(34,197,94,0.1)",    color: "#4ade80",  label: "Completed" },
  cancelled: { bg: "rgba(255,255,255,0.05)", color: "#4a5568",  label: "Cancelled" },
  no_show:   { bg: "rgba(239,68,68,0.1)",    color: "#f87171",  label: "No Show"   },
};

function BookingCard({ booking }: { booking: Booking }) {
  const isPast = booking.status !== "scheduled";
  const amount = booking.packageTotal ?? booking.servicePrice;
  const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.cancelled;

  return (
    <div style={{ backgroundColor: "#0d1422", border: `1px solid ${isPast ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)"}`, borderRadius: 14, padding: "18px 20px", opacity: isPast ? 0.72 : 1, transition: "border-color 0.15s" }}
      onMouseEnter={(e) => { if (!isPast) e.currentTarget.style.borderColor = "rgba(26,171,144,0.25)"; }}
      onMouseLeave={(e) => { if (!isPast) e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: "#eef0f4", margin: "0 0 3px", lineHeight: 1.3 }}>{booking.serviceName}</p>
          {booking.instructorName && (
            <p style={{ fontSize: 13, color: "#4a5568", margin: 0 }}>with {booking.instructorName}</p>
          )}
        </div>
        <span style={{ backgroundColor: cfg.bg, color: cfg.color, padding: "3px 11px", borderRadius: 100, fontSize: 11, fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" }}>
          {cfg.label}
        </span>
      </div>

      {/* Details grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "#4a5568" }}>
          <Calendar style={{ width: 13, height: 13, flexShrink: 0 }} />
          <span>{formatDateLong(booking.date)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "#4a5568" }}>
          <Clock style={{ width: 13, height: 13, flexShrink: 0 }} />
          <span>{formatTime12(booking.time)}</span>
        </div>
        {(booking.packageCount ?? 0) > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "#4a5568" }}>
            <Package style={{ width: 13, height: 13, flexShrink: 0 }} />
            <span>{booking.packageCount} session package</span>
          </div>
        )}
        <div style={{ fontSize: 13, fontWeight: 700, color: "#eef0f4" }}>{formatCurrency(amount)}</div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        {booking.instructorSlug && (
          <Link href={`/${booking.instructorSlug}`} style={{ flex: 1, textDecoration: "none" }}>
            <button style={{ width: "100%", backgroundColor: "rgba(26,171,144,0.08)", border: "1px solid rgba(26,171,144,0.2)", color: ACCENT, fontSize: 13, fontWeight: 600, padding: "8px 12px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
              <Dumbbell style={{ width: 13, height: 13 }} />Book Again
            </button>
          </Link>
        )}
        {booking.cancellationToken && booking.status === "scheduled" && (
          <Link href={`/booking/${booking.cancellationToken}`} style={{ flex: 1, textDecoration: "none" }}>
            <button style={{ width: "100%", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#8b9ab3", fontSize: 13, fontWeight: 600, padding: "8px 12px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
              <ExternalLink style={{ width: 13, height: 13 }} />Manage
            </button>
          </Link>
        )}
      </div>
    </div>
  );
}

export default function ClientDashboard() {
  const [, navigate] = useLocation();
  const { client, token, isAuthenticated, isLoading: authLoading } = useClientAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/login");
  }, [authLoading, isAuthenticated, navigate]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["client-bookings", token],
    queryFn: async () => {
      const res = await fetch("/api/clients/bookings", { headers: { "x-client-token": token! } });
      const json = await res.json();
      if (res.status === 403 && json.error === "Email verification required") {
        throw Object.assign(new Error("EMAIL_UNVERIFIED"), { code: "EMAIL_UNVERIFIED" });
      }
      if (!res.ok) throw new Error("Failed to load bookings");
      return json as { bookings: Booking[] };
    },
    enabled: !!token && isAuthenticated,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const emailUnverified = (error as (Error & { code?: string }) | null)?.code === "EMAIL_UNVERIFIED";

  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#070b14" }}>
        <div style={{ width: 24, height: 24, border: `2px solid ${ACCENT}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const upcoming = data?.bookings.filter((b) => b.status === "scheduled") ?? [];
  const past = data?.bookings.filter((b) => b.status !== "scheduled") ?? [];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#070b14", color: "#eef0f4", fontFamily: "'Inter', sans-serif" }}>
      {/* Page header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", backgroundColor: "#0b101d", padding: "24px 24px 22px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.02em" }}>
              My Bookings
            </h1>
            <p style={{ fontSize: 13, color: "#4a5568", margin: 0 }}>{client?.email}</p>
          </div>
          <Link href="/" style={{ textDecoration: "none" }}>
            <button style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`, color: "#fff", fontWeight: 700, fontSize: 13, padding: "9px 18px", border: "none", borderRadius: 9, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, boxShadow: `0 3px 12px rgba(26,171,144,0.3)`, fontFamily: "inherit" }}>
              <Dumbbell style={{ width: 14, height: 14 }} />Find Instructors
            </button>
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 24px 56px" }}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3].map((n) => <Skeleton key={n} className="h-36 w-full rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />)}
          </div>
        ) : emailUnverified ? (
          <div style={{ backgroundColor: "#0d1422", border: "1px solid rgba(26,171,144,0.25)", borderRadius: 14, padding: "36px 28px", textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(26,171,144,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Mail style={{ width: 24, height: 24, color: "#1aab90" }} />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#eef0f4", margin: "0 0 8px" }}>Verify your email to view bookings</h2>
            <p style={{ fontSize: 13, color: "#8b9ab3", margin: "0 0 20px", lineHeight: 1.6 }}>
              We sent a verification link to <strong style={{ color: "#eef0f4" }}>{client?.email}</strong>.<br />
              Click the link in that email, then come back here.
            </p>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`, color: "#fff", fontWeight: 700, fontSize: 14, padding: "11px 24px", border: "none", borderRadius: 9, cursor: isFetching ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: `0 3px 12px rgba(26,171,144,0.3)`, fontFamily: "inherit", opacity: isFetching ? 0.7 : 1, marginBottom: 16 }}
            >
              {isFetching ? (
                <>
                  <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  Checking…
                </>
              ) : (
                <>✓ I've verified — check now</>
              )}
            </button>
            <p style={{ fontSize: 12, color: "#4a5568", margin: 0 }}>Didn't receive it? Check your spam folder or wait a few minutes.</p>
          </div>
        ) : (
          <>
            {/* Upcoming */}
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", letterSpacing: "0.07em", marginBottom: 14 }}>
                UPCOMING ({upcoming.length})
              </h2>
              {upcoming.length === 0 ? (
                <div style={{ backgroundColor: "#0d1422", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 14, padding: "36px 24px", textAlign: "center" }}>
                  <Calendar style={{ width: 32, height: 32, color: "#374151", margin: "0 auto 12px" }} />
                  <p style={{ fontWeight: 600, fontSize: 15, margin: "0 0 6px" }}>No upcoming sessions</p>
                  <p style={{ fontSize: 13, color: "#4a5568", margin: "0 0 18px" }}>Browse instructors to book your next session.</p>
                  <Link href="/" style={{ textDecoration: "none" }}>
                    <button style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`, color: "#fff", fontWeight: 700, fontSize: 13, padding: "10px 20px", border: "none", borderRadius: 9, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, boxShadow: `0 3px 12px rgba(26,171,144,0.3)`, fontFamily: "inherit" }}>
                      Find Instructors <ChevronRight style={{ width: 14, height: 14 }} />
                    </button>
                  </Link>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {upcoming.map((b) => <BookingCard key={b.id} booking={b} />)}
                </div>
              )}
            </section>

            {/* Past */}
            {past.length > 0 && (
              <section>
                <h2 style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", letterSpacing: "0.07em", marginBottom: 14 }}>
                  PAST SESSIONS ({past.length})
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {past.map((b) => <BookingCard key={b.id} booking={b} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
