import "./_group.css";

const instructors = [
  { id: 1, name: "Marcus Silva", belt: "Black Belt", stripe: 4, specialty: "Guard Passing", wins: 47 },
  { id: 2, name: "Jordan Reyes", belt: "Black Belt", stripe: 2, specialty: "Leg Locks", wins: 31 },
  { id: 3, name: "Casey Park", belt: "Brown Belt", stripe: 3, specialty: "Half Guard", wins: 22 },
];

const BELT_BAR: Record<string, string> = {
  "Black Belt": "#ffffff",
  "Brown Belt": "#9a4a2e",
  "Purple Belt": "#7c3aed",
  "Blue Belt": "#2563eb",
  "White Belt": "#d1d5db",
};

export function Combat() {
  return (
    <div style={{ fontFamily: "'Bebas Neue', 'Inter', sans-serif", backgroundColor: "#060608", minHeight: "100vh", color: "#f5f5f5" }}>
      {/* Header */}
      <header style={{ borderBottom: "2px solid #dc2626", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#060608" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, backgroundColor: "#dc2626", clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: 12, color: "#fff" }}>◉</span>
          </div>
          <span style={{ fontSize: 26, letterSpacing: "0.12em", color: "#f5f5f5" }}>LET'S ROLL</span>
        </div>
        <nav style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button style={{ fontFamily: "'Inter', sans-serif", color: "#9ca3af", fontSize: 13, fontWeight: 600, padding: "6px 14px", background: "none", border: "none", cursor: "pointer", letterSpacing: "0.05em" }}>LOG IN</button>
          <button style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 700, padding: "8px 18px", border: "none", cursor: "pointer", letterSpacing: "0.08em", clipPath: "polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)" }}>
            SIGN UP
          </button>
        </nav>
      </header>

      {/* Hero — split layout */}
      <div style={{ position: "relative", overflow: "hidden", padding: "60px 24px 52px", background: "linear-gradient(135deg, #0d0000 0%, #060608 60%)" }}>
        {/* Diagonal accent bars */}
        <div style={{ position: "absolute", top: 0, right: 0, width: 400, height: "100%", opacity: 0.07, background: "repeating-linear-gradient(-45deg, #dc2626 0, #dc2626 2px, transparent 0, transparent 20px)" }}/>
        <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 2, backgroundColor: "rgba(220,38,38,0.3)" }}/>

        <div style={{ maxWidth: 720, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <div style={{ height: 2, width: 32, backgroundColor: "#dc2626" }}/>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 700, color: "#dc2626", letterSpacing: "0.15em" }}>PRIVATE TRAINING</span>
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 80, lineHeight: 0.95, letterSpacing: "0.04em", marginBottom: 20, margin: "0 0 20px" }}>
            TRAIN WITH<br/>
            <span style={{ color: "#dc2626", WebkitTextStroke: "2px #dc2626" }}>THE BEST</span>
          </h1>
          <p style={{ fontFamily: "'Inter', sans-serif", color: "#71717a", fontSize: 15, lineHeight: 1.7, marginBottom: 28, maxWidth: 440, margin: "0 0 28px" }}>
            Elite BJJ instructors. Private sessions. Book today and start your journey.
          </p>

          {/* Search */}
          <div style={{ display: "flex", gap: 8, maxWidth: 520 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <svg style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#4b4b4b" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input placeholder="Search instructors..." style={{ fontFamily: "'Inter', sans-serif", width: "100%", backgroundColor: "#0f0f14", border: "1px solid #27272a", borderRadius: 4, padding: "14px 14px 14px 42px", color: "#f5f5f5", fontSize: 14, outline: "none", boxSizing: "border-box" }}/>
            </div>
            <button style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#dc2626", color: "#fff", fontWeight: 700, fontSize: 14, padding: "14px 24px", border: "none", cursor: "pointer", letterSpacing: "0.05em", borderRadius: 4, whiteSpace: "nowrap" }}>SEARCH</button>
          </div>
        </div>
      </div>

      {/* Instructor cards */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ height: 2, width: 24, backgroundColor: "#dc2626" }}/>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 700, color: "#52525b", letterSpacing: "0.15em" }}>3 FIGHTERS AVAILABLE</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {instructors.map((inst, i) => (
            <div key={inst.id} style={{
              backgroundColor: "#0c0c10",
              border: "1px solid #18181b",
              borderLeft: `3px solid ${BELT_BAR[inst.belt]}`,
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              gap: 20,
              cursor: "pointer",
              marginBottom: i < instructors.length - 1 ? 2 : 0,
            }}>
              {/* Number */}
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: "rgba(220,38,38,0.25)", width: 32, flexShrink: 0, lineHeight: 1 }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              {/* Belt stripe */}
              <div style={{ width: 4, height: 52, borderRadius: 2, backgroundColor: BELT_BAR[inst.belt], flexShrink: 0 }}/>
              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: "0.06em", lineHeight: 1, marginBottom: 4 }}>{inst.name.toUpperCase()}</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#52525b", letterSpacing: "0.08em", fontWeight: 600 }}>
                  {inst.belt.toUpperCase()} · {inst.specialty.toUpperCase()}
                </div>
              </div>
              {/* Stats */}
              <div style={{ fontFamily: "'Inter', sans-serif", display: "flex", gap: 20, flexShrink: 0 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#f5f5f5" }}>{inst.wins}</div>
                  <div style={{ fontSize: 11, color: "#52525b", fontWeight: 600, letterSpacing: "0.05em" }}>COMP WINS</div>
                </div>
              </div>
              <button style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "transparent", color: "#dc2626", fontWeight: 700, fontSize: 13, padding: "10px 20px", border: "1px solid #dc2626", cursor: "pointer", letterSpacing: "0.08em", borderRadius: 4, whiteSpace: "nowrap", flexShrink: 0 }}>
                BOOK SESSION →
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
