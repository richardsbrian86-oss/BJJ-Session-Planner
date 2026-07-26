import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

const ACCENT = "#1aab90";

export default function VerifyEmail() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setMessage("No verification token found. Please check your email link.");
      return;
    }

    fetch("/api/clients/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setStatus("error");
          setMessage(data.error);
        } else {
          setStatus("success");
          setMessage(data.message || "Email verified successfully.");
          queryClient.invalidateQueries({ queryKey: ["client-bookings"] });
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Unable to connect. Please try again.");
      });
  }, [queryClient]);

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
          {status === "loading" && (
            <>
              <Loader2 style={{ width: 40, height: 40, color: ACCENT, margin: "0 auto 20px", animation: "spin 1s linear infinite" }} />
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#eef0f4", margin: "0 0 10px" }}>Verifying your email…</h1>
              <p style={{ color: "#8b9ab3", fontSize: 14, margin: 0 }}>This will just take a moment.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                <CheckCircle2 style={{ width: 28, height: 28, color: "#22c55e" }} />
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#eef0f4", margin: "0 0 10px" }}>Email verified!</h1>
              <p style={{ color: "#8b9ab3", fontSize: 14, margin: "0 0 28px", lineHeight: 1.6 }}>
                Your email address has been confirmed. You can now view your full booking history.
              </p>
              <button
                onClick={() => navigate("/dashboard")}
                style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, #128a74 100%)`, color: "#fff", fontWeight: 700, fontSize: 15, padding: "13px 28px", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 16px rgba(26,171,144,0.35)" }}
              >
                Go to dashboard
              </button>
            </>
          )}

          {status === "error" && (
            <>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                <XCircle style={{ width: 28, height: 28, color: "#ef4444" }} />
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#eef0f4", margin: "0 0 10px" }}>Verification failed</h1>
              <p style={{ color: "#8b9ab3", fontSize: 14, margin: "0 0 28px", lineHeight: 1.6 }}>{message}</p>
              <Link
                href="/login"
                style={{ display: "inline-block", background: `linear-gradient(135deg, ${ACCENT} 0%, #128a74 100%)`, color: "#fff", fontWeight: 700, fontSize: 15, padding: "13px 28px", borderRadius: 10, textDecoration: "none", boxShadow: "0 4px 16px rgba(26,171,144,0.35)" }}
              >
                Back to login
              </Link>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
