---
name: localstorage-to-sessionstorage-migration
description: Migrate a React auth context from localStorage to sessionStorage without logging out existing users. Use when moving token storage to be more secure (sessionStorage clears on tab close, reducing XSS exposure window). Covers the one-time migration pattern, try/catch for private browsing, and the login/logout storage update.
---

# localStorage → sessionStorage Migration Pattern

## Why sessionStorage over localStorage for auth tokens

- `localStorage` persists indefinitely across browser sessions — a stolen XSS token stays valid until the server invalidates it
- `sessionStorage` is cleared when the tab closes — limits the XSS exposure window to the active session
- Tradeoff: users must log in again after closing the browser tab (usually acceptable for security-sensitive apps)

## The migration problem

A naive swap (`s/localStorage/sessionStorage/g`) logs out every existing user on deploy because:
1. Their token is in `localStorage` under the old key
2. The new code reads from `sessionStorage`, finds nothing, treats them as logged out

## Fix: one-time migration on mount

Run this **before** reading from sessionStorage. It moves the existing credential into the new location and clears the old one:

```typescript
useEffect(() => {
  // Step 1: one-time migration
  try {
    const lsToken = localStorage.getItem(TOKEN_KEY);
    const lsClient = localStorage.getItem(CLIENT_KEY);
    if (lsToken && lsClient) {
      sessionStorage.setItem(TOKEN_KEY, lsToken);
      sessionStorage.setItem(CLIENT_KEY, lsClient);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(CLIENT_KEY);
    }
  } catch {
    // storage may be blocked in strict private browsing modes
  }

  // Step 2: read session as normal
  try {
    const savedToken = sessionStorage.getItem(TOKEN_KEY);
    const savedClient = sessionStorage.getItem(CLIENT_KEY);
    if (savedToken && savedClient) {
      try {
        setToken(savedToken);
        setClient(JSON.parse(savedClient));
      } catch {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(CLIENT_KEY);
      }
    }
  } catch {
    // sessionStorage blocked
  }

  setIsLoading(false);
}, []);
```

## Update login and logout functions

```typescript
const login = useCallback((newToken: string, newClient: ClientUser) => {
  try {
    sessionStorage.setItem(TOKEN_KEY, newToken);
    sessionStorage.setItem(CLIENT_KEY, JSON.stringify(newClient));
  } catch {
    // blocked — state still set in memory for this session
  }
  setToken(newToken);
  setClient(newClient);
}, []);

const logout = useCallback(() => {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(CLIENT_KEY);
  } catch {
    // blocked
  }
  setToken(null);
  setClient(null);
}, []);
```

## Why wrap every storage call in try/catch

Browsers in strict private mode (Firefox private + Enhanced Tracking Protection, Safari ITP) can throw on **any** storage access — including `getItem`. Without the try/catch the app crashes on page load for those users.

## The migration is idempotent

Running the migration a second time (e.g. on a page refresh after the first run) finds nothing in localStorage and does nothing. Safe to leave in place permanently.

## Reference implementation

`artifacts/client-portal/src/lib/client-auth.tsx` — full working implementation
