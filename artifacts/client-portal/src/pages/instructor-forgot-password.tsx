import { useState } from "react";
import { Link } from "wouter";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";

const ACCENT = "#1aab90";
const ACCENT_DARK = "#128a74";

export default function InstructorForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputStyle: React.CSSProperties = {
    width: "100%", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "12px 14px", color: "#eef0f4", fontSize: 15, outline: "none",
    boxSizing: "border-box", fontFamily: "inherit",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/instructors/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong"); return; }
      setSent(true);
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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

        <div style={{ backgroundColor: "#0d1422", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "32px 28px", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
          {sent ? (
            <div style={{ textAlign: "center" }}>
              <CheckCircle style={{ width: 48, height: 48, color: "#22c55e", margin: "0 auto 16px", display: "block" }} />
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#eef0f4", margin: "0 0 8px", letterSpacing: "-0.02em" }}>Check your email</h1>
              <p style={{ color: "#8b9ab3", fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 }}>
                If an instructor account exists for <strong style={{ color: "#eef0f4" }}>{email}</strong>, we've sent a password reset link. It expires in 1 hour.
              </p>
              <Link href="/instructor/login" style={{ color: ACCENT, fontWeight: 600, textDecoration: "none", fontSize: 14 }}>Back to sign in</Link>
            </div>
          ) : (
            <>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: "#eef0f4", margin: "0 0 4px", letterSpacing: "-0.02em" }}>Reset your password</h1>
              <p style={{ color: "#4a5568", fontSize: 14, margin: "0 0 24px" }}>Enter your instructor email and we'll send a reset link</p>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {error && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "12px 14px" }}>
                    <AlertCircle style={{ width: 16, height: 16, color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 13, color: "#ef4444" }}>{error}</span>
                  </div>
                )}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#8b9ab3", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 }} htmlFor="email">
                    Email address
                  </label>
                  <input id="email" type="email" placeholder="coach@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" style={inputStyle} />
                </div>
                <button type="submit" disabled={loading} style={{ width: "100%", background: loading ? "rgba(26,171,144,0.5)" : `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`, color: "#fff", fontWeight: 700, fontSize: 15, padding: "14px", border: "none", borderRadius: 11, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : `0 4px 16px rgba(26,171,144,0.35)`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit", marginTop: 4 }}>
                  {loading ? <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />Sending...</> : "Send Reset Link"}
                </button>
              </form>

              <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center", fontSize: 14, color: "#4a5568" }}>
                <Link href="/instructor/login" style={{ color: ACCENT, fontWeight: 600, textDecoration: "none" }}>Back to sign in</Link>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
