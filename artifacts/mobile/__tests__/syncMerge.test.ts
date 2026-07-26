import { mergeSessions, MergeableSession } from "../utils/syncMerge";

function makeSession(overrides: Partial<MergeableSession> & { id: string }): MergeableSession {
  return {
    cancellationToken: null,
    waiverId: null,
    clientName: "Test Client",
    date: "2026-07-20",
    startTime: "10:00",
    status: "confirmed",
    ...overrides,
  };
}

describe("mergeSessions — cancellationToken merge behaviour", () => {
  it("picks up API cancellationToken when local token is null (booking link fix)", () => {
    const localSession = makeSession({ id: "abc", cancellationToken: null });
    const apiSession = makeSession({ id: "abc", cancellationToken: "tok_from_server" });
    const pendingIds = new Set(["abc"]);

    const result = mergeSessions([apiSession], [localSession], pendingIds);

    expect(result).toHaveLength(1);
    expect(result[0].cancellationToken).toBe("tok_from_server");
  });

  it("keeps existing local cancellationToken when it is already non-null", () => {
    const localSession = makeSession({ id: "abc", cancellationToken: "tok_local" });
    const apiSession = makeSession({ id: "abc", cancellationToken: "tok_from_server" });
    const pendingIds = new Set(["abc"]);

    const result = mergeSessions([apiSession], [localSession], pendingIds);

    expect(result).toHaveLength(1);
    expect(result[0].cancellationToken).toBe("tok_local");
  });

  it("picks up API cancellationToken when local token is undefined", () => {
    const localSession = makeSession({ id: "abc" });
    delete (localSession as Partial<MergeableSession>).cancellationToken;
    const apiSession = makeSession({ id: "abc", cancellationToken: "tok_from_server" });
    const pendingIds = new Set(["abc"]);

    const result = mergeSessions([apiSession], [localSession], pendingIds);

    expect(result[0].cancellationToken).toBe("tok_from_server");
  });
});

describe("mergeSessions — pending vs non-pending sessions", () => {
  it("uses API data for sessions not in pendingIds", () => {
    const localSession = makeSession({ id: "xyz", clientName: "Local Name" });
    const apiSession = makeSession({ id: "xyz", clientName: "API Name", cancellationToken: "tok" });
    const pendingIds = new Set<string>();

    const result = mergeSessions([apiSession], [localSession], pendingIds);

    expect(result[0].clientName).toBe("API Name");
    expect(result[0].cancellationToken).toBe("tok");
  });

  it("keeps local edits for pending sessions but merges in server-assigned token", () => {
    const localSession = makeSession({
      id: "pending-1",
      clientName: "Edited Locally",
      cancellationToken: null,
    });
    const apiSession = makeSession({
      id: "pending-1",
      clientName: "Old API Name",
      cancellationToken: "tok_server",
    });
    const pendingIds = new Set(["pending-1"]);

    const result = mergeSessions([apiSession], [localSession], pendingIds);

    expect(result[0].clientName).toBe("Edited Locally");
    expect(result[0].cancellationToken).toBe("tok_server");
  });

  it("includes local-only pending sessions missing from API response", () => {
    const localPending = makeSession({ id: "local-only", cancellationToken: null });
    const apiSession = makeSession({ id: "other", cancellationToken: "tok" });
    const pendingIds = new Set(["local-only"]);

    const result = mergeSessions([apiSession], [localPending], pendingIds);

    expect(result).toHaveLength(2);
    const localOnlyResult = result.find((s) => s.id === "local-only");
    expect(localOnlyResult).toBeDefined();
  });

  it("returns API session unchanged when pending ID has no matching local session", () => {
    const apiSession = makeSession({ id: "ghost", cancellationToken: "tok_ghost" });
    const pendingIds = new Set(["ghost"]);

    const result = mergeSessions([apiSession], [], pendingIds);

    expect(result[0]).toEqual(apiSession);
  });
});

describe("mergeSessions — waiverId merge behaviour", () => {
  it("picks up API waiverId when local waiverId is null", () => {
    const localSession = makeSession({ id: "w1", waiverId: null });
    const apiSession = makeSession({ id: "w1", waiverId: 42 });
    const pendingIds = new Set(["w1"]);

    const result = mergeSessions([apiSession], [localSession], pendingIds);

    expect(result[0].waiverId).toBe(42);
  });

  it("keeps local waiverId when it is already set", () => {
    const localSession = makeSession({ id: "w2", waiverId: 7 });
    const apiSession = makeSession({ id: "w2", waiverId: 99 });
    const pendingIds = new Set(["w2"]);

    const result = mergeSessions([apiSession], [localSession], pendingIds);

    expect(result[0].waiverId).toBe(7);
  });
});
