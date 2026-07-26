import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGetPublicProfile, getGetPublicProfileQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, MapPin, Phone, Globe, User, CalendarDays, ChevronRight } from "lucide-react";
import { formatCurrency, formatTime12 } from "@/lib/utils";

const BASE = "https://bjj-session-planner.replit.app/book";
const DEFAULT_OG_IMAGE = "https://bjj-session-planner.replit.app/book/opengraph.jpg";
const ACCENT = "#1aab90";
const ACCENT_DARK = "#128a74";

function setMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) { el = document.createElement("meta"); el.name = name; document.head.appendChild(el); }
  el.content = content;
}
function setOgMeta(property: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute("property", property); document.head.appendChild(el); }
  el.content = content;
}
function setCanonical(href: string) {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) { el = document.createElement("link"); el.rel = "canonical"; document.head.appendChild(el); }
  el.href = href;
}
function injectJsonLd(id: string, data: object) {
  removeJsonLd(id);
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = id;
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}
function removeJsonLd(id: string) { document.getElementById(id)?.remove(); }

/* ─── Availability widget ─────────────────────────────── */

function buildNextDays(n: number): { label: string; short: string; iso: string }[] {
  const days = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const short = d.toLocaleDateString("en-US", { weekday: "short" });
    days.push({ label, short, iso });
  }
  return days;
}

async function fetchSlots(slug: string, date: string): Promise<string[]> {
  const res = await fetch(`/api/public/${slug}/slots?date=${date}`);
  if (!res.ok) throw new Error("Failed to fetch slots");
  const data = await res.json();
  return data.slots as string[];
}

