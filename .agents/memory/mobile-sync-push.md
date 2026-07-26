---
name: Mobile sync push-on-empty
description: ServicesContext and SchedulerContext must push local data to the backend when the API returns empty results (first sync after migration), not overwrite local with the empty response.
---

The mobile app uses a local-first architecture. On first backend sync after instructor migration, the API returns 0 services and 0 availability rows because the account was just created. The original code treated this as "backend is source of truth" and overwrote local data — wiping the instructor's default services and clearing their availability schedule.

**Why this matters:** The web portal can only show what's in the backend. If local data is never pushed up, the instructor's booking page has no services to select and no available time slots, making them unbookable.

**Fix pattern (ServicesContext):**
```typescript
if (apiServices.length > 0) {
  persist(apiServices.map(apiServiceToLocal)); // backend wins
} else {
  // push unsynced local services up
  const localUnsynced = servicesRef.current.filter(s => !s.backendId);
  for (const svc of localUnsynced) {
    const created = await api.services.create(svc.name, svc.price);
    // update local record with new backendId
  }
}
```

**Fix pattern (SchedulerContext availability):**
Instead of resetting to all-disabled when backend returns empty, push local availability to the backend:
```typescript
} else {
  await api.availability.set(availabilityRef.current.days.map(...));
}
```

**Re-sync on migration:** Both contexts use `useEffect` watching `instructorId` — when it transitions from `null` to a number (migration just completed), trigger `syncWithBackend()` immediately so data gets pushed.

**How to apply:** Any context that syncs between local AsyncStorage and the backend should use this push-on-empty pattern, not overwrite-local-with-empty. Use `useRef` to track current local state inside async callbacks to avoid stale closure issues.
