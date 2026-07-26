import { useState } from "react";
import { Link, useSearch } from "wouter";
import { AlertCircle, CheckCircle, Eye, EyeOff, Loader2 } from "lucide-react";

const ACCENT = "#1aab90";
const ACCENT_DARK = "#128a74";

export default function InstructorResetPin() {
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") ?? "";

  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseInput: React.CSSProperties = { backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 14px", color: "#eef0f4", fontSize: 15, outline: "none", fontFamily: "inherit", letterSpacing: "0.2em" };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#8b9ab3", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{6,}$/.test(newPin)) { setError("PIN must be at least 6 digits"); return; }
    if (newPin !== confirmPin) { setError("PINs do not match"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/instructors/reset-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPin }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Reset failed"); return; }
      setDone(true);
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const card: React.CSSProperties = { backgroundColor: "#0d1422", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "32px 28px", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#070b14", padding: "32px 20px", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 9, textDecoration: "none", color: "#eef0f4", marginBottom: 32, justifyContent: "center", width: "100%" }}>
          <svg width="28" height="28" viewBox="0 0 30 30" fill="none">
            <circle cx="15" cy="15" r="14" stroke={ACCENT} strokeWidth="2" />
            <circle cx="15" cy="15" r="6.5" fill={ACCENT} />
          </svg>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>Let's Roll</span>
        </Link>

        <div style={card}>
          {!token ? (
            <div style={{ textAlign: "center" }}>
              <AlertCircle style={{ width: 40, height: 40, color: "#ef4444", margin: "0 auto 16px", display: "block" }} />
              <h1 style={{ fontSize: 20, fontWeight: 800, color: "#eef0f4", margin: "0 0 8px" }}>Invalid reset link</h1>
              <p style={{ color: "#8b9ab3", fontSize: 14, margin: "0 0 20px" }}>This link is missing a token. Request a new one.</p>
              <Link href="/instructor/forgot-pin" style={{ color: ACCENT, fontWeight: 600, textDecoration: "none" }}>Request new link</Link>
            </div>
          ) : done ? (
            <div style={{ textAlign: "center" }}>
              <CheckCircle style={{ width: 48, height: 48, color: "#22c55e", margin: "0 auto 16px", display: "block" }} />
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#eef0f4", margin: "0 0 8px", letterSpacing: "-0.02em" }}>PIN updated</h1>
              <p style={{ color: "#8b9ab3", fontSize: 14, margin: "0 0 24px" }}>You can now sign in with your new PIN.</p>
              <Link href="/instructor/login" style={{ display: "inline-block", background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`, color: "#fff", fontWeight: 700, fontSize: 14, padding: "12px 28px", borderRadius: 10, textDecoration: "none" }}>Sign In</Link>
            </div>
          ) : (
            <>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: "#eef0f4", margin: "0 0 4px", letterSpacing: "-0.02em" }}>Set new PIN</h1>
              <p style={{ color: "#4a5568", fontSize: 14, margin: "0 0 24px" }}>Choose a new 6-digit PIN for your instructor account</p>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {error && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "12px 14px" }}>
                    <AlertCircle style={{ width: 16, height: 16, color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 13, color: "#ef4444" }}>{error}</span>
                  </div>
                )}
                <div>
                  <label style={labelStyle} htmlFor="newPin">New PIN</label>
                  <div style={{ display: "flex", alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, overflow: "hidden" }}>
                    <input
                      id="newPin"
                      type={showPin ? "text" : "password"}
                      inputMode="numeric"
                      placeholder="6 digits minimum"
                      value={newPin}
                      onChange={e => setNewPin(e.target.value.replace(/\D/g, ""))}
                      required
                      maxLength={12}
                      autoComplete="new-password"
                      style={{ ...baseInput, flex: 1, border: "none", borderRadius: 0, width: "100%" }}
                    />
                    <button type="button" onClick={() => setShowPin(p => !p)} style={{ background: "none", border: "none", padding: "0 12px", cursor: "pointer", color: "#8b9ab3", display: "flex", alignItems: "center", flexShrink: 0 }}>
                      {showPin ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label style={labelStyle} htmlFor="confirmPin">Confirm PIN</label>
                  <input
                    id="confirmPin"
                    type="password"
                    inputMode="numeric"
                    placeholder="Repeat your new PIN"
                    value={confirmPin}
                    onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                    required
                    maxLength={12}
                    autoComplete="new-password"
                    style={{ ...baseInput, width: "100%", boxSizing: "border-box" }}
                  />
                </div>
                <button type="submit" disabled={loading} style={{ width: "100%", background: loading ? "rgba(26,171,144,0.5)" : `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`, color: "#fff", fontWeight: 700, fontSize: 15, padding: "14px", border: "none", borderRadius: 11, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : `0 4px 16px rgba(26,171,144,0.35)`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit", marginTop: 4 }}>
                  {loading ? <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />Updating...</> : "Update PIN"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
