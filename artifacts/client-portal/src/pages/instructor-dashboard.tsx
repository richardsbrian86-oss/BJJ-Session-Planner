import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useInstructorAuth } from "@/lib/instructor-auth";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar, Clock, DollarSign, Users, ExternalLink,
  Copy, Check, Plus, Pencil, Trash2, X, Loader2, Tag,
} from "lucide-react";
import { formatCurrency, formatDateLong, formatTime12 } from "@/lib/utils";

const ACCENT = "#1aab90";
const ACCENT_DARK = "#128a74";

/* ─── Types ─────────────────────────────────────────── */

interface Session {
  id: number;
  date: string;
  time: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  clientName: string;
  clientEmail: string;
  serviceName: string;
  servicePrice: number;
  packageCount: number | null;
  paymentStatus: string;
}

interface Service {
  id: number;
  name: string;
  price: number;
}

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  scheduled:  { bg: "rgba(26,171,144,0.1)",  color: "#1aab90", label: "Upcoming"  },
  completed:  { bg: "rgba(34,197,94,0.1)",   color: "#4ade80", label: "Completed" },
  cancelled:  { bg: "rgba(255,255,255,0.05)", color: "#4a5568", label: "Cancelled" },
  no_show:    { bg: "rgba(239,68,68,0.1)",   color: "#f87171", label: "No Show"   },
};

/* ─── Small components ───────────────────────────────── */

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ backgroundColor: "#0d1422", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#4a5568", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>{label}</span>
        <div style={{ color: ACCENT }}>{icon}</div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "#eef0f4", letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#4a5568", fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}

