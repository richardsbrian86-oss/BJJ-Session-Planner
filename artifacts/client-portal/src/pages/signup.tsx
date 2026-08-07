import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useClientAuth } from "@/lib/client-auth";
import { AlertCircle, Loader2, CheckCircle2, Mail } from "lucide-react";

const ACCENT = "#1aab90";
const ACCENT_DARK = "#128a74";

export default function Signup() {
  const [, navigate] = useLocation();
  const { login } = useClientAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError("Passwords don't match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/clients/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Registration failed"); return; }
      login(data.token, data.client);
      setPendingVerification(true);
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    "View all your upcoming and past sessions",
    "Access cancellation links in one place",
    "Track your training history",
  ];

  const inputStyle: React.CSSProperties = {
    width: "100%", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "12px 14px", color: "#eef0f4", fontSize: 15, outline: "none", boxSizing: "border-box",
    fontFamily: "inherit",
  };
  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#8b9ab3", display: "block", marginBottom: 6 };

  if (pendingVerification) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#070b14", padding: "32px 20px", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 9, textDecoration: "none", color: "#eef0f4", marginBottom: 32, justifyContent: "center", width: "100%" }}>
            <svg width="28" height="28" viewBox="0 0 30 30" fill="none">
              <circle cx="15" cy="15" r="14" stroke={ACCENT} strokeWidth="2" />
              <circle cx="15" cy="15" r="6.5" fill={ACCENT} />
            </svg>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>Let's Roll</span>
          </Link>
          <div style={{ backgroundColor: "#0d1422", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "40px 28px", boxShadow: "0 24px 64px rgba(0,0,0,0.4)", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(26,171,144,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <Mail style={{ width: 26, height: 26, color: ACCENT }} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#eef0f4", margin: "0 0 10px", letterSpacing: "-0.02em" }}>Check your email</h1>
            <p style={{ color: "#8b9ab3", fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 }}>
              We sent a verification link to <strong style={{ color: "#eef0f4" }}>{email}</strong>. Click that link to access your booking history.
            </p>
            <p style={{ color: "#4a5568", fontSize: 13, margin: 0 }}>
              You can close this page. The link expires in 24 hours.
            </p>
            <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <button
                onClick={() => navigate("/dashboard")}
                style={{ background: "transparent", border: "none", color: ACCENT, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
              >
                Go to dashboard →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#070b14", padding: "32px 20px", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Logo */}
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 9, textDecoration: "none", color: "#eef0f4", marginBottom: 32, justifyContent: "center", width: "100%" }}>
          <svg width="28" height="28" viewBox="0 0 30 30" fill="none">
            <circle cx="15" cy="15" r="14" stroke={ACCENT} strokeWidth="2" />
            <circle cx="15" cy="15" r="6.5" fill={ACCENT} />
          </svg>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>Let's Roll</span>
        </Link>

        {/* Card */}
        <div style={{ backgroundColor: "#0d1422", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "32px 28px", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#eef0f4", margin: "0 0 4px", letterSpacing: "-0.02em" }}>Create an account</h1>
          <p style={{ color: "#4a5568", fontSize: 14, margin: "0 0 20px" }}>Track your sessions in one place</p>

          {/* Benefits */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
            {benefits.map((b) => (
              <div key={b} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <CheckCircle2 style={{ width: 15, height: 15, color: ACCENT, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "#8b9ab3" }}>{b}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {error && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "12px 14px" }}>
                <AlertCircle style={{ width: 16, height: 16, color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 13, color: "#ef4444" }}>{error}</span>
              </div>
            )}

            <div>
              <label style={labelStyle} htmlFor="name">Full Name</label>
              <input id="name" placeholder="Alex Smith" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle} htmlFor="email">Email</label>
              <input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle} htmlFor="password">Password</label>
              <input id="password" type="password" placeholder="Min. 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle} htmlFor="confirm">Confirm Password</label>
              <input id="confirm" type="password" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" style={inputStyle} />
            </div>

            <button type="submit" disabled={loading} style={{ width: "100%", background: loading ? "rgba(26,171,144,0.5)" : `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`, color: "#fff", fontWeight: 700, fontSize: 15, padding: "14px", border: "none", borderRadius: 11, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : `0 4px 16px rgba(26,171,144,0.35)`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit", marginTop: 4 }}>
              {loading ? <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />Creating account...</> : "Create Account"}
            </button>
          </form>

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center", fontSize: 14, color: "#4a5568" }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: ACCENT, fontWeight: 600, textDecoration: "none" }}>Sign in</Link>
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "#374151", marginTop: 14 }}>
          An account is optional — you can{" "}
          <Link href="/" style={{ color: "#4a5568", textDecoration: "none" }}>book sessions</Link> without one.
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
