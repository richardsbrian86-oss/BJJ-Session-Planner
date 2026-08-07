import * as Calendar from "expo-calendar";
import { Platform } from "react-native";

const CALENDAR_TITLE = "Let's Roll";

async function getOrCreateAppCalendar(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== "granted") return null;

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const existing = calendars.find(
      (c) => c.title === CALENDAR_TITLE && c.allowsModifications
    );
    if (existing) return existing.id;

    if (Platform.OS === "ios") {
      const defaultCal = await Calendar.getDefaultCalendarAsync();
      return await Calendar.createCalendarAsync({
        title: CALENDAR_TITLE,
        color: "#E8253D",
        entityType: Calendar.EntityTypes.EVENT,
        sourceId: defaultCal.source.id,
        source: defaultCal.source,
        name: "letsroll-bjj",
        ownerAccount: "personal",
        accessLevel: Calendar.CalendarAccessLevel.OWNER,
      });
    } else {
      return await Calendar.createCalendarAsync({
        title: CALENDAR_TITLE,
        color: "#E8253D",
        entityType: Calendar.EntityTypes.EVENT,
        source: { isLocalAccount: true, name: CALENDAR_TITLE },
        name: "letsroll-bjj",
        ownerAccount: "personal",
        accessLevel: Calendar.CalendarAccessLevel.OWNER,
      });
    }
  } catch {
    return null;
  }
}

function buildEventDates(
  dateStr: string,
  startTime: string,
  endTime: string
): { startDate: Date; endDate: Date } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return {
    startDate: new Date(y, m - 1, d, sh, sm),
    endDate: new Date(y, m - 1, d, eh, em),
  };
}

export async function createCalendarEvent(
  clientName: string,
  dateStr: string,
  startTime: string,
  endTime: string,
  serviceName?: string,
  notes?: string
): Promise<string | null> {
  try {
    const calendarId = await getOrCreateAppCalendar();
    if (!calendarId) return null;
    const { startDate, endDate } = buildEventDates(dateStr, startTime, endTime);
    const title = serviceName
      ? `BJJ – ${clientName} (${serviceName})`
      : `BJJ Session – ${clientName}`;
    const eventNotes = [serviceName && `Service: ${serviceName}`, notes]
      .filter(Boolean)
      .join("\n");
    return await Calendar.createEventAsync(calendarId, {
      title,
      startDate,
      endDate,
      notes: eventNotes || undefined,
      alarms: [{ relativeOffset: -60 }, { relativeOffset: -1440 }],
    });
  } catch {
    return null;
  }
}

export async function updateCalendarEvent(
  eventId: string,
  clientName: string,
  dateStr: string,
  startTime: string,
  endTime: string,
  status: string,
  serviceName?: string,
  notes?: string
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const { startDate, endDate } = buildEventDates(dateStr, startTime, endTime);
    const statusTag =
      status === "confirmed" ? " ✓" : status === "cancelled" ? " ✗" : "";
    const title = serviceName
      ? `BJJ – ${clientName} (${serviceName})${statusTag}`
      : `BJJ Session – ${clientName}${statusTag}`;
    const eventNotes = [serviceName && `Service: ${serviceName}`, notes]
      .filter(Boolean)
      .join("\n");
    await Calendar.updateEventAsync(eventId, {
      title,
      startDate,
      endDate,
      notes: eventNotes || undefined,
    });
  } catch {
    // silently ignore
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Calendar.deleteEventAsync(eventId);
  } catch {
    // silently ignore
  }
}
