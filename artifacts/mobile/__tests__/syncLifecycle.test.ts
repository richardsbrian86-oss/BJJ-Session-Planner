/**
 * Integration-style tests for the sync lifecycle in SchedulerContext.
 *
 * These tests drive applySyncResult() — the pure function that syncWithBackend()
 * calls to decide (a) which pending IDs to clear and (b) what session list to
 * commit to state. Regressions in either decision will be caught here without
 * needing to render React components.
 */
import {
  applySyncResult,
  sessionMatchesBackend,
  SyncableSession,
} from "../utils/syncMerge";

function makeSession(
  overrides: Partial<SyncableSession> & { id: string }
): SyncableSession {
  return {
    cancellationToken: null,
    waiverId: null,
    clientName: "Test Client",
    clientPhone: "555-1234",
    clientEmail: "test@example.com",
    date: "2026-07-20",
    startTime: "10:00",
    status: "confirmed",
    notes: "",
    serviceName: "BJJ Intro",
    servicePrice: 50,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// sessionMatchesBackend — unit tests for the comparison predicate
// ---------------------------------------------------------------------------

describe("sessionMatchesBackend — auto-clear pending detection", () => {
  it("returns true when all fields match exactly", () => {
    const session = {
      clientName: "Alice",
      clientPhone: "555-0001",
      clientEmail: "alice@example.com",
      date: "2026-07-20",
      startTime: "09:00",
      status: "confirmed",
      notes: "Bring gear",
      serviceName: "BJJ Intro",
      servicePrice: 60,
    };
    expect(sessionMatchesBackend(session, { ...session })).toBe(true);
  });

  it("returns false when clientName differs", () => {
    const base = {
      clientName: "Alice",
      clientPhone: "555-0001",
      clientEmail: "alice@example.com",
      date: "2026-07-20",
      startTime: "09:00",
      status: "confirmed",
      notes: "",
      serviceName: null,
      servicePrice: null,
    };
    expect(sessionMatchesBackend(base, { ...base, clientName: "Bob" })).toBe(false);
  });

  it("returns false when status differs", () => {
    const base = {
      clientName: "Alice",
      clientPhone: "555-0001",
      clientEmail: null,
      date: "2026-07-20",
      startTime: "09:00",
      status: "confirmed",
      notes: null,
      serviceName: null,
      servicePrice: null,
    };
    expect(sessionMatchesBackend(base, { ...base, status: "cancelled" })).toBe(false);
  });

  it("returns false when date differs", () => {
    const base = {
      clientName: "Alice",
      clientPhone: "555-0001",
      clientEmail: null,
      date: "2026-07-20",
      startTime: "09:00",
      status: "confirmed",
      notes: null,
      serviceName: null,
      servicePrice: null,
    };
    expect(sessionMatchesBackend(base, { ...base, date: "2026-07-21" })).toBe(false);
  });

  it("treats null and undefined clientEmail as equivalent", () => {
    const local = {
      clientName: "Alice",
      clientPhone: "555-0001",
      clientEmail: undefined as string | null | undefined,
      date: "2026-07-20",
      startTime: "09:00",
      status: "confirmed",
      notes: null,
      serviceName: null,
      servicePrice: null,
    };
    const api = { ...local, clientEmail: null as string | null | undefined };
    expect(sessionMatchesBackend(local, api)).toBe(true);
  });

  it("treats null and undefined notes as equivalent", () => {
    const local = {
      clientName: "Alice",
      clientPhone: "555-0001",
      clientEmail: null,
      date: "2026-07-20",
      startTime: "09:00",
      status: "confirmed",
      notes: undefined as string | null | undefined,
      serviceName: null,
      servicePrice: null,
    };
    expect(sessionMatchesBackend(local, { ...local, notes: null })).toBe(true);
  });

  it("treats null and undefined servicePrice as equivalent (both map to 0)", () => {
    const local = {
      clientName: "Alice",
      clientPhone: "555-0001",
      clientEmail: null,
      date: "2026-07-20",
      startTime: "09:00",
      status: "confirmed",
      notes: null,
      serviceName: null,
      servicePrice: undefined as number | null | undefined,
    };
    expect(sessionMatchesBackend(local, { ...local, servicePrice: null })).toBe(true);
  });

  it("returns false when servicePrice differs by a real value", () => {
    const base = {
      clientName: "Alice",
      clientPhone: "555-0001",
      clientEmail: null,
      date: "2026-07-20",
      startTime: "09:00",
      status: "confirmed",
      notes: null,
      serviceName: "BJJ",
      servicePrice: 60 as number | null,
    };
    expect(sessionMatchesBackend(base, { ...base, servicePrice: 80 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applySyncResult — integration tests for the full syncWithBackend decision
//
// These exercise the exact function that syncWithBackend() calls after it
// fetches from the API. Asserting clearedIds and nextSessions here is
// equivalent to asserting what unmarkPending() and setSessions() would
// receive in the live context.
// ---------------------------------------------------------------------------

describe("applySyncResult — auto-clear pending (syncWithBackend integration)", () => {
  it("adds the session ID to clearedIds when the backend already reflects the local edit", () => {
    const local = makeSession({
      id: "b-1",
      clientName: "Alice",
      status: "confirmed",
    });
    const apiVersion = makeSession({
      id: "b-1",
      clientName: "Alice",
      status: "confirmed",
    });
    const pendingIds = new Set(["b-1"]);

    const { clearedIds, nextSessions } = applySyncResult(
      [apiVersion],
      [local],
      pendingIds
    );

    expect(clearedIds).toEqual(["b-1"]);
    expect(nextSessions).toHaveLength(1);
    expect(nextSessions[0].id).toBe("b-1");
  });

  it("does NOT add to clearedIds when the backend still has the old data", () => {
    const local = makeSession({
      id: "b-2",
      clientName: "Updated Name",
      status: "confirmed",
    });
    const apiOld = makeSession({
      id: "b-2",
      clientName: "Old Name",
      status: "confirmed",
    });
    const pendingIds = new Set(["b-2"]);

    const { clearedIds } = applySyncResult([apiOld], [local], pendingIds);

    expect(clearedIds).toHaveLength(0);
  });

  it("clears only the matched session and keeps the unmatched one pending in nextSessions", () => {
    const matched = makeSession({ id: "b-3", clientName: "Alice", status: "confirmed" });
    const unmatched = makeSession({ id: "b-4", clientName: "Bob (edited)", status: "pending" });

    const apiMatched = makeSession({ id: "b-3", clientName: "Alice", status: "confirmed" });
    const apiUnmatched = makeSession({ id: "b-4", clientName: "Bob (old)", status: "pending" });

    const pendingIds = new Set(["b-3", "b-4"]);

    const { clearedIds, nextSessions } = applySyncResult(
      [apiMatched, apiUnmatched],
      [matched, unmatched],
      pendingIds
    );

    expect(clearedIds).toEqual(["b-3"]);

    const unmatchedResult = nextSessions.find((s) => s.id === "b-4");
    expect(unmatchedResult?.clientName).toBe("Bob (edited)");
  });

  it("does not clear a non-pending session even when data matches", () => {
    const nonPending = makeSession({ id: "b-5", clientName: "Carol" });
    const apiVersion = makeSession({ id: "b-5", clientName: "Carol" });
    const pendingIds = new Set<string>();

    const { clearedIds } = applySyncResult([apiVersion], [nonPending], pendingIds);

    expect(clearedIds).toHaveLength(0);
  });

  it("propagates server-assigned cancellationToken into nextSessions for the auto-cleared session", () => {
    const local = makeSession({ id: "b-6", cancellationToken: null });
    const apiWithToken = makeSession({
      id: "b-6",
      cancellationToken: "tok_server_abc",
    });
    const pendingIds = new Set(["b-6"]);

    const { clearedIds, nextSessions } = applySyncResult(
      [apiWithToken],
      [local],
      pendingIds
    );

    expect(clearedIds).toContain("b-6");
    expect(nextSessions[0].cancellationToken).toBe("tok_server_abc");
  });
});

describe("applySyncResult — push-on-empty guard (syncWithBackend integration)", () => {
  it("preserves local pending sessions when the API returns an empty list", () => {
    const pending = makeSession({ id: "p-1", clientName: "Offline Booking" });
    const pendingIds = new Set(["p-1"]);

    const { clearedIds, nextSessions } = applySyncResult([], [pending], pendingIds);

    expect(clearedIds).toHaveLength(0);
    expect(nextSessions).toHaveLength(1);
    expect(nextSessions[0].id).toBe("p-1");
    expect(nextSessions[0].clientName).toBe("Offline Booking");
  });

  it("preserves multiple pending sessions when the API returns an empty list", () => {
    const s1 = makeSession({ id: "p-2" });
    const s2 = makeSession({ id: "p-3" });
    const pendingIds = new Set(["p-2", "p-3"]);

    const { nextSessions } = applySyncResult([], [s1, s2], pendingIds);

    expect(nextSessions).toHaveLength(2);
    expect(nextSessions.map((s) => s.id)).toEqual(
      expect.arrayContaining(["p-2", "p-3"])
    );
  });

  it("does not include non-pending sessions when API returns empty (server is source of truth for synced sessions)", () => {
    const nonPending = makeSession({ id: "np-1" });
    const pendingIds = new Set<string>();

    const { nextSessions } = applySyncResult([], [nonPending], pendingIds);

    expect(nextSessions).toHaveLength(0);
  });

  it("returns an empty clearedIds when API is empty — nothing to auto-clear", () => {
    const pending = makeSession({ id: "p-4" });
    const pendingIds = new Set(["p-4"]);

    const { clearedIds } = applySyncResult([], [pending], pendingIds);

    expect(clearedIds).toHaveLength(0);
  });
});