function SessionRow({ session }: { session: Session }) {
  const cfg = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.cancelled;
  const isPast = session.status !== "scheduled";
  return (
    <div style={{ backgroundColor: "#0d1422", border: `1px solid rgba(255,255,255,${isPast ? "0.04" : "0.07"})`, borderRadius: 12, padding: "14px 18px", display: "grid", gridTemplateColumns: "1fr auto", gap: "8px 16px", alignItems: "center", opacity: isPast ? 0.7 : 1 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#eef0f4", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.clientName}</div>
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "3px 12px" }}>
          <span style={{ fontSize: 12, color: "#4a5568", display: "flex", alignItems: "center", gap: 4 }}><Calendar style={{ width: 11, height: 11 }} />{formatDateLong(session.date)}</span>
          <span style={{ fontSize: 12, color: "#4a5568", display: "flex", alignItems: "center", gap: 4 }}><Clock style={{ width: 11, height: 11 }} />{formatTime12(session.time)}</span>
          <span style={{ fontSize: 12, color: "#4a5568" }}>{session.serviceName}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
        <span style={{ backgroundColor: cfg.bg, color: cfg.color, padding: "2px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" as const }}>{cfg.label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#eef0f4" }}>{formatCurrency(session.servicePrice)}</span>
      </div>
    </div>
  );
}

/* ─── Service form (add / edit inline) ──────────────── */

function ServiceForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: { name: string; price: string };
  onSave: (name: string, price: number) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(initial?.price ?? "");
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(parseFloat(price) * 100);
    if (!name.trim()) { setErr("Name is required."); return; }
    if (isNaN(cents) || cents <= 0) { setErr("Enter a valid price (e.g. 75.00)."); return; }
    setErr(null);
    onSave(name.trim(), cents);
  }

  const inp: React.CSSProperties = {
    backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 9, padding: "10px 13px", color: "#eef0f4", fontSize: 14,
    outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box",
  };

  return (
    <form onSubmit={submit} style={{ backgroundColor: "#111827", border: `1px solid rgba(26,171,144,0.25)`, borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Service name</label>
          <input style={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 1-hour private" autoFocus />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Price (USD)</label>
          <input style={{ ...inp, paddingLeft: 24 }} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="75.00" type="number" min="0" step="0.01" />
        </div>
      </div>
      {err && <p style={{ fontSize: 12, color: "#f87171", margin: 0 }}>{err}</p>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} style={{ background: "none", border: "1px solid rgba(255,255,255,0.08)", color: "#4a5568", fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
          <X size={13} /> Cancel
        </button>
        <button type="submit" disabled={saving} style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`, color: "#fff", fontSize: 13, fontWeight: 700, padding: "8px 18px", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, opacity: saving ? 0.7 : 1 }}>
          {saving ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Check size={13} />}
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

/* ─── Services section ───────────────────────────────── */

function ServicesSection({ token }: { token: string }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: services, isLoading } = useQuery<Service[]>({
    queryKey: ["instructor-services", token],
    queryFn: async () => {
      const res = await fetch("/api/services", { headers: { "x-instructor-token": token } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["instructor-services", token] });

  const createMut = useMutation({
    mutationFn: async ({ name, price }: { name: string; price: number }) => {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-instructor-token": token },
        body: JSON.stringify({ name, price }),
      });
      if (!res.ok) throw new Error("Failed to create service");
      return res.json();
    },
    onSuccess: () => { invalidate(); setAdding(false); },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, name, price }: { id: number; name: string; price: number }) => {
      const res = await fetch(`/api/services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-instructor-token": token },
        body: JSON.stringify({ name, price }),
      });
      if (!res.ok) throw new Error("Failed to update service");
      return res.json();
    },
    onSuccess: () => { invalidate(); setEditingId(null); },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/services/${id}`, {
        method: "DELETE",
        headers: { "x-instructor-token": token },
      });
      if (!res.ok) throw new Error("Failed to delete service");
    },
    onSuccess: invalidate,
  });

  return (
    <section style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", letterSpacing: "0.07em", margin: 0 }}>
          MY SERVICES ({services?.length ?? 0})
        </h2>
        {!adding && (
          <button
            onClick={() => { setAdding(true); setEditingId(null); }}
            style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`, color: "#fff", fontSize: 12, fontWeight: 700, padding: "6px 14px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, boxShadow: `0 2px 8px rgba(26,171,144,0.28)` }}
          >
            <Plus size={13} /> Add Service
          </button>
        )}
      </div>

      {adding && (
        <div style={{ marginBottom: 10 }}>
          <ServiceForm
            onSave={(name, price) => createMut.mutate({ name, price })}
            onCancel={() => setAdding(false)}
            saving={createMut.isPending}
          />
        </div>
      )}

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2].map((n) => <Skeleton key={n} className="h-16 w-full rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />)}
        </div>
      ) : !services?.length && !adding ? (
        <div style={{ backgroundColor: "#0d1422", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 14, padding: "32px 24px", textAlign: "center" }}>
          <Tag style={{ width: 28, height: 28, color: "#374151", margin: "0 auto 10px" }} />
          <p style={{ fontWeight: 600, fontSize: 14, margin: "0 0 5px" }}>No services yet</p>
          <p style={{ fontSize: 13, color: "#4a5568", margin: "0 0 16px" }}>Add services so clients know what you offer and what it costs.</p>
          <button onClick={() => setAdding(true)} style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`, color: "#fff", fontWeight: 700, fontSize: 13, padding: "10px 20px", border: "none", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 7, boxShadow: `0 3px 12px rgba(26,171,144,0.3)` }}>
            <Plus size={14} /> Add Your First Service
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(services ?? []).map((svc) =>
            editingId === svc.id ? (
              <ServiceForm
                key={svc.id}
                initial={{ name: svc.name, price: (svc.price / 100).toFixed(2) }}
                onSave={(name, price) => updateMut.mutate({ id: svc.id, name, price })}
                onCancel={() => setEditingId(null)}
                saving={updateMut.isPending}
              />
            ) : (
              <div key={svc.id} style={{ backgroundColor: "#0d1422", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#eef0f4", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{svc.name}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>{formatCurrency(svc.price)}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => { setEditingId(svc.id); setAdding(false); }}
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#8b9ab3", padding: "7px 10px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${svc.name}"?`)) deleteMut.mutate(svc.id); }}
                    disabled={deleteMut.isPending}
                    style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)", color: "#f87171", padding: "7px 10px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
}

/* ─── Main dashboard ─────────────────────────────────── */

