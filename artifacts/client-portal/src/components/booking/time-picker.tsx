import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface TimePickerProps {
  slug: string;
  date: Date;
  value: string | null;
  onChange: (time: string) => void;
  onNext: () => void;
}

function formatTimeDisplay(time24: string): string {
  if (!time24) return "";
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function TimePicker({ slug, date, value, onChange, onNext }: TimePickerProps) {
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dateStr = format(date, "yyyy-MM-dd");
    setLoading(true);
    setError(null);
    setSlots([]);

    fetch(`/api/public/${encodeURIComponent(slug)}/slots?date=${dateStr}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load available times (${res.status})`);
        return res.json() as Promise<{ slots: string[] }>;
      })
      .then((data) => {
        setSlots(data.slots ?? []);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Could not load available times.";
        setError(message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug, date]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight">Select a Time</h2>
        <p className="text-sm text-muted-foreground">
          Available slots for {format(date, "EEEE, MMMM d")}.
        </p>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="text-center py-12 border border-border/50 rounded-xl bg-card/50">
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && slots.length === 0 && (
        <div className="text-center py-12 border border-border/50 rounded-xl bg-card/50">
          <p className="text-muted-foreground">No available time slots on this date.</p>
        </div>
      )}

      {!loading && !error && slots.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {slots.map((slot) => (
            <Button
              key={slot}
              variant={value === slot ? "default" : "outline"}
              className={`h-14 text-base ${
                value === slot
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "border-border/50 bg-card hover:bg-accent"
              }`}
              onClick={() => onChange(slot)}
            >
              {formatTimeDisplay(slot)}
            </Button>
          ))}
        </div>
      )}

      <div className="pt-4">
        <Button
          size="lg"
          className="w-full h-14 text-base rounded-xl"
          disabled={!value || loading}
          onClick={onNext}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
