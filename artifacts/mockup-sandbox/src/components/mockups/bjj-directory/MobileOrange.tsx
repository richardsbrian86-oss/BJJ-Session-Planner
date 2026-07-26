import "./_group.css";

const instructors = [
  { id: 1, name: "Marcus Silva", belt: "Black Belt", services: 3, years: 15, price: 65 },
  { id: 2, name: "Jordan Reyes", belt: "Black Belt", services: 2, years: 8,  price: 55 },
  { id: 3, name: "Casey Park",   belt: "Brown Belt", services: 4, years: 6,  price: 45 },
];

const P = "#f97316";
const PD = "#ea580c";
const PG = `linear-gradient(135deg, ${P} 0%, ${PD} 100%)`;

export function MobileOrange() {
  return (
    <div style={{ fontFamily:"'Inter',sans-serif", backgroundColor:"#070b14", minHeight:"100vh", color:"#eef0f4", width:390, margin:"0 auto" }}>
      {/* Header */}
      <header style={{ borderBottom:"1px solid rgba(255,255,255,0.08)", backgroundColor:"rgba(7,11,20,0.97)", backdropFilter:"blur(12px)", position:"sticky", top:0, zIndex:50, padding:"0 16px", height:52, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <svg width="26" height="26" viewBox="0 0 30 30" fill="none">
            <circle cx="15" cy="15" r="14" stroke={P} strokeWidth="2"/>
            <circle cx="15" cy="15" r="6.5" fill={P}/>
          </svg>
          <span style={{ fontWeight:800, fontSize:16, letterSpacing:"-0.02em" }}>Let's Roll</span>
        </div>
        <button style={{ background:PG, color:"#fff", fontSize:13, fontWeight:700, padding:"7px 16px", border:"none", borderRadius:8, cursor:"pointer", boxShadow:`0 3px 10px rgba(249,115,22,0.4)` }}>Sign Up</button>
      </header>

      {/* Hero */}
      <div style={{ position:"relative", overflow:"hidden", padding:"36px 16px 32px", background:"linear-gradient(180deg,#0b1428 0%,#070b14 100%)", textAlign:"center" }}>
        <div style={{ position:"absolute", top:-80, left:"50%", transform:"translateX(-50%)", width:300, height:200, background:`radial-gradient(ellipse, rgba(249,115,22,0.14) 0%, transparent 70%)`, pointerEvents:"none" }}/>
        <div style={{ position:"relative", zIndex:1 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:6, backgroundColor:"rgba(249,115,22,0.1)", border:"1px solid rgba(249,115,22,0.25)", borderRadius:100, padding:"4px 12px", marginBottom:20 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", backgroundColor:P, display:"inline-block" }}/>
            <span style={{ color:"#fb923c", fontSize:11, fontWeight:700, letterSpacing:"0.07em" }}>BOOK A PRIVATE SESSION</span>
          </div>
          <h1 style={{ fontSize:34, fontWeight:900, lineHeight:1.1, letterSpacing:"-0.03em", margin:"0 0 12px" }}>
            Find Your<br/>
            <span style={{ background:`linear-gradient(100deg, ${P} 30%, #fbbf24 100%)`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>BJJ Coach</span>
          </h1>
          <p style={{ color:"#8b9ab3", fontSize:14, lineHeight:1.6, margin:"0 0 24px" }}>
            Certified instructors, flexible schedule, real results.
          </p>
          {/* Search */}
          <div style={{ position:"relative" }}>
            <svg style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"#4a5568" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input placeholder="Search instructors..." style={{ width:"100%", backgroundColor:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"13px 14px 13px 42px", color:"#eef0f4", fontSize:14, outline:"none", boxSizing:"border-box" }}/>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ backgroundColor:"#0b101d", borderTop:"1px solid rgba(255,255,255,0.05)", borderBottom:"1px solid rgba(255,255,255,0.05)", padding:"12px 16px", display:"flex", justifyContent:"space-around" }}>
        {[["200+","Sessions"],["4.9★","Rating"],["<2hr","Response"]].map(([v,l])=>(
          <div key={l} style={{ textAlign:"center" }}>
            <div style={{ fontSize:17, fontWeight:800 }}>{v}</div>
            <div style={{ fontSize:11, color:"#4a5568", fontWeight:500 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Instructor cards */}
      <div style={{ padding:"20px 16px 32px" }}>
        <div style={{ fontSize:11, color:"#4a5568", fontWeight:600, letterSpacing:"0.06em", marginBottom:14 }}>3 INSTRUCTORS AVAILABLE</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {instructors.map(inst=>(
            <div key={inst.id} style={{ backgroundColor:"#0d1422", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"16px", cursor:"pointer" }}>
              <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:12 }}>
                <div style={{ width:44, height:44, borderRadius:"50%", background:PG, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:17, fontWeight:800, color:"#fff", boxShadow:`0 3px 12px rgba(249,115,22,0.28)` }}>{inst.name[0]}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:15, marginBottom:3 }}>{inst.name}</div>
                  <div style={{ fontSize:12, color:"#4a5568" }}>{inst.years} yrs · {inst.services} services</div>
                </div>
                <div style={{ fontSize:11, color:"#4a5568", textAlign:"right" }}>
                  <div style={{ fontWeight:500 }}>from</div>
                  <div style={{ fontSize:19, fontWeight:900, color:P, letterSpacing:"-0.02em" }}>${inst.price}</div>
                </div>
              </div>
              <button style={{ width:"100%", background:PG, color:"#fff", fontWeight:700, fontSize:14, padding:"11px", border:"none", borderRadius:10, cursor:"pointer", boxShadow:`0 3px 10px rgba(249,115,22,0.3)` }}>Book Now</button>
            </div>
          ))}
        </div>

        {/* Instructor CTA */}
        <div style={{ marginTop:20, padding:"18px 16px", backgroundColor:"rgba(249,115,22,0.06)", border:"1px solid rgba(249,115,22,0.15)", borderRadius:12, textAlign:"center" }}>
          <p style={{ color:"#8b9ab3", fontSize:13, margin:"0 0 10px" }}>Are you an instructor? <strong style={{ color:"#eef0f4" }}>Get your own booking page.</strong></p>
          <button style={{ backgroundColor:"transparent", color:P, fontWeight:700, fontSize:13, padding:"8px 18px", border:`1px solid rgba(249,115,22,0.4)`, borderRadius:8, cursor:"pointer" }}>Create Profile →</button>
        </div>
      </div>
    </div>
  );
}
