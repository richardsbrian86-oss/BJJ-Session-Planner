import "./_group.css";

const instructors = [
  { id: 1, name: "Marcus Silva", belt: "Black Belt", services: 3, years: 15 },
  { id: 2, name: "Jordan Reyes", belt: "Black Belt", services: 2, years: 8 },
  { id: 3, name: "Casey Park",   belt: "Brown Belt", services: 4, years: 6 },
];

const P = "#3b82f6";
const PD = "#2563eb";
const PG = `linear-gradient(135deg, ${P} 0%, ${PD} 100%)`;

const BELT: Record<string, { bg: string; text: string }> = {
  "Black Belt": { bg: "#0f1825", text: "#93c5fd" },
  "Brown Belt": { bg: "#1a1208", text: "#fcd34d" },
  "Purple Belt":{ bg: "#1e1030", text: "#c4b5fd" },
};

export function Blue() {
  return (
    <div style={{ fontFamily:"'Inter',sans-serif", backgroundColor:"#04080f", minHeight:"100vh", color:"#eef0f4" }}>
      {/* Header */}
      <header style={{ borderBottom:"1px solid rgba(255,255,255,0.07)", backgroundColor:"rgba(4,8,15,0.96)", backdropFilter:"blur(12px)", position:"sticky", top:0, zIndex:50, padding:"0 28px", height:58, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
            <circle cx="15" cy="15" r="14" stroke={P} strokeWidth="2"/>
            <circle cx="15" cy="15" r="6.5" fill={P}/>
          </svg>
          <span style={{ fontWeight:800, fontSize:17, letterSpacing:"-0.02em" }}>Let's Roll</span>
        </div>
        <nav style={{ display:"flex", alignItems:"center", gap:4 }}>
          <button style={{ color:"#8b9ab3", fontSize:14, fontWeight:500, padding:"6px 14px", background:"none", border:"none", cursor:"pointer" }}>Log In</button>
          <button style={{ background:PG, color:"#fff", fontSize:14, fontWeight:700, padding:"8px 20px", border:"none", borderRadius:9, cursor:"pointer", boxShadow:`0 4px 14px rgba(59,130,246,0.4)` }}>
            Sign Up Free
          </button>
        </nav>
      </header>

      {/* Hero */}
      <div style={{ position:"relative", overflow:"hidden", padding:"60px 28px 52px", background:"linear-gradient(180deg,#060e24 0%,#04080f 100%)" }}>
        <div style={{ position:"absolute", top:-120, left:"50%", transform:"translateX(-50%)", width:600, height:400, background:`radial-gradient(ellipse, rgba(59,130,246,0.12) 0%, transparent 70%)`, pointerEvents:"none" }}/>
        <div style={{ maxWidth:720, margin:"0 auto", textAlign:"center", position:"relative", zIndex:1 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, backgroundColor:"rgba(59,130,246,0.1)", border:"1px solid rgba(59,130,246,0.28)", borderRadius:100, padding:"5px 16px", marginBottom:28 }}>
            <span style={{ width:7, height:7, borderRadius:"50%", backgroundColor:P, display:"inline-block", boxShadow:`0 0 6px ${P}` }}/>
            <span style={{ color:"#93c5fd", fontSize:12, fontWeight:700, letterSpacing:"0.08em" }}>BOOK A PRIVATE SESSION TODAY</span>
          </div>
          <h1 style={{ fontSize:54, fontWeight:900, lineHeight:1.06, letterSpacing:"-0.03em", margin:"0 0 18px" }}>
            Find Your Perfect<br/>
            <span style={{ background:`linear-gradient(100deg, ${P} 30%, #93c5fd 100%)`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>BJJ Coach</span>
          </h1>
          <p style={{ color:"#8b9ab3", fontSize:18, lineHeight:1.65, margin:"0 auto 36px", maxWidth:480 }}>
            Connect with certified instructors, pick a time that works for you, and start rolling.
          </p>
          <div style={{ position:"relative", maxWidth:500, margin:"0 auto" }}>
            <svg style={{ position:"absolute", left:18, top:"50%", transform:"translateY(-50%)", color:"#4a5568" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input placeholder="Search by name or specialty..." style={{ width:"100%", backgroundColor:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, padding:"15px 18px 15px 50px", color:"#eef0f4", fontSize:15, outline:"none", boxSizing:"border-box" }}/>
          </div>
          <div style={{ display:"flex", justifyContent:"center", gap:28, marginTop:28 }}>
            {["✓  No account needed to book","✓  Free cancellation","✓  Instant confirmation"].map(t=>(
              <span key={t} style={{ fontSize:13, color:"#6b7a94", fontWeight:500 }}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ borderTop:"1px solid rgba(255,255,255,0.05)", borderBottom:"1px solid rgba(255,255,255,0.05)", backgroundColor:"#070d1c", padding:"16px 28px", display:"flex", justifyContent:"center", gap:52 }}>
        {[["200+","Sessions booked"],["4.9 ★","Average rating"],["< 2hrs","Response time"]].map(([v,l])=>(
          <div key={l} style={{ textAlign:"center" }}>
            <div style={{ fontSize:20, fontWeight:800, color:"#eef0f4", letterSpacing:"-0.02em" }}>{v}</div>
            <div style={{ fontSize:12, color:"#4a5568", marginTop:2, fontWeight:500 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* List */}
      <div style={{ maxWidth:720, margin:"0 auto", padding:"32px 28px 48px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <span style={{ fontSize:13, color:"#4a5568", fontWeight:600, letterSpacing:"0.06em" }}>3 INSTRUCTORS AVAILABLE</span>
          <div style={{ display:"flex", gap:8 }}>
            <button style={{ fontSize:12, fontWeight:600, padding:"5px 12px", borderRadius:100, backgroundColor:`rgba(59,130,246,0.12)`, color:"#93c5fd", border:`1px solid rgba(59,130,246,0.2)`, cursor:"pointer" }}>All Belts</button>
            <button style={{ fontSize:12, fontWeight:600, padding:"5px 12px", borderRadius:100, backgroundColor:"transparent", color:"#4a5568", border:"1px solid rgba(255,255,255,0.07)", cursor:"pointer" }}>Black Belt</button>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {instructors.map(inst=>(
            <div key={inst.id} style={{ backgroundColor:"#060d1e", border:"1px solid rgba(255,255,255,0.07)", borderRadius:16, padding:"20px 24px", display:"flex", alignItems:"center", gap:20, cursor:"pointer" }}>
              <div style={{ width:52, height:52, borderRadius:"50%", background:PG, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:20, fontWeight:800, color:"#fff", boxShadow:`0 4px 16px rgba(59,130,246,0.25)` }}>{inst.name[0]}</div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:5 }}>
                  <span style={{ fontWeight:700, fontSize:16 }}>{inst.name}</span>
                  <span style={{ backgroundColor:(BELT[inst.belt]?.bg??"#0f1825"), color:(BELT[inst.belt]?.text??"#93c5fd"), padding:"2px 10px", borderRadius:100, fontSize:11, fontWeight:700 }}>{inst.belt}</span>
                </div>
                <div style={{ fontSize:13, color:"#4a5568", fontWeight:500 }}>{inst.years} years experience · {inst.services} services available</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:14, flexShrink:0 }}>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:11, color:"#4a5568", fontWeight:600 }}>FROM</div>
                  <div style={{ fontSize:22, fontWeight:900, color:P, letterSpacing:"-0.02em" }}>$65</div>
                </div>
                <button style={{ background:PG, color:"#fff", fontWeight:700, fontSize:14, padding:"11px 22px", border:"none", borderRadius:10, cursor:"pointer", whiteSpace:"nowrap", boxShadow:`0 4px 12px rgba(59,130,246,0.35)` }}>Book Now</button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:28, padding:24, backgroundColor:"rgba(59,130,246,0.05)", border:"1px solid rgba(59,130,246,0.15)", borderRadius:14, textAlign:"center" }}>
          <p style={{ color:"#8b9ab3", fontSize:14, margin:"0 0 12px" }}>Are you a BJJ instructor? <strong style={{ color:"#eef0f4" }}>Get your own booking page in minutes.</strong></p>
          <button style={{ backgroundColor:"transparent", color:P, fontWeight:700, fontSize:14, padding:"9px 22px", border:`1px solid rgba(59,130,246,0.4)`, borderRadius:9, cursor:"pointer" }}>Create Your Profile →</button>
        </div>
      </div>
    </div>
  );
}
