---
name: time-slot-conflict-check
description: Prevent double-booking by checking for conflicting time slots before creating or rescheduling a session. Use whenever adding or modifying a POST/PATCH endpoint that schedules appointments. Covers the Drizzle query pattern, the PATCH edge case (resolving proposed vs existing date/time), and the correct status exclusion.
---

# Time Slot Conflict Check Pattern

## The problem
Without a conflict check, two clients booking simultaneously can both succeed for the same instructor + date + time. The insert race is not prevented by a DB unique constraint (because cancelled sessions should be allowed to "reuse" a slot).

## Fix: check before insert (POST)

```typescript
import { eq, and, ne } from "drizzle-orm";

// Run this BEFORE the db.insert() call
const [conflict] = await db
  .select({ id: sessionsTable.id })
  .from(sessionsTable)
  .where(
    and(
      eq(sessionsTable.instructorId, instructorId),
      eq(sessionsTable.date, date),
      eq(sessionsTable.time, time),
      ne(sessionsTable.status, "cancelled")   // cancelled slots are free to rebook
    )
  )
  .limit(1);

if (conflict) {
  res.status(409).json({ error: "A session is already booked at this date and time" });
  return;
}
```

**Key**: use `ne(status, "cancelled")` not `eq(status, "scheduled")` — this correctly blocks both `scheduled` and `completed` and `no_show` statuses from being double-booked, while allowing a cancelled slot to be reused.

## Fix: check before reschedule (PATCH)

The PATCH case is trickier because:
1. The check should only run when `date` or `time` is actually changing
2. The new slot's date/time may be a mix of proposed + existing values
3. The session being updated must be **excluded** from its own conflict check

```typescript
// First, fetch the existing session (include date + time for fallback)
const [existing] = await db
  .select({
    status: sessionsTable.status,
    date: sessionsTable.date,
    time: sessionsTable.time,
    // ...other fields you need
  })
  .from(sessionsTable)
  .where(and(eq(sessionsTable.id, sessionId), eq(sessionsTable.instructorId, instructorId)))
  .limit(1);

if (!existing) {
  res.status(404).json({ error: "Session not found" });
  return;
}

// Only check if date or time is being changed
if (updates.date !== undefined || updates.time !== undefined) {
  const newDate = updates.date ?? existing.date;   // fall back to current if not changing
  const newTime = updates.time ?? existing.time;

  const [conflict] = await db
    .select({ id: sessionsTable.id })
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.instructorId, instructorId),
        eq(sessionsTable.date, newDate),
        eq(sessionsTable.time, newTime),
        ne(sessionsTable.status, "cancelled"),
        ne(sessionsTable.id, sessionId)           // exclude self
      )
    )
    .limit(1);

  if (conflict) {
    res.status(409).json({ error: "A session is already booked at this date and time" });
    return;
  }
}
```

## Response code
Always return **`409 Conflict`** for double-booking — not 400 (bad input) or 422. The input is valid; the resource state prevents it.

## Public booking route
The same check applies in `public.ts` when clients book via the portal (`POST /api/public/:slug/session`). The instructor's ID is resolved from the slug before running the conflict query.

## Composite index requirement
This check does a 3-column filter (`instructor_id + date + time`). Without a composite index it scans the whole sessions table. Make sure the schema has:

```typescript
index("sessions_instructor_date_time_idx").on(t.instructorId, t.date, t.time)
```

See the `drizzle-indexes` skill for how to add this.

## Reference implementation
`artifacts/api-server/src/routes/sessions.ts` — both the POST and PATCH handlers contain the full working implementation.
