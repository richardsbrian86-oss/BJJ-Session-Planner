import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useInstructorAuth } from "@/lib/instructor-auth";
import { Eye, EyeOff, Loader2, FlaskConical } from "lucide-react";

const ACCENT = "#1aab90";
const ACCENT_DARK = "#128a74";

type LoginMethod = "email" | "pin";

function DemoLoginButton({ onLogin }: { onLogin: (token: string, instructor: { id: number; name: string; slug: string; email?: string }) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDemo() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/instructors/demo-login", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Demo login unavailable");
        return;
      }
      onLogin(data.token, { id: data.id, name: data.name, slug: data.slug, email: data.email });
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <p style={{ textAlign: "center", fontSize: 12, color: "#4a5568", margin: "0 0 12px", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}>or</p>
      {error && (
        <p style={{ textAlign: "center", fontSize: 12, color: "#ef4444", margin: "0 0 10px" }}>{error}</p>
      )}
      <button
        type="button"
        onClick={handleDemo}
        disabled={loading}
        style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#8b9ab3", fontWeight: 600, fontSize: 14, padding: "11px", borderRadius: 10, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit", transition: "all 0.15s" }}
      >
        {loading ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <FlaskConical size={15} />}
        {loading ? "Loading demo…" : "Try Demo"}
      </button>
    </div>
  );
}

export default function InstructorLogin() {
  const { login } = useInstructorAuth();
  const [, navigate] = useLocation();

  const [method, setMethod] = useState<LoginMethod>("email");

  // Email+password fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Name+PIN fields
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (method === "email") {
      if (!email.trim() || !password) { setError("Email and password are required."); return; }
    } else {
      if (!name.trim() || !pin) { setError("Name and PIN are required."); return; }
      if (pin.length < 6) { setError("PIN must be at least 6 digits."); return; }
    }

    setLoading(true);
    try {
      let res: Response;
      if (method === "email") {
        res = await fetch("/api/instructors/login-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        });
      } else {
        res = await fetch("/api/instructors/login-name", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), pin }),
        });
      }

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setError(data.error ?? "Too many failed attempts. Please wait a few minutes and try again.");
        } else if (res.status === 428) {
          setError("Your PIN needs to be upgraded to 6 digits. Open the Let's Roll mobile app and follow the security upgrade prompt, then try again.");
        } else if (res.status === 409) {
          setError(data.error ?? "Multiple accounts found. Please use Email & Password login instead.");
        } else if (method === "email") {
          setError("Invalid email or password. If you registered with a PIN on the mobile app, use the \"Name & PIN\" tab instead.");
        } else {
          setError("Name or PIN not recognised. Enter your name exactly as it appears in the mobile app.");
        }
        return;
      }

      login(data.token, { id: data.id, name: data.name, slug: data.slug, email: data.email });
      navigate("/instructor/dashboard");
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: "13px 16px",
    color: "#eef0f4",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#070b14", padding: "32px 20px", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 9, textDecoration: "none", color: "#eef0f4", marginBottom: 24 }}>
            <svg width="28" height="28" viewBox="0 0 30 30" fill="none">
              <circle cx="15" cy="15" r="14" stroke={ACCENT} strokeWidth="2" />
              <circle cx="15" cy="15" r="6.5" fill={ACCENT} />
            </svg>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>Let's Roll</span>
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#eef0f4", margin: "0 0 6px", letterSpacing: "-0.02em" }}>Instructor Sign In</h1>
          <p style={{ color: "#8b9ab3", fontSize: 14, margin: 0 }}>Access your dashboard and manage bookings</p>
        </div>

        <div style={{ backgroundColor: "#0d1422", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "28px", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>

          {/* Method tabs */}
          <div style={{ display: "flex", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 4, marginBottom: 24 }}>
            {(["email", "pin"] as LoginMethod[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMethod(m); setError(null); }}
                style={{ flex: 1, padding: "9px 12px", borderRadius: 7, border: "none", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.15s", background: method === m ? "#fff" : "transparent", color: method === m ? "#070b14" : "#4a5568", boxShadow: method === m ? "0 1px 4px rgba(0,0,0,0.25)" : "none" }}
              >
                {m === "email" ? "✉️  Email & Password" : "🔢  Name & PIN"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {method === "email" ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#8b9ab3", letterSpacing: "0.06em", textTransform: "uppercase" }}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="coach@example.com"
                    autoComplete="email"
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#8b9ab3", letterSpacing: "0.06em", textTransform: "uppercase" }}>Password</label>
                    <Link href="/instructor/forgot-password" style={{ fontSize: 11, color: ACCENT, fontWeight: 600, textDecoration: "none" }}>Forgot password?</Link>
                  </div>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      style={{ ...inputStyle, paddingRight: 44 }}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#4a5568", padding: 0, display: "flex" }}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#8b9ab3", letterSpacing: "0.06em", textTransform: "uppercase" }}>Your name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Coach Alex"
                    autoComplete="name"
                    style={inputStyle}
                  />
                  <p style={{ fontSize: 12, color: "#4a5568", margin: 0 }}>
                    Enter your name exactly as shown in the mobile app.
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#8b9ab3", letterSpacing: "0.06em", textTransform: "uppercase" }}>PIN</label>
                    <Link href="/instructor/forgot-pin" style={{ fontSize: 11, color: ACCENT, fontWeight: 600, textDecoration: "none" }}>Forgot PIN?</Link>
                  </div>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPin ? "text" : "password"}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="6-digit PIN"
                      inputMode="numeric"
                      maxLength={12}
                      autoComplete="current-password"
                      style={{ ...inputStyle, paddingRight: 44, letterSpacing: "0.2em" }}
                    />
                    <button type="button" onClick={() => setShowPin(!showPin)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#4a5568", padding: 0, display: "flex" }}>
                      {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {error && (
              <div style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#f87171", lineHeight: 1.5 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`, color: "#fff", fontWeight: 700, fontSize: 15, padding: "13px", border: "none", borderRadius: 10, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: `0 4px 16px rgba(26,171,144,0.35)`, fontFamily: "inherit", opacity: loading ? 0.75 : 1, marginTop: 4 }}
            >
              {loading ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Signing in…</> : "Sign In to Dashboard"}
            </button>
          </form>

          <DemoLoginButton onLogin={(token, instructor) => { login(token, instructor); navigate("/instructor/dashboard"); }} />
        </div>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <p style={{ fontSize: 13, color: "#4a5568", margin: "0 0 6px" }}>
            Don't have an account? Open the Let's Roll mobile app and choose <strong style={{ color: "#8b9ab3" }}>Instructor</strong> to get started.
          </p>
          <p style={{ margin: 0 }}>
            <Link href="/" style={{ color: ACCENT, textDecoration: "none", fontWeight: 600, fontSize: 13 }}>← Back to directory</Link>
          </p>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