export default function InstructorDashboard() {
  const [, navigate] = useLocation();
  const { instructor, token, isAuthenticated, isLoading: authLoading, logout } = useInstructorAuth();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/instructor/login");
  }, [authLoading, isAuthenticated, navigate]);

  const { data: sessions, isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ["instructor-sessions", token],
    queryFn: async () => {
      const res = await fetch("/api/sessions", { headers: { "x-instructor-token": token! } });
      if (!res.ok) throw new Error("Failed to load sessions");
      return res.json();
    },
    enabled: !!token && isAuthenticated,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (sessions ?? []).filter((s) => s.status === "scheduled" && s.date >= today);
  const past = (sessions ?? []).filter((s) => s.status !== "scheduled" || s.date < today);
  const totalRevenue = (sessions ?? [])
    .filter((s) => s.paymentStatus === "paid")
    .reduce((sum, s) => sum + s.servicePrice, 0);

  const bookingUrl = instructor?.slug ? `https://bjj-session-planner.replit.app/book/${instructor.slug}` : null;

  async function handleCopyLink() {
    if (!bookingUrl) return;
    await navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#070b14" }}>
        <div style={{ width: 24, height: 24, border: `2px solid ${ACCENT}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#070b14", color: "#eef0f4", fontFamily: "'Inter', sans-serif" }}>

      {/* Page header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", backgroundColor: "#0b101d", padding: "20px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexWrap: "wrap" as const, alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 2px", letterSpacing: "-0.02em" }}>{instructor?.name}'s Dashboard</h1>
            {instructor?.slug && <span style={{ fontSize: 13, color: "#4a5568" }}>@{instructor.slug}</span>}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
            {bookingUrl && (
              <button onClick={handleCopyLink} style={{ background: copied ? `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)` : "rgba(26,171,144,0.1)", border: `1px solid rgba(26,171,144,${copied ? "0" : "0.3"})`, color: copied ? "#fff" : ACCENT, fontSize: 13, fontWeight: 700, padding: "8px 16px", borderRadius: 9, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontFamily: "inherit", transition: "all 0.2s" }}>
                {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy booking link</>}
              </button>
            )}
            {bookingUrl && (
              <a href={bookingUrl} target="_blank" rel="noopener noreferrer" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#8b9ab3", fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 9, display: "flex", alignItems: "center", gap: 7, textDecoration: "none" }}>
                <ExternalLink size={14} /> View Page
              </a>
            )}
            <button onClick={() => { logout(); navigate("/"); }} style={{ background: "none", border: "1px solid rgba(255,255,255,0.08)", color: "#4a5568", fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px 60px" }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 32 }}>
          <StatCard icon={<Calendar size={18} />} label="Upcoming" value={upcoming.length} sub="sessions scheduled" />
          <StatCard icon={<Users size={18} />} label="Total Sessions" value={(sessions ?? []).length} sub="all time" />
          <StatCard icon={<DollarSign size={18} />} label="Revenue" value={formatCurrency(totalRevenue)} sub="paid sessions" />
        </div>

        {/* Services */}
        {token && <ServicesSection token={token} />}

        {/* Upcoming sessions */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", letterSpacing: "0.07em", marginBottom: 14 }}>
            UPCOMING SESSIONS ({upcoming.length})
          </h2>
          {sessionsLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1, 2, 3].map((n) => <Skeleton key={n} className="h-16 w-full rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />)}
            </div>
          ) : upcoming.length === 0 ? (
            <div style={{ backgroundColor: "#0d1422", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 14, padding: "36px 24px", textAlign: "center" }}>
              <Calendar style={{ width: 32, height: 32, color: "#374151", margin: "0 auto 12px" }} />
              <p style={{ fontWeight: 600, fontSize: 15, margin: "0 0 6px" }}>No upcoming sessions</p>
              <p style={{ fontSize: 13, color: "#4a5568", margin: "0 0 18px" }}>Share your booking link so clients can schedule.</p>
              {bookingUrl && (
                <button onClick={handleCopyLink} style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`, color: "#fff", fontWeight: 700, fontSize: 13, padding: "10px 20px", border: "none", borderRadius: 9, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, boxShadow: `0 3px 12px rgba(26,171,144,0.3)`, fontFamily: "inherit" }}>
                  <Copy size={14} /> Copy Booking Link
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {upcoming.map((s) => <SessionRow key={s.id} session={s} />)}
            </div>
          )}
        </section>

        {/* Recent sessions */}
        {past.length > 0 && (
          <section>
            <h2 style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", letterSpacing: "0.07em", marginBottom: 14 }}>RECENT SESSIONS</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {past.slice(0, 10).map((s) => <SessionRow key={s.id} session={s} />)}
            </div>
          </section>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
