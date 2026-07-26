/**
 * Minimal shape required by mergeSessions. SchedulerContext.Session satisfies
 * this interface via TypeScript structural typing, so no cross-import is needed.
 */
export interface MergeableSession {
  id: string;
  cancellationToken?: string | null;
  waiverId?: number | null;
  [key: string]: unknown;
}

/**
 * Fields compared to determine whether the backend already reflects a local
 * pending edit. Used by syncWithBackend to auto-clear the pending flag.
 */
export interface BackendComparableSession {
  clientName: string;
  clientPhone: string;
  clientEmail?: string | null;
  date: string;
  startTime: string;
  status: string;
  notes?: string | null;
  serviceName?: string | null;
  servicePrice?: number | null;
}

/**
 * Combined shape required by applySyncResult. Any object that satisfies both
 * MergeableSession and BackendComparableSession can be used here — in
 * production this is SchedulerContext.Session.
 */
export type SyncableSession = MergeableSession & BackendComparableSession;

/**
 * Returns true when the backend session already reflects the local edit, meaning
 * the pending flag can be safely cleared without waiting for an explicit ack.
 *
 * Optional fields use empty-string / zero defaults so that undefined and null
 * are treated equivalently on both sides.
 */
export function sessionMatchesBackend(
  local: BackendComparableSession,
  api: BackendComparableSession
): boolean {
  return (
    local.clientName === api.clientName &&
    local.clientPhone === api.clientPhone &&
    (local.clientEmail ?? "") === (api.clientEmail ?? "") &&
    local.date === api.date &&
    local.startTime === api.startTime &&
    local.status === api.status &&
    (local.notes ?? "") === (api.notes ?? "") &&
    (local.serviceName ?? "") === (api.serviceName ?? "") &&
    (local.servicePrice ?? 0) === (api.servicePrice ?? 0)
  );
}

/**
 * Pure function that encapsulates the full sync decision logic from
 * syncWithBackend: auto-clear detection and session merge.
 *
 * Call this with the API response and the current local state; apply the
 * returned side-effects (clear IDs, update session list) yourself.
 *
 * @param fromApi          Sessions received from the backend (already mapped to
 *                         local shape via apiSessionToLocal).
 * @param currentSessions  Sessions currently held in local state / refs.
 * @param pendingIds       Set of session IDs with unsynchronised local edits.
 * @returns clearedIds     IDs whose pending flag should be removed because the
 *                         backend already reflects the local edit.
 * @returns nextSessions   The merged session list to commit to state/storage.
 */
export function applySyncResult<T extends SyncableSession>(
  fromApi: T[],
  currentSessions: T[],
  pendingIds: Set<string>
): { clearedIds: string[]; nextSessions: T[] } {
  const clearedIds: string[] = [];

  for (const apiSession of fromApi) {
    if (!pendingIds.has(apiSession.id)) continue;
    const local = currentSessions.find((s) => s.id === apiSession.id);
    if (!local) continue;
    if (sessionMatchesBackend(local, apiSession)) {
      clearedIds.push(apiSession.id);
    }
  }

  const effectivePendingIds = new Set(
    [...pendingIds].filter((id) => !clearedIds.includes(id))
  );

  const nextSessions = mergeSessions(fromApi, currentSessions, effectivePendingIds);

  return { clearedIds, nextSessions };
}

/**
 * Merges API sessions with local sessions, preserving local pending edits.
 *
 * Rules:
 * - Sessions NOT in pendingIds → use the API version as source of truth.
 * - Sessions IN pendingIds → keep the local version, but pick up any
 *   server-assigned fields (cancellationToken, waiverId) that are still null
 *   locally. This is what makes booking links appear after the first post-deploy
 *   sync: the server assigns cancellationToken; the local copy starts as null.
 *
 * @param fromApi   Sessions returned by the backend.
 * @param prev      Current sessions held in local state / AsyncStorage.
 * @param pendingIds Set of session IDs that have unsynchronised local edits.
 */
export function mergeSessions<T extends MergeableSession>(
  fromApi: T[],
  prev: T[],
  pendingIds: Set<string>
): T[] {
  const merged = fromApi.map((apiSession) => {
    if (pendingIds.has(apiSession.id)) {
      const local = prev.find((s) => s.id === apiSession.id);
      if (!local) return apiSession;
      return {
        ...local,
        cancellationToken: local.cancellationToken ?? apiSession.cancellationToken,
        waiverId: local.waiverId ?? apiSession.waiverId,
      };
    }
    return apiSession;
  });

  const localOnlyPending = prev.filter(
    (s) => pendingIds.has(s.id) && !fromApi.some((a) => a.id === s.id)
  );

  return [...merged, ...localOnlyPending];
}
