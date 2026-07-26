import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert, AppState, AppStateStatus } from "react-native";

import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from "@/utils/calendarService";
import { api, ApiSession } from "@/utils/apiClient";
import { applySyncResult } from "@/utils/syncMerge";
import { loadToken } from "@/utils/apiClient";
import { useAuth } from "@/context/AuthContext";

export interface TimeSlot {
  startTime: string;
  endTime: string;
}

export interface DayAvailability {
  day: number;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export interface Availability {
  days: DayAvailability[];
  sessionDurationMinutes: number;
}

export type SessionStatus = "pending" | "confirmed" | "cancelled" | "completed";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface RescheduledFrom {
  date: string;
  startTime: string;
  endTime: string;
}

export interface Session {
  id: string;
  backendId?: number;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  date: string;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  notes?: string;
  createdAt: string;
  rescheduledFrom?: RescheduledFrom;
  serviceName?: string;
  servicePrice?: number;
  packageCount?: number;
  packageTotal?: number;
  calendarEventId?: string;
  paymentStatus?: PaymentStatus;
  cancellationToken?: string | null;
  waiverId?: number | null;
  isClientBooked?: boolean;
}

type FailedOp =
  | { type: "status"; sessionId: string; backendId: number; status: SessionStatus; retryCount?: number }
  | { type: "reschedule"; sessionId: string; backendId: number; date: string; time: string; retryCount?: number }
  | { type: "update"; sessionId: string; backendId: number; updates: Record<string, unknown>; retryCount?: number };

interface SchedulerContextType {
  availability: Availability;
  sessions: Session[];
  isLoading: boolean;
  isOffline: boolean;
  pendingSessionIds: Set<string>;
  permanentlyFailedCount: number;
  clearPermanentlyFailed: () => void;
  updateAvailability: (availability: Availability) => Promise<void>;
  addSession: (session: Omit<Session, "id" | "createdAt" | "calendarEventId">) => Promise<void>;
  updateSessionStatus: (id: string, status: SessionStatus) => Promise<void>;
  updateSession: (id: string, updates: Partial<Session>) => Promise<void>;
  rescheduleSession: (
    id: string,
    newDate: string,
    newStart: string,
    newEnd: string
  ) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  getAvailableSlotsForDate: (date: string, excludeSessionId?: string) => TimeSlot[];
  syncWithBackend: () => Promise<void>;
}

const DEFAULT_AVAILABILITY: Availability = {
  sessionDurationMinutes: 60,
  days: [
    { day: 0, enabled: false, startTime: "09:00", endTime: "17:00" },
    { day: 1, enabled: true, startTime: "09:00", endTime: "18:00" },
    { day: 2, enabled: false, startTime: "09:00", endTime: "17:00" },
    { day: 3, enabled: true, startTime: "09:00", endTime: "18:00" },
    { day: 4, enabled: false, startTime: "09:00", endTime: "17:00" },
    { day: 5, enabled: true, startTime: "09:00", endTime: "18:00" },
    { day: 6, enabled: false, startTime: "09:00", endTime: "17:00" },
  ],
};

const AVAILABILITY_KEY = "@bjj_availability";
const SESSIONS_KEY = "@bjj_sessions";
const FAILED_OPS_KEY = "@bjj_failed_ops";
const PENDING_EDITS_KEY = "@bjj_pending_edits";
const PERM_FAILED_COUNT_KEY = "@bjj_perm_failed_count";
const POLL_INTERVAL_MS = 30_000;
const MAX_RETRY_COUNT = 5;

const SchedulerContext = createContext<SchedulerContextType | null>(null);

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function generateSlots(
  dayAvail: DayAvailability,
  durationMins: number,
  bookedSessions: Session[],
  date: string,
  excludeSessionId?: string
): TimeSlot[] {
  const startMin = timeToMinutes(dayAvail.startTime);
  const endMin = timeToMinutes(dayAvail.endTime);
  const slots: TimeSlot[] = [];

  const relevantSessions = bookedSessions.filter(
    (sess) =>
      sess.id !== excludeSessionId &&
      sess.date === date &&
      sess.status !== "cancelled"
  );

  for (let t = startMin; t + durationMins <= endMin; t += durationMins) {
    const slotStart = t;
    const slotEnd = t + durationMins;
    const overlaps = relevantSessions.some((sess) => {
      const sessStart = timeToMinutes(sess.startTime);
      const sessEnd = timeToMinutes(sess.endTime);
      return slotStart < sessEnd && slotEnd > sessStart;
    });
    if (!overlaps) {
      slots.push({
        startTime: minutesToTime(slotStart),
        endTime: minutesToTime(slotEnd),
      });
    }
  }

  return slots;
}

function mapApiStatusToLocal(status: ApiSession["status"]): SessionStatus {
  switch (status) {
    case "scheduled": return "confirmed";
    case "completed": return "completed";
    case "cancelled": return "cancelled";
    case "no_show": return "cancelled";
  }
}

function mapLocalStatusToApi(status: SessionStatus): ApiSession["status"] {
  switch (status) {
    case "pending": return "scheduled";
    case "confirmed": return "scheduled";
    case "completed": return "completed";
    case "cancelled": return "cancelled";
  }
}

function apiSessionToLocal(s: ApiSession, durationMins: number): Session {
  const endMin = timeToMinutes(s.time) + durationMins;
  return {
    id: `b-${s.id}`,
    backendId: s.id,
    clientName: s.clientName,
    clientPhone: s.clientPhone ?? "",
    clientEmail: s.clientEmail ?? undefined,
    date: s.date,
    startTime: s.time,
    endTime: minutesToTime(endMin),
    status: mapApiStatusToLocal(s.status),
    notes: s.notes ?? undefined,
    createdAt: s.createdAt,
    serviceName: s.serviceName,
    servicePrice: s.servicePrice,
    packageCount: s.packageCount ?? undefined,
    packageTotal: s.packageTotal ?? undefined,
    paymentStatus: s.paymentStatus,
    cancellationToken: s.cancellationToken ?? null,
    waiverId: s.waiverId ?? null,
    isClientBooked: (s.waiverId ?? null) !== null,
  };
}

async function loadFailedOps(): Promise<FailedOp[]> {
  try {
    const raw = await AsyncStorage.getItem(FAILED_OPS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FailedOp[];
  } catch {
    return [];
  }
}

async function saveFailedOps(ops: FailedOp[]): Promise<void> {
  try {
    await AsyncStorage.setItem(FAILED_OPS_KEY, JSON.stringify(ops));
  } catch {
  }
}

async function enqueueFailedOp(op: FailedOp): Promise<void> {
  const current = await loadFailedOps();
  const filtered = current.filter(
    (o) => !(o.sessionId === op.sessionId && o.type === op.type)
  );
  await saveFailedOps([...filtered, op]);
}

async function dequeueFailedOp(sessionId: string, type: FailedOp["type"]): Promise<void> {
  const current = await loadFailedOps();
  await saveFailedOps(current.filter((o) => !(o.sessionId === sessionId && o.type === type)));
}

export function SchedulerProvider({ children }: { children: ReactNode }) {
  const [availability, setAvailability] = useState<Availability>(DEFAULT_AVAILABILITY);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingSessionIds, setPendingSessionIds] = useState<Set<string>>(new Set());
  const [permanentlyFailedCount, setPermanentlyFailedCount] = useState(0);
  const { instructorId } = useAuth();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(DEFAULT_AVAILABILITY.sessionDurationMinutes);
  const availabilityRef = useRef<Availability>(DEFAULT_AVAILABILITY);
  const prevInstructorIdRef = useRef<number | null>(null);
  const syncWithBackendRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const retryFailedOpsRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const pendingEditsRef = useRef<Set<string>>(new Set());
  const sessionsRef = useRef<Session[]>([]);
  const isOfflineRef = useRef(false);
  const isRetryingRef = useRef(false);

  const markPending = useCallback((id: string) => {
    const next = new Set(pendingEditsRef.current).add(id);
    pendingEditsRef.current = next;
    setPendingSessionIds(new Set(next));
    const serialized = JSON.stringify(Array.from(next));
    AsyncStorage.setItem(PENDING_EDITS_KEY, serialized).catch(() => {});
    console.log("[SchedulerContext] pendingEdits saved:", Array.from(next));
  }, []);

  const unmarkPending = useCallback((id: string) => {
    const next = new Set(pendingEditsRef.current);
    next.delete(id);
    pendingEditsRef.current = next;
    setPendingSessionIds(new Set(next));
    const serialized = JSON.stringify(Array.from(next));
    AsyncStorage.setItem(PENDING_EDITS_KEY, serialized).catch(() => {});
    console.log("[SchedulerContext] pendingEdits saved (after unmark):", Array.from(next));
  }, []);

  const persist = useCallback((next: Session[]) => {
    AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(next));
  }, []);

