import "./_group.css";

const instructors = [
  { id: 1, name: "Marcus Silva", belt: "Black Belt", stripe: 4, services: 3, years: 15 },
  { id: 2, name: "Jordan Reyes", belt: "Black Belt", stripe: 2, services: 2, years: 8 },
  { id: 3, name: "Casey Park", belt: "Brown Belt", stripe: 3, services: 4, years: 6 },
];

const BELT_COLORS: Record<string, { bg: string; text: string }> = {
  "Black Belt": { bg: "#1e2025", text: "#d4d4d8" },
  "Brown Belt": { bg: "#2d1a10", text: "#d97706" },
  "Purple Belt": { bg: "#1e1030", text: "#a78bfa" },
  "Blue Belt":   { bg: "#0d1e3a", text: "#60a5fa" },
  "White Belt":  { bg: "#1e2025", text: "#f4f4f5" },
};

function BeltBadge({ belt }: { belt: string }) {
  const style = BELT_COLORS[belt] ?? { bg: "#1e2025", text: "#d4d4d8" };
  return (
    <span style={{ backgroundColor: style.bg, color: style.text, display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em" }}>
      {belt}
    </span>
  );
}

export function Academy() {
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#070b14", minHeight: "100vh", color: "#eef0f4" }}>

      {/* Header */}
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", backgroundColor: "rgba(7,11,20,0.96)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50, padding: "0 28px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
            <circle cx="15" cy="15" r="14" stroke="#f97316" strokeWidth="2"/>
            <circle cx="15" cy="15" r="6.5" fill="#f97316"/>
          </svg>
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.02em" }}>Let's Roll</span>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button style={{ color: "#8b9ab3", fontSize: 14, fontWeight: 500, padding: "6px 14px", background: "none", border: "none", cursor: "pointer" }}>Log In</button>
          <button style={{ background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)", color: "#fff", fontSize: 14, fontWeight: 700, padding: "8px 20px", border: "none", borderRadius: 9, cursor: "pointer", boxShadow: "0 4px 14px rgba(249,115,22,0.35)" }}>
            Sign Up Free
          </button>
        </nav>
      </header>

      {/* Hero */}
      <div style={{ position: "relative", overflow: "hidden", padding: "60px 28px 52px", background: "linear-gradient(180deg, #0b1428 0%, #070b14 100%)" }}>
        {/* Soft radial glow */}
        <div style={{ position: "absolute", top: -120, left: "50%", transform: "translateX(-50%)", width: 600, height: 400, background: "radial-gradient(ellipse, rgba(249,115,22,0.12) 0%, transparent 70%)", pointerEvents: "none" }}/>

        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>

          {/* Pill badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, backgroundColor: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.28)", borderRadius: 100, padding: "5px 16px", marginBottom: 28 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#f97316", display: "inline-block", boxShadow: "0 0 6px #f97316" }}/>
            <span style={{ color: "#fb923c", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em" }}>BOOK A PRIVATE SESSION TODAY</span>
          </div>

          <h1 style={{ fontSize: 54, fontWeight: 900, lineHeight: 1.06, letterSpacing: "-0.03em", margin: "0 0 18px" }}>
            Find Your Perfect<br />
            <span style={{ background: "linear-gradient(100deg, #f97316 30%, #fbbf24 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              BJJ Coach
            </span>
          </h1>

          <p style={{ color: "#8b9ab3", fontSize: 18, lineHeight: 1.65, margin: "0 auto 36px", maxWidth: 480 }}>
            Connect with certified instructors, pick a time that works for you, and start rolling.
          </p>

          {/* Search bar */}
          <div style={{ position: "relative", maxWidth: 500, margin: "0 auto" }}>
            <svg style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", color: "#4a5568" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              placeholder="Search by name or specialty..."
              style={{ width: "100%", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "15px 18px 15px 50px", color: "#eef0f4", fontSize: 15, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {/* Trust signals */}
          <div style={{ display: "flex", justifyContent: "center", gap: 28, marginTop: 32 }}>
            {[["✓  No account needed to book", "#6b7a94"], ["✓  Free cancellation", "#6b7a94"], ["✓  Instant confirmation", "#6b7a94"]].map(([text, color]) => (
              <span key={text as string} style={{ fontSize: 13, color: color as string, fontWeight: 500 }}>{text}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Stats ribbon */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", backgroundColor: "#0b101d", padding: "16px 28px", display: "flex", justifyContent: "center", gap: 52 }}>
        {[["200+", "Sessions booked"], ["4.9 ★", "Average rating"], ["< 2hrs", "Response time"]].map(([val, label]) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#eef0f4", letterSpacing: "-0.02em" }}>{val}</div>
            <div style={{ fontSize: 12, color: "#4a5568", marginTop: 2, fontWeight: 500 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Instructor list */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 28px 48px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontSize: 13, color: "#4a5568", fontWeight: 600, letterSpacing: "0.06em" }}>3 INSTRUCTORS AVAILABLE</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 100, backgroundColor: "rgba(249,115,22,0.12)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.2)", cursor: "pointer" }}>All Belts</button>
            <button style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 100, backgroundColor: "transparent", color: "#4a5568", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer" }}>Black Belt</button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {instructors.map((inst) => (
            <div
              key={inst.id}
              style={{ backgroundColor: "#0d1422", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "20px 24px", display: "flex", alignItems: "center", gap: 20, cursor: "pointer" }}
            >
              {/* Avatar */}
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg, #f97316, #ea580c)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 20, fontWeight: 800, color: "#fff", boxShadow: "0 4px 16px rgba(249,115,22,0.25)" }}>
                {inst.name[0]}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
                  <span style={{ fontWeight: 700, fontSize: 16, color: "#eef0f4" }}>{inst.name}</span>
                  <BeltBadge belt={inst.belt} />
                </div>
                <div style={{ fontSize: 13, color: "#4a5568", fontWeight: 500 }}>
                  {inst.years} years experience · {inst.services} services available
                </div>
              </div>

              {/* Price + CTA */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "#4a5568", fontWeight: 600 }}>FROM</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#f97316", letterSpacing: "-0.02em" }}>$65</div>
                </div>
                <button style={{ background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)", color: "#fff", fontWeight: 700, fontSize: 14, padding: "11px 22px", border: "none", borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(249,115,22,0.3)" }}>
                  Book Now
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div style={{ marginTop: 28, padding: "24px", backgroundColor: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)", borderRadius: 14, textAlign: "center" }}>
          <p style={{ color: "#8b9ab3", fontSize: 14, margin: "0 0 12px" }}>
            Are you a BJJ instructor? <strong style={{ color: "#eef0f4" }}>Get your own booking page in minutes.</strong>
          </p>
          <button style={{ backgroundColor: "transparent", color: "#f97316", fontWeight: 700, fontSize: 14, padding: "9px 22px", border: "1px solid rgba(249,115,22,0.4)", borderRadius: 9, cursor: "pointer" }}>
            Create Your Profile →
          </button>
        </div>
      </div>
    </div>
  );
}
