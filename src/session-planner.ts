export interface Session {
  instructor: string;
  start: string; // ISO time string, e.g. 09:00
  end: string;   // ISO time string, e.g. 10:30
  students: number;
}

export function parseTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function sessionsOverlap(a: Session, b: Session): boolean {
  const aStart = parseTime(a.start);
  const aEnd = parseTime(a.end);
  const bStart = parseTime(b.start);
  const bEnd = parseTime(b.end);

  return aStart < bEnd && bStart < aEnd;
}

export function canScheduleSession(existing: Session[], next: Session): boolean {
  return !existing.some((session) => sessionsOverlap(session, next));
}

export function scheduleSession(existing: Session[], next: Session): Session[] {
  if (!canScheduleSession(existing, next)) {
    throw new Error('Session conflicts with existing schedule');
  }
  return [...existing, next];
}
