import { describe, expect, it } from 'vitest';
import { canScheduleSession, scheduleSession, sessionsOverlap, Session } from './session-planner';

describe('BJJ session planner', () => {
  const baseline: Session[] = [
    { instructor: 'Coach Lee', start: '09:00', end: '10:00', students: 4 },
    { instructor: 'Coach Lee', start: '10:30', end: '11:30', students: 5 },
  ];

  it('detects overlapping sessions correctly', () => {
    const overlap: Session = { instructor: 'Coach Lee', start: '09:30', end: '10:15', students: 3 };
    expect(sessionsOverlap(baseline[0], overlap)).toBe(true);
    expect(sessionsOverlap(baseline[1], overlap)).toBe(false);
  });

  it('allows scheduling a non-overlapping session', () => {
    const next: Session = { instructor: 'Coach Lee', start: '11:30', end: '12:30', students: 6 };
    expect(canScheduleSession(baseline, next)).toBe(true);
    expect(scheduleSession(baseline, next)).toHaveLength(3);
  });

  it('rejects a conflicting session', () => {
    const conflicting: Session = { instructor: 'Coach Lee', start: '10:00', end: '11:00', students: 6 };
    expect(canScheduleSession(baseline, conflicting)).toBe(false);
    expect(() => scheduleSession(baseline, conflicting)).toThrow('Session conflicts with existing schedule');
  });
});