  const clearPermanentlyFailed = useCallback(() => {
    setPermanentlyFailedCount(0);
    AsyncStorage.removeItem(PERM_FAILED_COUNT_KEY).catch(() => {});
  }, []);

  const retryFailedOps = useCallback(async () => {
    if (isRetryingRef.current) return;
    const token = await loadToken();
    if (!token) return;

    const ops = await loadFailedOps();
    if (ops.length === 0) return;

    isRetryingRef.current = true;
    let succeeded = 0;
    let newlyPermanent = 0;
    const remaining: FailedOp[] = [];

    for (const op of ops) {
      try {
        if (op.type === "status") {
          await api.sessions.update(op.backendId, { status: mapLocalStatusToApi(op.status) });
        } else if (op.type === "reschedule") {
          await api.sessions.update(op.backendId, { date: op.date, time: op.time });
        } else if (op.type === "update") {
          await api.sessions.update(op.backendId, op.updates);
        }
        unmarkPending(op.sessionId);
        succeeded++;
      } catch {
        const newCount = (op.retryCount ?? 0) + 1;
        if (newCount >= MAX_RETRY_COUNT) {
          unmarkPending(op.sessionId);
          newlyPermanent++;
        } else {
          remaining.push({ ...op, retryCount: newCount });
        }
      }
    }

    await saveFailedOps(remaining);

    if (newlyPermanent > 0) {
      setPermanentlyFailedCount((prev) => {
        const next = prev + newlyPermanent;
        AsyncStorage.setItem(PERM_FAILED_COUNT_KEY, String(next)).catch(() => {});
        return next;
      });
    }

    isRetryingRef.current = false;

    if (succeeded > 0 && remaining.length === 0 && newlyPermanent === 0) {
      Alert.alert(
        "Synced",
        succeeded === 1
          ? "1 pending change was successfully saved to the server."
          : `${succeeded} pending changes were successfully saved to the server.`,
        [{ text: "OK" }]
      );
    }
  }, [unmarkPending]);

