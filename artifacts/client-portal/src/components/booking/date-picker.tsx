import { Availability } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { addDays, format, isBefore, startOfToday } from "date-fns";

interface DatePickerProps {
  availability: Availability[];
  value: Date | null;
  onChange: (date: Date) => void;
  onNext: () => void;
}

export function DatePicker({ availability, value, onChange, onNext }: DatePickerProps) {
  const today = startOfToday();
  const maxDate = addDays(today, 35);

  const availableDaysMap = new Map<number, Availability>();
  
  availability.forEach(a => {
    if (a.enabled) {
      let dayIndex = -1;
      if (!isNaN(parseInt(a.day))) {
        dayIndex = parseInt(a.day);
      } else {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        dayIndex = days.indexOf(a.day.toLowerCase());
      }
      if (dayIndex !== -1) {
        availableDaysMap.set(dayIndex, a);
      }
    }
  });

  const isDateDisabled = (date: Date) => {
    if (isBefore(date, today) || isBefore(maxDate, date)) {
      return true;
    }
    const dayOfWeek = date.getDay();
    return !availableDaysMap.has(dayOfWeek);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight">Choose a Date</h2>
        <p className="text-sm text-muted-foreground">
          Select a day for your training session.
        </p>
      </div>

      <div className="flex justify-center border border-border/50 rounded-xl p-4 bg-card/50">
        <Calendar
          mode="single"
          selected={value || undefined}
          onSelect={(date) => date && onChange(date)}
          disabled={isDateDisabled}
          className="pointer-events-auto"
          classNames={{
            day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            day_today: "bg-accent text-accent-foreground",
            day_disabled: "text-muted-foreground opacity-30",
          }}
        />
      </div>

      {value && (
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between animate-in fade-in duration-300">
          <div>
            <div className="text-sm text-muted-foreground">Selected Date</div>
            <div className="font-semibold">{format(value, "EEEE, MMMM d")}</div>
          </div>
        </div>
      )}

      <div className="pt-4">
        <Button 
          size="lg" 
          className="w-full h-14 text-base rounded-xl"
          disabled={!value}
          onClick={onNext}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