function AvailabilityWidget({ slug }: { slug: string }) {
  const days = buildNextDays(7);
  const [selectedIso, setSelectedIso] = useState(days[0].iso);

  const { data: slots, isLoading } = useQuery({
    queryKey: ["slots", slug, selectedIso],
    queryFn: () => fetchSlots(slug, selectedIso),
    staleTime: 60_000,
  });

  const hasSlots = (slots ?? []).length > 0;

  return (
    <div style={{ backgroundColor: "#0d1422", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "22px 20px", marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <CalendarDays style={{ width: 18, height: 18, color: ACCENT, flexShrink: 0 }} />
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#eef0f4", letterSpacing: "-0.01em" }}>Check Availability</h2>
      </div>

      {/* Day chips */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
        {days.map((d) => {
          const active = d.iso === selectedIso;
          return (
            <button
              key={d.iso}
              onClick={() => setSelectedIso(d.iso)}
              style={{ flexShrink: 0, padding: "8px 14px", borderRadius: 10, border: active ? "none" : "1px solid rgba(255,255,255,0.08)", background: active ? `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)` : "rgba(255,255,255,0.04)", color: active ? "#fff" : "#8b9ab3", fontSize: 13, fontWeight: active ? 700 : 500, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", boxShadow: active ? `0 3px 12px rgba(26,171,144,0.28)` : "none", transition: "all 0.15s" }}
            >
              {d.label}
            </button>
          );
        })}
      </div>

      {/* Slots */}
      <div style={{ marginTop: 16 }}>
        {isLoading && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-10 w-20 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        )}

        {!isLoading && !hasSlots && (
          <div style={{ padding: "18px 0", textAlign: "center" }}>
            <p style={{ color: "#4a5568", fontSize: 14, margin: 0 }}>No slots available this day. Try another date.</p>
          </div>
        )}

        {!isLoading && hasSlots && (
          <div>
            <p style={{ fontSize: 12, color: "#4a5568", fontWeight: 500, margin: "0 0 10px", letterSpacing: "0.04em" }}>
              {slots!.length} TIME SLOT{slots!.length !== 1 ? "S" : ""} AVAILABLE
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {slots!.map((time) => (
                <Link key={time} href={`/${slug}/book`}>
                  <button
                    style={{ padding: "9px 16px", borderRadius: 10, border: "1px solid rgba(26,171,144,0.28)", background: "rgba(26,171,144,0.07)", color: ACCENT, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; (e.currentTarget as HTMLButtonElement).style.border = "1px solid transparent"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(26,171,144,0.07)"; (e.currentTarget as HTMLButtonElement).style.color = ACCENT; (e.currentTarget as HTMLButtonElement).style.border = "1px solid rgba(26,171,144,0.28)"; }}
                  >
                    <Clock style={{ width: 13, height: 13 }} />
                    {formatTime12(time)}
                  </button>
                </Link>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <Link href={`/${slug}/book`}>
                <button
                  style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`, color: "#fff", fontWeight: 700, fontSize: 14, padding: "11px 22px", border: "none", borderRadius: 10, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: `0 3px 12px rgba(26,171,144,0.3)`, fontFamily: "inherit" }}
                >
                  Book a Session <ChevronRight size={16} />
                </button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main page ───────────────────────────────────────── */

export default function InstructorProfile() {
  const [match, params] = useRoute("/:slug");
  const slug = params?.slug || "";

  const { data, isLoading, error } = useGetPublicProfile(slug, {
    query: {
      enabled: !!slug,
      queryKey: getGetPublicProfileQueryKey(slug),
    },
  });

  useEffect(() => {
    if (!data && !error) return;
    if (error || !data) {
      document.title = "Instructor Not Found — Let's Roll";
      setMeta("robots", "noindex, follow");
      setMeta("description", "This instructor profile could not be found.");
      removeJsonLd("instructor-jsonld");
      return;
    }
    const { instructor, services } = data;
    const canonicalUrl = `${BASE}/${slug}`;
    const description = instructor.bio
      ? `${instructor.bio.slice(0, 155)}…`
      : `Book a private BJJ session with ${instructor.name}. ${services.length} service${services.length !== 1 ? "s" : ""} available.`;
    const pageTitle = `${instructor.name} | BJJ Private Lessons | Let's Roll`;
    const ogImage = instructor.photoUrl || DEFAULT_OG_IMAGE;
    document.title = pageTitle;
    setMeta("robots", "index, follow");
    setMeta("description", description);
    setOgMeta("og:title", pageTitle);
    setOgMeta("og:description", description);
    setOgMeta("og:url", canonicalUrl);
    setOgMeta("og:type", "profile");
    setOgMeta("og:image", ogImage);
    setOgMeta("og:site_name", "Let's Roll");
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", pageTitle);
    setMeta("twitter:description", description);
    setMeta("twitter:image", ogImage);
    setCanonical(canonicalUrl);
    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Person",
      name: instructor.name,
      url: canonicalUrl,
      jobTitle: "BJJ Instructor",
      description: instructor.bio ?? undefined,
      address: instructor.location ? { "@type": "PostalAddress", addressLocality: instructor.location } : undefined,
      telephone: instructor.phone ?? undefined,
      sameAs: instructor.website ? [instructor.website] : undefined,
      image: instructor.photoUrl ?? undefined,
      makesOffer: services.map((s) => ({
        "@type": "Offer",
        name: s.name,
        price: (s.price / 100).toFixed(2),
        priceCurrency: "USD",
        url: `${canonicalUrl}/book`,
      })),
    };
    injectJsonLd("instructor-jsonld", jsonLd);
    return () => {
      removeJsonLd("instructor-jsonld");
      setMeta("robots", "index, follow");
      document.title = "Find BJJ Private Lessons | Let's Roll";
    };
  }, [data, error, slug]);

  if (isLoading) {
    return (
      <div className="max-w-md sm:max-w-2xl mx-auto py-10 px-4 space-y-6">
        <Skeleton className="h-12 w-3/4 mx-auto rounded-lg" />
        <Skeleton className="h-4 w-1/2 mx-auto rounded" />
        <div className="space-y-4 mt-8">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
        <Skeleton className="h-14 w-full rounded-xl mt-8" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
          <User className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Instructor not found</h1>
        <p className="text-muted-foreground mb-8">
          The booking link you followed might be invalid or the instructor has removed their profile.
        </p>
      </div>
    );
  }

  const { instructor, services } = data;
  const hasPhoto = !!instructor.photoUrl;
  const hasBio = !!instructor.bio;
  const hasLocation = !!instructor.location;
  const hasPhone = !!instructor.phone;
  const hasWebsite = !!instructor.website;
  const hasAnyDetail = hasBio || hasLocation || hasPhone || hasWebsite;

  return (
    <div className="max-w-md sm:max-w-2xl mx-auto px-4 pt-10 pb-32">
      {/* Profile header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:gap-8 mb-10">
        <div className="flex justify-center sm:justify-start mb-4 sm:mb-0 sm:flex-shrink-0">
          {hasPhoto ? (
            <img src={instructor.photoUrl!} alt={instructor.name} className="w-24 h-24 rounded-full object-cover ring-4 ring-primary/10" />
          ) : (
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center ring-4 ring-primary/5">
              <User className="w-10 h-10 text-primary" />
            </div>
          )}
        </div>

        <div className="text-center sm:text-left flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">{instructor.name}</h1>
          {hasAnyDetail ? (
            <div className="space-y-2">
              {hasBio && <p className="text-muted-foreground text-sm leading-relaxed">{instructor.bio}</p>}
              <div className="flex flex-wrap justify-center sm:justify-start gap-x-4 gap-y-1 mt-3">
                {hasLocation && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />{instructor.location}
                  </span>
                )}
                {hasPhone && (
                  <a href={`tel:${instructor.phone}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Phone className="w-3.5 h-3.5 flex-shrink-0" />{instructor.phone}
                  </a>
                )}
                {hasWebsite && (
                  <a href={instructor.website!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Globe className="w-3.5 h-3.5 flex-shrink-0" />{instructor.website!.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Book your next training session</p>
          )}
        </div>
      </div>

      {/* ── Availability widget ── */}
      <AvailabilityWidget slug={slug} />

      {/* Services */}
      <div className="space-y-4 mb-6">
        <h2 className="text-lg font-semibold tracking-tight">Available Services</h2>
        {services.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No services available right now.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((service) => (
              <Card key={service.id} className="overflow-hidden border-border/50 bg-card hover:border-primary/50 transition-colors">
                <CardContent className="p-0">
                  <div className="p-5 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-medium text-base leading-none mb-2">{service.name}</h3>
                      <div className="flex items-center text-sm text-muted-foreground gap-1.5">
                        <Clock className="w-4 h-4" />
                        <span>Private Session</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold">{formatCurrency(service.price)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Fixed bottom bar — mobile only */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t border-border/50 sm:hidden">
        <div className="max-w-md mx-auto">
          <Button asChild size="lg" className="w-full text-base h-14 rounded-xl shadow-lg">
            <Link href={`/${slug}/book`}>Book a Session</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