  const syncWithBackend = useCallback(async () => {
    const token = await loadToken();
    if (!token) return;

    try {
      const [apiSessions, apiAvail] = await Promise.all([
        api.sessions.list(),
        api.availability.get(),
      ]);

      let duration = durationRef.current;
      if (apiAvail.length > 0) {
        duration = apiAvail[0].sessionDurationMinutes;
        durationRef.current = duration;
      }

      if (apiAvail.length > 0) {
        const newAvail: Availability = {
          sessionDurationMinutes: apiAvail[0].sessionDurationMinutes,
          days: [0, 1, 2, 3, 4, 5, 6].map((day) => {
            const found = apiAvail.find((a) => a.day === String(day));
            return found
              ? {
                  day,
                  enabled: found.enabled,
                  startTime: found.startTime,
                  endTime: found.endTime,
                }
              : { day, enabled: false, startTime: "09:00", endTime: "17:00" };
          }),
        };
        setAvailability(newAvail);
        availabilityRef.current = newAvail;
        durationRef.current = newAvail.sessionDurationMinutes;
        await AsyncStorage.setItem(AVAILABILITY_KEY, JSON.stringify(newAvail));
      } else {
        const localAvail = availabilityRef.current;
        try {
          await api.availability.set(
            localAvail.days.map((d) => ({
              day: String(d.day),
              enabled: d.enabled,
              startTime: d.startTime,
              endTime: d.endTime,
              sessionDurationMinutes: localAvail.sessionDurationMinutes,
            }))
          );
        } catch {}
      }

      const fromApi = apiSessions.map((s) => apiSessionToLocal(s, duration));

      const { clearedIds, nextSessions } = applySyncResult(
        fromApi,
        sessionsRef.current,
        pendingEditsRef.current
      );

      for (const id of clearedIds) {
        console.log("[SchedulerContext] backend already reflects local edit for", id, "— clearing pending");
        unmarkPending(id);
      }

      setSessions(() => {
        persist(nextSessions);
        return nextSessions;
      });

      const wasOffline = isOfflineRef.current;
      isOfflineRef.current = false;
      setIsOffline(false);

      if (wasOffline) {
        retryFailedOpsRef.current();
      }
    } catch {
      isOfflineRef.current = true;
      setIsOffline(true);
    }
  }, [persist, unmarkPending]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    syncWithBackendRef.current = syncWithBackend;
  }, [syncWithBackend]);

  useEffect(() => {
    retryFailedOpsRef.current = retryFailedOps;
  }, [retryFailedOps]);

  useEffect(() => {
    if (instructorId !== null && prevInstructorIdRef.current === null) {
      syncWithBackendRef.current();
    }
    prevInstructorIdRef.current = instructorId;
  }, [instructorId]);

  useEffect(() => {
    (async () => {
      try {
        const [availStr, sessStr, pendingStr] = await Promise.all([
          AsyncStorage.getItem(AVAILABILITY_KEY),
          AsyncStorage.getItem(SESSIONS_KEY),
          AsyncStorage.getItem(PENDING_EDITS_KEY),
        ]);
        if (availStr) {
          const parsed = JSON.parse(availStr) as Availability;
          setAvailability(parsed);
          availabilityRef.current = parsed;
          durationRef.current = parsed.sessionDurationMinutes;
        }
        if (sessStr) setSessions(JSON.parse(sessStr));
        if (pendingStr) {
          const raw = JSON.parse(pendingStr);
          const ids: string[] = Array.isArray(raw)
            ? raw.filter((v): v is string => typeof v === "string")
            : [];
          if (ids.length > 0) {
            const restoredSet = new Set(ids);
            pendingEditsRef.current = restoredSet;
            setPendingSessionIds(new Set(restoredSet));
            console.log("[SchedulerContext] pendingEdits loaded from storage:", ids);
          }
        }
        const permStr = await AsyncStorage.getItem(PERM_FAILED_COUNT_KEY);
        if (permStr) {
          const n = parseInt(permStr, 10);
          if (!isNaN(n) && n > 0) setPermanentlyFailedCount(n);
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
      await syncWithBackend();
    })();
  }, []);

  useEffect(() => {
    pollRef.current = setInterval(() => {
      syncWithBackendRef.current();
    }, POLL_INTERVAL_MS);

    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        syncWithBackendRef.current().then(() => {
          if (!isOfflineRef.current) {
            retryFailedOpsRef.current();
          }
        });
      }
    });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      sub.remove();
    };
  }, []);

  const updateAvailability = useCallback(async (next: Availability) => {
    setAvailability(next);
    availabilityRef.current = next;
    await AsyncStorage.setItem(AVAILABILITY_KEY, JSON.stringify(next));

    const token = await loadToken();
    if (token) {
      try {
        await api.availability.set(
          next.days.map((d) => ({
            day: String(d.day),
            enabled: d.enabled,
            startTime: d.startTime,
            endTime: d.endTime,
            sessionDurationMinutes: next.sessionDurationMinutes,
          }))
        );
      } catch {
      }
    }
  }, []);

  const addSession = useCallback(
    async (session: Omit<Session, "id" | "createdAt" | "calendarEventId">) => {
      const localId = generateId();
      const calendarEventId = await createCalendarEvent(
        session.clientName,
        session.date,
        session.startTime,
        session.endTime,
        session.serviceName,
        session.notes
      );
      const newSession: Session = {
        ...session,
        id: localId,
        createdAt: new Date().toISOString(),
        calendarEventId: calendarEventId ?? undefined,
      };

      markPending(localId);
      setSessions((prev) => {
        const next = [...prev, newSession];
        persist(next);
        return next;
      });

      const token = await loadToken();
      if (token) {
        try {
          await api.sessions.create({
            clientName: session.clientName,
            clientEmail: session.clientEmail,
            clientPhone: session.clientPhone,
            date: session.date,
            time: session.startTime,
            serviceName: session.serviceName ?? "Session",
            servicePrice: session.servicePrice,
            packageCount: session.packageCount,
            packageTotal: session.packageTotal,
            notes: session.notes,
          });
          setSessions((prev) => {
            const next = prev.filter((s) => s.id !== localId);
            persist(next);
            return next;
          });
          unmarkPending(localId);
          await syncWithBackend();
        } catch {
        }
      }
    },
    [persist, syncWithBackend, markPending, unmarkPending]
  );

  const updateSessionStatus = useCallback(
    async (id: string, status: SessionStatus) => {
      markPending(id);
      setSessions((prev) => {
        const next = prev.map((s) => {
          if (s.id !== id) return s;
          if (s.calendarEventId) {
            if (status === "cancelled") {
              deleteCalendarEvent(s.calendarEventId);
            } else {
              updateCalendarEvent(
                s.calendarEventId,
                s.clientName,
                s.date,
                s.startTime,
                s.endTime,
                status,
                s.serviceName,
                s.notes
              );
            }
          }
          return { ...s, status };
        });
        persist(next);
        return next;
      });

      const session = sessions.find((s) => s.id === id);
      if (session?.backendId) {
        try {
          await api.sessions.update(session.backendId, {
            status: mapLocalStatusToApi(status),
          });
          unmarkPending(id);
        } catch (err) {
          console.warn("[SchedulerContext] updateSessionStatus sync failed, queuing for retry:", err);
          await enqueueFailedOp({ type: "status", sessionId: id, backendId: session.backendId, status });
        }
      }
    },
    [persist, sessions, markPending, unmarkPending]
  );

  const updateSession = useCallback(
    async (id: string, updates: Partial<Session>) => {
      markPending(id);
      setSessions((prev) => {
        const next = prev.map((s) => (s.id === id ? { ...s, ...updates } : s));
        persist(next);
        return next;
      });

      const session = sessions.find((s) => s.id === id);
      if (session?.backendId) {
        try {
          const apiUpdates: Record<string, unknown> = {};
          if (updates.status !== undefined) apiUpdates.status = mapLocalStatusToApi(updates.status);
          if (updates.notes !== undefined) apiUpdates.notes = updates.notes;
          if (updates.date !== undefined) apiUpdates.date = updates.date;
          if (updates.startTime !== undefined) apiUpdates.time = updates.startTime;
          if (updates.clientName !== undefined) apiUpdates.clientName = updates.clientName;
          if (updates.clientPhone !== undefined) apiUpdates.clientPhone = updates.clientPhone;
          if (updates.clientEmail !== undefined) apiUpdates.clientEmail = updates.clientEmail;
          if (updates.serviceName !== undefined) apiUpdates.serviceName = updates.serviceName;
          if (updates.servicePrice !== undefined) apiUpdates.servicePrice = updates.servicePrice;
          if (Object.keys(apiUpdates).length > 0) {
            await api.sessions.update(session.backendId, apiUpdates);
          }
          unmarkPending(id);
        } catch (err) {
          console.warn("[SchedulerContext] updateSession sync failed, queuing for retry:", err);
          const apiUpdates: Record<string, unknown> = {};
          if (updates.status !== undefined) apiUpdates.status = mapLocalStatusToApi(updates.status);
          if (updates.notes !== undefined) apiUpdates.notes = updates.notes;
          if (updates.date !== undefined) apiUpdates.date = updates.date;
          if (updates.startTime !== undefined) apiUpdates.time = updates.startTime;
          if (updates.clientName !== undefined) apiUpdates.clientName = updates.clientName;
          if (updates.clientPhone !== undefined) apiUpdates.clientPhone = updates.clientPhone;
          if (updates.clientEmail !== undefined) apiUpdates.clientEmail = updates.clientEmail;
          if (updates.serviceName !== undefined) apiUpdates.serviceName = updates.serviceName;
          if (updates.servicePrice !== undefined) apiUpdates.servicePrice = updates.servicePrice;
          if (Object.keys(apiUpdates).length > 0) {
            await enqueueFailedOp({ type: "update", sessionId: id, backendId: session.backendId, updates: apiUpdates });
          }
          throw err;
        }
      }
    },
    [persist, sessions, markPending, unmarkPending]
  );

  const rescheduleSession = useCallback(
    async (id: string, newDate: string, newStart: string, newEnd: string) => {
      markPending(id);
      setSessions((prev) => {
        const next = prev.map((s) => {
          if (s.id !== id) return s;
          const rescheduledFrom: RescheduledFrom =
            s.rescheduledFrom ?? { date: s.date, startTime: s.startTime, endTime: s.endTime };
          if (s.calendarEventId) {
            updateCalendarEvent(
              s.calendarEventId,
              s.clientName,
              newDate,
              newStart,
              newEnd,
              s.status === "cancelled" ? "pending" : s.status,
              s.serviceName,
              s.notes
            );
          }
          return {
            ...s,
            date: newDate,
            startTime: newStart,
            endTime: newEnd,
            rescheduledFrom,
            status: s.status === "cancelled" ? "pending" : s.status,
          };
        });
        persist(next);
        return next;
      });

      const session = sessions.find((s) => s.id === id);
      if (session?.backendId) {
        try {
          await api.sessions.update(session.backendId, {
            date: newDate,
            time: newStart,
          });
          unmarkPending(id);
        } catch (err) {
          console.warn("[SchedulerContext] rescheduleSession sync failed, queuing for retry:", err);
          await enqueueFailedOp({ type: "reschedule", sessionId: id, backendId: session.backendId, date: newDate, time: newStart });
        }
      }
    },
    [persist, sessions, markPending, unmarkPending]
  );

  const deleteSession = useCallback(
    async (id: string) => {
      const session = sessions.find((s) => s.id === id);
      if (session?.calendarEventId) {
        deleteCalendarEvent(session.calendarEventId);
      }
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        persist(next);
        return next;
      });

      if (session?.backendId) {
        try {
          await api.sessions.delete(session.backendId);
        } catch {
        }
      }
    },
    [persist, sessions]
  );

  const getAvailableSlotsForDate = useCallback(
    (date: string, excludeSessionId?: string): TimeSlot[] => {
      const [y, m, d] = date.split("-").map(Number);
      const dayOfWeek = new Date(y, m - 1, d).getDay();
      const dayAvail = availability.days.find((da) => da.day === dayOfWeek);
      if (!dayAvail || !dayAvail.enabled) return [];
      return generateSlots(
        dayAvail,
        availability.sessionDurationMinutes,
        sessions,
        date,
        excludeSessionId
      );
    },
    [availability, sessions]
  );

  return (
    <SchedulerContext.Provider
      value={{
        availability,
        sessions,
        isLoading,
        isOffline,
        pendingSessionIds,
        permanentlyFailedCount,
        clearPermanentlyFailed,
        updateAvailability,
        addSession,
        updateSessionStatus,
        updateSession,
        rescheduleSession,
        deleteSession,
        getAvailableSlotsForDate,
        syncWithBackend,
      }}
    >
      {children}
    </SchedulerContext.Provider>
  );
}

export function useScheduler(): SchedulerContextType {
  const ctx = useContext(SchedulerContext);
  if (!ctx) throw new Error("useScheduler must be used within SchedulerProvider");
  return ctx;
}
