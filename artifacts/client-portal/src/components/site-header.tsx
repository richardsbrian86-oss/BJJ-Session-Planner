import { Link, useLocation } from "wouter";
import { useClientAuth } from "@/lib/client-auth";
import { useInstructorAuth } from "@/lib/instructor-auth";
import { LogOut, LayoutDashboard, Menu, X, ShieldCheck } from "lucide-react";
import { useState } from "react";

const ACCENT = "#1aab90";
const ACCENT_DARK = "#128a74";

const NO_HEADER_PATHS = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/instructor/login",
  "/instructor/forgot-password",
  "/instructor/reset-password",
  "/instructor/forgot-pin",
  "/instructor/reset-pin",
]);

export function SiteHeader() {
  const { client, isAuthenticated: isClientAuth, logout: clientLogout } = useClientAuth();
  const { instructor, isAuthenticated: isInstructorAuth, logout: instructorLogout } = useInstructorAuth();
  const [location, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  if (NO_HEADER_PATHS.has(location)) return null;

  const handleClientLogout = () => {
    clientLogout();
    navigate("/");
    setMenuOpen(false);
  };

  const handleInstructorLogout = () => {
    instructorLogout();
    navigate("/");
    setMenuOpen(false);
  };

  return (
    <header style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", backgroundColor: "rgba(7,11,20,0.96)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 1024, margin: "0 auto", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>

        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", color: "#eef0f4" }}>
          <svg width="28" height="28" viewBox="0 0 30 30" fill="none">
            <circle cx="15" cy="15" r="14" stroke={ACCENT} strokeWidth="2" />
            <circle cx="15" cy="15" r="6.5" fill={ACCENT} />
          </svg>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>Let's Roll</span>
        </Link>

        {/* Desktop nav */}
        <nav style={{ alignItems: "center", gap: 4 }} className="hidden sm:flex">
          <Link href="/">
            <button style={{ color: "#8b9ab3", fontSize: 14, fontWeight: 500, padding: "6px 13px", background: "none", border: "none", cursor: "pointer", borderRadius: 7 }}>
              Find Instructors
            </button>
          </Link>

          {/* Instructor authenticated */}
          {isInstructorAuth && (
            <>
              <Link href="/instructor/dashboard">
                <button style={{ color: "#8b9ab3", fontSize: 14, fontWeight: 500, padding: "6px 13px", background: "none", border: "none", cursor: "pointer", borderRadius: 7, display: "flex", alignItems: "center", gap: 6 }}>
                  <LayoutDashboard style={{ width: 15, height: 15 }} />
                  Dashboard
                </button>
              </Link>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", backgroundColor: "rgba(26,171,144,0.08)", border: "1px solid rgba(26,171,144,0.18)", borderRadius: 100 }}>
                <ShieldCheck style={{ width: 13, height: 13, color: ACCENT }} />
                <span style={{ color: ACCENT, fontSize: 13, fontWeight: 700 }}>{instructor?.name?.split(" ")[0]}</span>
              </div>
              <button onClick={handleInstructorLogout} style={{ color: "#8b9ab3", fontSize: 14, fontWeight: 500, padding: "6px 13px", background: "none", border: "none", cursor: "pointer", borderRadius: 7, display: "flex", alignItems: "center", gap: 6 }}>
                <LogOut style={{ width: 15, height: 15 }} />
                Sign Out
              </button>
            </>
          )}

          {/* Client authenticated */}
          {isClientAuth && !isInstructorAuth && (
            <>
              <Link href="/dashboard">
                <button style={{ color: "#8b9ab3", fontSize: 14, fontWeight: 500, padding: "6px 13px", background: "none", border: "none", cursor: "pointer", borderRadius: 7, display: "flex", alignItems: "center", gap: 6 }}>
                  <LayoutDashboard style={{ width: 15, height: 15 }} />
                  My Bookings
                </button>
              </Link>
              <span style={{ color: "#4a5568", fontSize: 14, padding: "0 4px" }}>Hi, {client?.name?.split(" ")[0]}</span>
              <button onClick={handleClientLogout} style={{ color: "#8b9ab3", fontSize: 14, fontWeight: 500, padding: "6px 13px", background: "none", border: "none", cursor: "pointer", borderRadius: 7, display: "flex", alignItems: "center", gap: 6 }}>
                <LogOut style={{ width: 15, height: 15 }} />
                Sign Out
              </button>
            </>
          )}

          {/* Not authenticated */}
          {!isClientAuth && !isInstructorAuth && (
            <>
              <Link href="/login">
                <button style={{ color: "#8b9ab3", fontSize: 14, fontWeight: 500, padding: "6px 14px", background: "none", border: "none", cursor: "pointer", borderRadius: 7 }}>
                  Log In
                </button>
              </Link>
              <Link href="/signup">
                <button style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`, color: "#fff", fontSize: 14, fontWeight: 700, padding: "8px 18px", border: "none", borderRadius: 9, cursor: "pointer", boxShadow: `0 3px 12px rgba(26,171,144,0.35)` }}>
                  Sign Up Free
                </button>
              </Link>
              <Link href="/instructor/login">
                <button style={{ color: "#4a5568", fontSize: 13, fontWeight: 500, padding: "6px 12px", background: "none", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", borderRadius: 7 }}>
                  Instructor
                </button>
              </Link>
            </>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ padding: 8, borderRadius: 7, background: "none", border: "none", cursor: "pointer", color: "#8b9ab3" }}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X style={{ width: 20, height: 20 }} /> : <Menu style={{ width: 20, height: 20 }} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden" style={{ borderTop: "1px solid rgba(255,255,255,0.07)", backgroundColor: "#070b14", padding: "12px 16px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
          <Link href="/" onClick={() => setMenuOpen(false)}>
            <button style={{ width: "100%", textAlign: "left", color: "#8b9ab3", fontSize: 15, fontWeight: 500, padding: "10px 12px", background: "none", border: "none", cursor: "pointer", borderRadius: 8 }}>Find Instructors</button>
          </Link>

          {isInstructorAuth && (
            <>
              <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldCheck style={{ width: 14, height: 14, color: ACCENT }} />
                <span style={{ fontSize: 13, color: ACCENT, fontWeight: 700 }}>Signed in as {instructor?.name?.split(" ")[0]}</span>
              </div>
              <Link href="/instructor/dashboard" onClick={() => setMenuOpen(false)}>
                <button style={{ width: "100%", textAlign: "left", color: "#8b9ab3", fontSize: 15, fontWeight: 500, padding: "10px 12px", background: "none", border: "none", cursor: "pointer", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <LayoutDashboard style={{ width: 15, height: 15 }} />Dashboard
                </button>
              </Link>
              <button onClick={handleInstructorLogout} style={{ width: "100%", textAlign: "left", color: "#8b9ab3", fontSize: 15, fontWeight: 500, padding: "10px 12px", background: "none", border: "none", cursor: "pointer", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <LogOut style={{ width: 15, height: 15 }} />Sign Out
              </button>
            </>
          )}

          {isClientAuth && !isInstructorAuth && (
            <>
              <Link href="/dashboard" onClick={() => setMenuOpen(false)}>
                <button style={{ width: "100%", textAlign: "left", color: "#8b9ab3", fontSize: 15, fontWeight: 500, padding: "10px 12px", background: "none", border: "none", cursor: "pointer", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <LayoutDashboard style={{ width: 15, height: 15 }} />My Bookings
                </button>
              </Link>
              <button onClick={handleClientLogout} style={{ width: "100%", textAlign: "left", color: "#8b9ab3", fontSize: 15, fontWeight: 500, padding: "10px 12px", background: "none", border: "none", cursor: "pointer", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <LogOut style={{ width: 15, height: 15 }} />Sign Out
              </button>
            </>
          )}

          {!isClientAuth && !isInstructorAuth && (
            <>
              <Link href="/login" onClick={() => setMenuOpen(false)}>
                <button style={{ width: "100%", textAlign: "left", color: "#8b9ab3", fontSize: 15, fontWeight: 500, padding: "10px 12px", background: "none", border: "none", cursor: "pointer", borderRadius: 8 }}>Log In (Client)</button>
              </Link>
              <Link href="/instructor/login" onClick={() => setMenuOpen(false)}>
                <button style={{ width: "100%", textAlign: "left", color: "#8b9ab3", fontSize: 15, fontWeight: 500, padding: "10px 12px", background: "none", border: "none", cursor: "pointer", borderRadius: 8 }}>Instructor Sign In</button>
              </Link>
              <Link href="/signup" onClick={() => setMenuOpen(false)}>
                <button style={{ width: "100%", background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`, color: "#fff", fontSize: 15, fontWeight: 700, padding: "12px", border: "none", borderRadius: 10, cursor: "pointer", marginTop: 4, boxShadow: `0 3px 12px rgba(26,171,144,0.3)` }}>
                  Sign Up Free
                </button>
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
