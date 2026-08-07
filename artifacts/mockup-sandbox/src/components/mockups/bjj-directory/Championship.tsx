import "./_group.css";

const instructors = [
  { id: 1, name: "Marcus Silva", belt: "Black", specialty: "Guard & Submissions", rating: 5.0, sessions: 248 },
  { id: 2, name: "Jordan Reyes", belt: "Black", specialty: "Takedowns & Wrestling", rating: 4.9, sessions: 163 },
  { id: 3, name: "Casey Park", belt: "Brown", specialty: "Leg Locks & Half Guard", rating: 4.9, sessions: 94 },
];

const BELT_DOT: Record<string, string> = {
  "Black": "#d4d4d8",
  "Brown": "#92400e",
  "Purple": "#6d28d9",
  "Blue": "#1d4ed8",
};

function Stars({ n }: { n: number }) {
  return (
    <span style={{ color: "#d97706", fontSize: 13, letterSpacing: 1 }}>
      {"★".repeat(Math.floor(n))}{n % 1 ? "½" : ""}
    </span>
  );
}

export function Championship() {
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#080808", minHeight: "100vh", color: "#e8e8e6" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid rgba(217,119,6,0.2)", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(90deg, #080808 0%, #0d0a05 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ position: "relative", width: 30, height: 30 }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid #d97706" }}/>
            <div style={{ position: "absolute", inset: 7, borderRadius: "50%", backgroundColor: "#d97706" }}/>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.1 }}>Let's Roll</div>
            <div style={{ fontSize: 10, color: "#78716c", letterSpacing: "0.15em", fontWeight: 600 }}>BJJ SESSION PLANNER</div>
          </div>
        </div>
        <nav style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button style={{ color: "#78716c", fontSize: 14, fontWeight: 500, padding: "7px 14px", background: "none", border: "none", cursor: "pointer" }}>Log In</button>
          <button style={{ backgroundColor: "transparent", color: "#d97706", fontSize: 14, fontWeight: 600, padding: "8px 18px", border: "1px solid rgba(217,119,6,0.5)", cursor: "pointer", borderRadius: 6 }}>Sign Up</button>
        </nav>
      </header>

      {/* Hero */}
      <div style={{ position: "relative", padding: "64px 32px 56px", textAlign: "center", background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(217,119,6,0.08) 0%, transparent 70%)" }}>
        {/* Decorative belt rank dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 32 }}>
          {[["#d4d4d8", "White"], ["#3b82f6", "Blue"], ["#7c3aed", "Purple"], ["#92400e", "Brown"], ["#111", "Black"]].map(([color, name]) => (
            <div key={name} title={name} style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: color, border: name === "Black" ? "1px solid rgba(255,255,255,0.3)" : "none", boxShadow: name === "Black" ? "0 0 8px rgba(255,255,255,0.15)" : "none" }}/>
          ))}
        </div>

        <div style={{ display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: "#d97706", backgroundColor: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.2)", padding: "5px 16px", borderRadius: 100, marginBottom: 24 }}>
          ELITE PRIVATE COACHING
        </div>
        <h1 style={{ fontSize: 56, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: 18, margin: "0 0 18px" }}>
          Train With<br />
          <span style={{ background: "linear-gradient(135deg, #d97706 0%, #fbbf24 50%, #d97706 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Champions
          </span>
        </h1>
        <p style={{ color: "#78716c", fontSize: 17, lineHeight: 1.65, maxWidth: 460, margin: "0 auto 36px" }}>
          Book private sessions with world-class BJJ instructors. Whatever your level, they'll meet you where you are.
        </p>

        {/* Search */}
        <div style={{ position: "relative", maxWidth: 460, margin: "0 auto" }}>
          <svg style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", color: "#57534e" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input placeholder="Search by name or specialty..." style={{ width: "100%", backgroundColor: "#100f0c", border: "1px solid rgba(217,119,6,0.2)", borderRadius: 10, padding: "15px 16px 15px 48px", color: "#e8e8e6", fontSize: 15, outline: "none", boxSizing: "border-box" }}/>
        </div>
      </div>

      {/* Divider with ornament */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "0 32px", margin: "8px 0" }}>
        <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent 0%, rgba(217,119,6,0.2) 100%)" }}/>
        <span style={{ color: "#d97706", fontSize: 16 }}>✦</span>
        <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(217,119,6,0.2) 0%, transparent 100%)" }}/>
      </div>

      {/* Instructors */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 32px 40px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: "#57534e", marginBottom: 20 }}>
          3 INSTRUCTORS AVAILABLE
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {instructors.map((inst, i) => (
            <div key={inst.id} style={{ backgroundColor: "#0d0c0a", border: "1px solid rgba(217,119,6,0.12)", borderRadius: 14, padding: "22px 24px", display: "flex", alignItems: "center", gap: 18, cursor: "pointer", boxShadow: i === 0 ? "0 0 0 1px rgba(217,119,6,0.08), 0 4px 24px rgba(217,119,6,0.04)" : "none" }}>
              {/* Avatar with gold ring for first */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                {i === 0 && <div style={{ position: "absolute", inset: -3, borderRadius: "50%", border: "2px solid rgba(217,119,6,0.5)" }}/>}
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: i === 0 ? "linear-gradient(135deg, #d97706, #92400e)" : "#1c1a16", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: i === 0 ? "#fff" : "#78716c" }}>
                  {inst.name[0]}
                </div>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{inst.name}</span>
                  {i === 0 && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#d97706", backgroundColor: "rgba(217,119,6,0.1)", padding: "2px 8px", borderRadius: 4 }}>FEATURED</span>}
                </div>
                <div style={{ fontSize: 13, color: "#78716c", marginBottom: 6 }}>{inst.specialty}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Stars n={inst.rating} />
                  <span style={{ fontSize: 12, color: "#57534e" }}>{inst.rating} · {inst.sessions} sessions</span>
                </div>
              </div>

              {/* Belt indicator */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: BELT_DOT[inst.belt] ?? "#444", border: inst.belt === "Black" ? "1px solid rgba(255,255,255,0.2)" : "none" }}/>
                <span style={{ fontSize: 10, color: "#57534e", fontWeight: 600, letterSpacing: "0.06em" }}>{inst.belt.toUpperCase()}</span>
              </div>

              {/* CTA */}
              <button style={{ backgroundColor: "#d97706", color: "#0a0a0a", fontWeight: 700, fontSize: 14, padding: "11px 22px", border: "none", cursor: "pointer", borderRadius: 8, whiteSpace: "nowrap", flexShrink: 0 }}>
                Book Session
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
