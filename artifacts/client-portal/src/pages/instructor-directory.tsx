import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, User, ChevronRight } from "lucide-react";

interface InstructorSummary {
  id: number;
  name: string;
  slug: string;
  serviceCount: number;
}

async function fetchInstructors(): Promise<{ instructors: InstructorSummary[] }> {
  const res = await fetch("/api/public/instructors");
  if (!res.ok) throw new Error("Failed to load instructors");
  return res.json();
}

const ACCENT = "#1aab90";
const ACCENT_DARK = "#128a74";
const ACCENT_GRADIENT = `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`;

export default function InstructorDirectory() {
  const [search, setSearch] = useState("");
  const [beltFilter, setBeltFilter] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-instructors"],
    queryFn: fetchInstructors,
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    if (!data?.instructors) return [];
    const q = search.toLowerCase().trim();
    if (!q) return data.instructors;
    return data.instructors.filter((i) => i.name.toLowerCase().includes(q));
  }, [data, search]);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#070b14", minHeight: "100vh", color: "#eef0f4" }}>

      {/* Hero */}
      <div style={{ position: "relative", overflow: "hidden", padding: "clamp(32px, 6vw, 56px) 20px clamp(28px, 4vw, 48px)", background: "linear-gradient(180deg, #0b1428 0%, #070b14 100%)" }}>
        <div style={{ position: "absolute", top: -140, left: "50%", transform: "translateX(-50%)", width: "min(700px, 140vw)", height: 450, background: `radial-gradient(ellipse, rgba(26,171,144,0.11) 0%, transparent 68%)`, pointerEvents: "none" }} />

        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
          {/* Pill badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, backgroundColor: "rgba(26,171,144,0.1)", border: "1px solid rgba(26,171,144,0.28)", borderRadius: 100, padding: "5px 16px", marginBottom: 20 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: ACCENT, display: "inline-block", boxShadow: `0 0 6px ${ACCENT}` }} />
            <span style={{ color: "#1aab90", fontSize: "clamp(10px, 2.5vw, 12px)", fontWeight: 700, letterSpacing: "0.08em" }}>BOOK A PRIVATE SESSION TODAY</span>
          </div>

          <h1 style={{ fontSize: "clamp(30px, 8vw, 52px)", fontWeight: 900, lineHeight: 1.07, letterSpacing: "-0.03em", margin: "0 0 14px" }}>
            Find Your Perfect<br />
            <span style={{ background: `linear-gradient(100deg, ${ACCENT} 30%, #fbbf24 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              BJJ Coach
            </span>
          </h1>

          <p style={{ color: "#8b9ab3", fontSize: "clamp(15px, 3.5vw, 18px)", lineHeight: 1.65, margin: "0 auto 28px", maxWidth: 480 }}>
            Connect with certified instructors, pick a time that works for you, and start rolling.
          </p>

          {/* Search */}
          <div style={{ position: "relative", maxWidth: 500, margin: "0 auto" }}>
            <Search style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "#4a5568", width: 18, height: 18, flexShrink: 0 }} />
            <input
              placeholder="Search by name or specialty..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "14px 18px 14px 48px", color: "#eef0f4", fontSize: 15, outline: "none", boxSizing: "border-box", WebkitAppearance: "none" }}
            />
          </div>

          {/* Trust signals */}
          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "6px 20px", marginTop: 20 }}>
            {["✓  No account needed", "✓  Free cancellation", "✓  Instant confirmation"].map((t) => (
              <span key={t} style={{ fontSize: "clamp(12px, 3vw, 13px)", color: "#6b7a94", fontWeight: 500 }}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Stats ribbon */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", backgroundColor: "#0b101d", padding: "14px 20px", display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "10px 40px" }}>
        {[["200+", "Sessions booked"], ["4.9 ★", "Average rating"], ["< 2hrs", "Response time"]].map(([v, l]) => (
          <div key={l} style={{ textAlign: "center", minWidth: 80 }}>
            <div style={{ fontSize: "clamp(16px, 4vw, 19px)", fontWeight: 800, color: "#eef0f4", letterSpacing: "-0.02em" }}>{v}</div>
            <div style={{ fontSize: "clamp(11px, 2.5vw, 12px)", color: "#4a5568", marginTop: 2, fontWeight: 500 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* List */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 56px" }}>

        {/* Filter / count row — stacks on very small screens */}
        {!isLoading && !error && (
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "10px 12px", marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: "#4a5568", fontWeight: 600, letterSpacing: "0.07em" }}>
              {filtered.length} INSTRUCTOR{filtered.length !== 1 ? "S" : ""} AVAILABLE
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[null, "Black Belt", "Brown Belt"].map((f) => (
                <button
                  key={String(f)}
                  onClick={() => setBeltFilter(f === beltFilter ? null : f)}
                  style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 100, cursor: "pointer", backgroundColor: beltFilter === f ? "rgba(26,171,144,0.12)" : "transparent", color: beltFilter === f ? "#1aab90" : "#4a5568", border: beltFilter === f ? "1px solid rgba(26,171,144,0.22)" : "1px solid rgba(255,255,255,0.07)", transition: "all 0.15s", minHeight: 32 }}>
                  {f ?? "All Belts"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading skeletons */}
        {isLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-24 w-full rounded-2xl" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <p style={{ color: "#4a5568", marginBottom: 12 }}>Unable to load instructors. Please try again.</p>
            <button onClick={() => window.location.reload()} style={{ backgroundColor: "transparent", color: ACCENT, border: `1px solid rgba(26,171,144,0.35)`, borderRadius: 9, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Retry</button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "56px 0" }}>
            {search ? (
              <>
                <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No instructors match "{search}"</p>
                <p style={{ color: "#4a5568", marginBottom: 16 }}>Try a different search term.</p>
                <button onClick={() => setSearch("")} style={{ backgroundColor: "transparent", color: ACCENT, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "6px 12px" }}>Clear search</button>
              </>
            ) : (
              <>
                <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <User style={{ width: 24, height: 24, color: "#4a5568" }} />
                </div>
                <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No instructors yet</p>
                <p style={{ color: "#4a5568" }}>Instructors will appear here once they create their profiles.</p>
              </>
            )}
          </div>
        )}

        {/* Static anchor list for crawlers that don't execute JavaScript */}
        <noscript>
          <div style={{ padding: "24px 0" }}>
            <p style={{ marginBottom: 12 }}>JavaScript is required to use this booking portal. You can find all instructor profiles in our <a href="https://bjj-session-planner.replit.app/api/public/sitemap.xml">sitemap</a>.</p>
          </div>
        </noscript>

        {/* Instructor cards */}
        {!isLoading && !error && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((instructor) => (
              <Link key={instructor.id} href={`/${instructor.slug}`}>
                <div
                  style={{ backgroundColor: "#0d1422", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", transition: "border-color 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(26,171,144,0.3)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)")}
                >
                  {/* Avatar */}
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: ACCENT_GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18, fontWeight: 800, color: "#fff", boxShadow: `0 3px 14px rgba(26,171,144,0.25)` }}>
                    {instructor.name[0]}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "clamp(14px, 3.5vw, 16px)", color: "#eef0f4", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{instructor.name}</div>
                    <div style={{ fontSize: 13, color: "#4a5568", fontWeight: 500 }}>
                      {instructor.serviceCount === 0 ? "Private training sessions" : `${instructor.serviceCount} service${instructor.serviceCount !== 1 ? "s" : ""} available`}
                    </div>
                  </div>

                  {/* CTA */}
                  <div style={{ flexShrink: 0 }}>
                    <button style={{ background: ACCENT_GRADIENT, color: "#fff", fontWeight: 700, fontSize: "clamp(12px, 3vw, 14px)", padding: "clamp(8px, 2vw, 10px) clamp(12px, 3vw, 20px)", border: "none", borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap", boxShadow: `0 3px 12px rgba(26,171,144,0.28)` }}>
                      Book Now
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Instructor sign-up CTA */}
        {!isLoading && !error && (
          <div style={{ marginTop: 28, padding: "22px 20px", backgroundColor: "rgba(26,171,144,0.05)", border: "1px solid rgba(26,171,144,0.14)", borderRadius: 14, textAlign: "center" }}>
            <p style={{ color: "#8b9ab3", fontSize: 14, margin: "0 0 12px" }}>
              Are you a BJJ instructor? <strong style={{ color: "#eef0f4" }}>Get your own booking page in minutes.</strong>
            </p>
            <a href="https://bjj-session-planner.replit.app" style={{ color: ACCENT, fontWeight: 700, fontSize: 14, textDecoration: "none", border: `1px solid rgba(26,171,144,0.35)`, padding: "9px 20px", borderRadius: 9, display: "inline-block" }}>
              Create Your Profile →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
