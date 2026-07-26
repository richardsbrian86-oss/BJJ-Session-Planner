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

import { api, saveToken, loadToken, clearToken, ApiError } from "@/utils/apiClient";
import { secureGet, secureSet, secureDelete } from "@/utils/secureStorage";

const PIN_KEY = "bjj_pin";
const TOKEN_KEY_LEGACY = "@bjj_instructor_token";
const PIN_KEY_LEGACY = "@bjj_pin";
const NAME_KEY = "@bjj_instructor_name";
const INSTRUCTOR_ID_KEY = "@bjj_instructor_id";
const INSTRUCTOR_SLUG_KEY = "@bjj_instructor_slug";
const INSTRUCTOR_EMAIL_KEY = "@bjj_instructor_email";
const APP_MODE_KEY = "@bjj_app_mode";
const AUTH_METHOD_KEY = "@bjj_auth_method";

export type AppMode = "instructor" | "client" | null;
export type AuthMethod = "pin" | "email" | null;

const MIN_PIN_LENGTH = 6;

interface AuthContextType {
  isLoading: boolean;
  isSetup: boolean;
  isAuthenticated: boolean;
  isPinUpgradeRequired: boolean;
  storedPinLength: number | null;
  instructorName: string;
  instructorId: number | null;
  instructorSlug: string | null;
  instructorEmail: string | null;
  authMethod: AuthMethod;
  appMode: AppMode;
  hasPendingMigration: boolean;
  setAppMode: (mode: AppMode) => Promise<void>;
  setupInstructor: (name: string, pin: string) => Promise<void>;
  setupInstructorEmail: (name: string, email: string, password: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<{ ok: boolean; reason?: "wrong_pin" | "rate_limited" | "blocked" | "offline" }>;
  upgradePin: (newPin: string) => Promise<void>;
  lock: () => void;
  migrateToBackend: (pin: string) => Promise<boolean>;
  retryMigration: () => Promise<boolean>;
  switchToEmailLogin: () => Promise<void>;
  resetAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSetup, setIsSetup] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPinUpgradeRequired, setIsPinUpgradeRequired] = useState(false);
  const [instructorName, setInstructorName] = useState("");
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [instructorId, setInstructorId] = useState<number | null>(null);
  const [instructorSlug, setInstructorSlug] = useState<string | null>(null);
  const [instructorEmail, setInstructorEmail] = useState<string | null>(null);
  const [authMethod, setAuthMethodState] = useState<AuthMethod>(null);
  const [appMode, setAppModeState] = useState<AppMode>(null);
  const sessionPinRef = useRef<string | null>(null);

  const hasPendingMigration = isSetup && instructorId === null;

  useEffect(() => {
    (async () => {
      try {
        // One-time migration: move legacy plaintext credentials from AsyncStorage
        // into OS-protected secure storage and purge the originals.
        const [legacyPin, legacyToken] = await Promise.all([
          AsyncStorage.getItem(PIN_KEY_LEGACY),
          AsyncStorage.getItem(TOKEN_KEY_LEGACY),
        ]);
        const migrateOps: Promise<unknown>[] = [];
        if (legacyPin !== null) {
          migrateOps.push(secureSet(PIN_KEY, legacyPin));
        }
        if (legacyToken !== null) {
          migrateOps.push(saveToken(legacyToken));
        }
        await Promise.all(migrateOps);
        // Always remove the legacy keys, even if SecureStore write failed,
        // to ensure replayable credentials are not left in plaintext storage.
        await Promise.all([
          AsyncStorage.removeItem(PIN_KEY_LEGACY),
          AsyncStorage.removeItem(TOKEN_KEY_LEGACY),
        ]);

        const [pin, name, id, slug, mode, email, method] = await Promise.all([
          secureGet(PIN_KEY),
          AsyncStorage.getItem(NAME_KEY),
          AsyncStorage.getItem(INSTRUCTOR_ID_KEY),
          AsyncStorage.getItem(INSTRUCTOR_SLUG_KEY),
          AsyncStorage.getItem(APP_MODE_KEY),
          AsyncStorage.getItem(INSTRUCTOR_EMAIL_KEY),
          AsyncStorage.getItem(AUTH_METHOD_KEY),
        ]);
        await loadToken();

        if (email && (method === "email")) {
          setInstructorEmail(email);
          setAuthMethodState("email");
          if (name) setInstructorName(name);
          if (id) setInstructorId(parseInt(id, 10));
          if (slug) setInstructorSlug(slug);
          setIsSetup(true);
          const token = await loadToken();
          if (token) setIsAuthenticated(true);
        } else if (pin && name) {
          setStoredPin(pin);
          setInstructorName(name);
          setIsSetup(true);
          setAuthMethodState("pin");
          // Flag accounts with legacy short PINs so the upgrade screen is shown
          // after the user unlocks the device.
          if (pin.length < MIN_PIN_LENGTH) {
            setIsPinUpgradeRequired(true);
          }
        }

        if (id) setInstructorId(parseInt(id, 10));
        if (slug) setInstructorSlug(slug);
        if (mode === "instructor" || mode === "client") {
          setAppModeState(mode);
        } else if (pin && name) {
          setAppModeState("instructor");
        }

        // Eagerly validate the stored token so an expired token doesn't
        // leave the app in a permanently authenticated state.
        const storedToken = await loadToken();
        if (storedToken && id) {
          try {
            await api.instructors.verifySession();
          } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
              await clearToken();
              if (method === "email") {
                setIsAuthenticated(false);
              }
            }
            // Network errors: leave auth state unchanged (offline tolerant).
          }
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setAppMode = useCallback(async (mode: AppMode) => {
    setAppModeState(mode);
    if (mode) {
      await AsyncStorage.setItem(APP_MODE_KEY, mode);
    } else {
      await AsyncStorage.removeItem(APP_MODE_KEY);
    }
  }, []);

  const setupInstructor = useCallback(async (name: string, pin: string) => {
    await Promise.all([
      secureSet(PIN_KEY, pin),
      AsyncStorage.setItem(NAME_KEY, name),
      AsyncStorage.setItem(AUTH_METHOD_KEY, "pin"),
    ]);
    setStoredPin(pin);
    setInstructorName(name);
    setAuthMethodState("pin");
    setIsSetup(true);
    setIsAuthenticated(true);
    sessionPinRef.current = pin;
    await AsyncStorage.setItem(APP_MODE_KEY, "instructor");
    setAppModeState("instructor");

    try {
      const result = await api.instructors.register(name, pin);
      await saveToken(result.token);
      await Promise.all([
        AsyncStorage.setItem(INSTRUCTOR_ID_KEY, String(result.id)),
        AsyncStorage.setItem(INSTRUCTOR_SLUG_KEY, result.slug),
      ]);
      setInstructorId(result.id);
      setInstructorSlug(result.slug);
    } catch (err) {
      console.warn("[auth] setupInstructor: backend registration failed", err);
    }
  }, []);

  const setupInstructorEmail = useCallback(async (name: string, email: string, password: string) => {
    const result = await api.instructors.registerEmail(name, email, password);
    await saveToken(result.token);
    await Promise.all([
      AsyncStorage.setItem(NAME_KEY, name),
      AsyncStorage.setItem(INSTRUCTOR_ID_KEY, String(result.id)),
      AsyncStorage.setItem(INSTRUCTOR_SLUG_KEY, result.slug),
      AsyncStorage.setItem(INSTRUCTOR_EMAIL_KEY, email.toLowerCase().trim()),
      AsyncStorage.setItem(AUTH_METHOD_KEY, "email"),
      AsyncStorage.setItem(APP_MODE_KEY, "instructor"),
    ]);
    setInstructorName(name);
    setInstructorId(result.id);
    setInstructorSlug(result.slug);
    setInstructorEmail(email.toLowerCase().trim());
    setAuthMethodState("email");
    setAppModeState("instructor");
    setIsSetup(true);
    setIsAuthenticated(true);
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    const result = await api.instructors.loginEmail(email, password);
    await saveToken(result.token);
    await Promise.all([
      AsyncStorage.setItem(NAME_KEY, result.name),
      AsyncStorage.setItem(INSTRUCTOR_ID_KEY, String(result.id)),
      AsyncStorage.setItem(INSTRUCTOR_SLUG_KEY, result.slug),
      AsyncStorage.setItem(INSTRUCTOR_EMAIL_KEY, email.toLowerCase().trim()),
      AsyncStorage.setItem(AUTH_METHOD_KEY, "email"),
      AsyncStorage.setItem(APP_MODE_KEY, "instructor"),
    ]);
    setInstructorName(result.name);
    setInstructorId(result.id);
    setInstructorSlug(result.slug);
    setInstructorEmail(email.toLowerCase().trim());
    setAuthMethodState("email");
    setAppModeState("instructor");
    setIsSetup(true);
    setIsAuthenticated(true);
  }, []);

  const verifyPin = useCallback(
    async (pin: string): Promise<{ ok: boolean; reason?: "wrong_pin" | "rate_limited" | "blocked" | "offline" }> => {
      const currentId = await AsyncStorage.getItem(INSTRUCTOR_ID_KEY);
      const slug = await AsyncStorage.getItem(INSTRUCTOR_SLUG_KEY);

      if (currentId && slug) {
        // Backend is the source of truth — verify the PIN server-side.
        try {
          const result = await api.instructors.login(slug, pin);
          await saveToken(result.token);
          // Sync local PIN so a web-portal PIN change propagates to this device.
          await secureSet(PIN_KEY, pin);
          setStoredPin(pin);
          sessionPinRef.current = pin;
          setIsAuthenticated(true);
          if (!instructorSlug) {
            setInstructorSlug(result.slug);
            await AsyncStorage.setItem(INSTRUCTOR_SLUG_KEY, result.slug);
          }
          return { ok: true };
        } catch (err) {
          if (err instanceof ApiError) {
            if (err.status === 401) return { ok: false, reason: "wrong_pin" };
            if (err.status === 429) return { ok: false, reason: "rate_limited" };
            if (err.status === 403) return { ok: false, reason: "blocked" };
            // Other server errors — treat as offline and fall back to local.
          }
          // Network failure (no HTTP response) — fall back to local comparison
          // so the device can be unlocked while offline.
          const correct = pin === storedPin;
          if (correct) {
            setIsAuthenticated(true);
            sessionPinRef.current = pin;
          }
          return { ok: correct, reason: correct ? "offline" : "wrong_pin" };
        }
      }

      // No backend account yet — use local comparison and attempt registration.
      const correct = pin === storedPin;
      if (correct) {
        setIsAuthenticated(true);
        sessionPinRef.current = pin;
        if (instructorName) {
          try {
            const result = await api.instructors.register(instructorName, pin);
            await saveToken(result.token);
            await Promise.all([
              AsyncStorage.setItem(INSTRUCTOR_ID_KEY, String(result.id)),
              AsyncStorage.setItem(INSTRUCTOR_SLUG_KEY, result.slug),
            ]);
            setInstructorId(result.id);
            setInstructorSlug(result.slug);
          } catch (err) {
            console.warn("[auth] verifyPin: backend registration failed", err);
          }
        }
      }
      return { ok: correct, reason: correct ? undefined : "wrong_pin" };
    },
    [storedPin, instructorName, instructorSlug]
  );

  const retryMigration = useCallback(async (): Promise<boolean> => {
    const pin = sessionPinRef.current;
    if (!pin || !instructorName) return false;
    try {
      const result = await api.instructors.register(instructorName, pin);
      await saveToken(result.token);
      await Promise.all([
        AsyncStorage.setItem(INSTRUCTOR_ID_KEY, String(result.id)),
        AsyncStorage.setItem(INSTRUCTOR_SLUG_KEY, result.slug),
      ]);
      setInstructorId(result.id);
      setInstructorSlug(result.slug);
      return true;
    } catch (err) {
      console.warn("[auth] retryMigration: backend registration failed", err);
      return false;
    }
  }, [instructorName]);

  const upgradePin = useCallback(
    async (newPin: string): Promise<void> => {
      if (!storedPin) throw new Error("No current PIN stored");
      if (newPin.length < MIN_PIN_LENGTH) throw new Error(`PIN must be at least ${MIN_PIN_LENGTH} digits`);

      // If this account has been registered on the backend, the server update
      // is authoritative.  We call the authenticated /change-pin endpoint
      // (which requires a valid bearer token).  Local state is only updated
      // after the server succeeds.
      //
      // This is the only server-side upgrade path — there is no unauthenticated
      // PIN upgrade route.  An attacker who cannot obtain a token via /login
      // (which returns 428 for short PINs) has no API path to upgrade legacy
      // accounts.
      const currentId = await AsyncStorage.getItem(INSTRUCTOR_ID_KEY);
      if (currentId) {
        const token = await loadToken();
        if (token) {
          const base = (await import("@/utils/apiClient")).getApiBaseUrl();
          const res = await fetch(`${base}/api/instructors/change-pin`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ currentPin: storedPin, newPin }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error((body as { error?: string }).error ?? "PIN upgrade failed on server");
          }
        }
        // No token: account is registered but token expired.  Fall through to
        // update locally — the next authenticated request will use the new PIN
        // for any future change-pin call.
      }

      // Persist locally (either no backend account, or server update succeeded).
      await secureSet(PIN_KEY, newPin);
      setStoredPin(newPin);
      sessionPinRef.current = newPin;
      setIsPinUpgradeRequired(false);
    },
    [storedPin],
  );

  const lock = useCallback(() => {
    setIsAuthenticated(false);
  }, []);

  const switchToEmailLogin = useCallback(async () => {
    await AsyncStorage.setItem(AUTH_METHOD_KEY, "email");
    setAuthMethodState("email");
  }, []);

  const resetAccount = useCallback(async () => {
    await Promise.all([
      secureDelete(PIN_KEY),
      AsyncStorage.removeItem(NAME_KEY),
      AsyncStorage.removeItem(INSTRUCTOR_ID_KEY),
      AsyncStorage.removeItem(INSTRUCTOR_SLUG_KEY),
      AsyncStorage.removeItem(INSTRUCTOR_EMAIL_KEY),
      AsyncStorage.removeItem(APP_MODE_KEY),
      AsyncStorage.removeItem(AUTH_METHOD_KEY),
      AsyncStorage.removeItem(TOKEN_KEY_LEGACY),
      AsyncStorage.removeItem(PIN_KEY_LEGACY),
    ]);
    await clearToken();
    sessionPinRef.current = null;
    setIsSetup(false);
    setIsAuthenticated(false);
    setIsPinUpgradeRequired(false);
    setInstructorName("");
    setStoredPin(null);
    setInstructorId(null);
    setInstructorSlug(null);
    setInstructorEmail(null);
    setAuthMethodState(null);
    setAppModeState(null);
  }, []);

  const migrateToBackend = useCallback(
    async (pin: string): Promise<boolean> => {
      if (!instructorName) return false;
      try {
        const result = await api.instructors.register(instructorName, pin);
        await saveToken(result.token);
        await Promise.all([
          AsyncStorage.setItem(INSTRUCTOR_ID_KEY, String(result.id)),
          AsyncStorage.setItem(INSTRUCTOR_SLUG_KEY, result.slug),
        ]);
        setInstructorId(result.id);
        setInstructorSlug(result.slug);
        return true;
      } catch (err) {
        console.warn("[auth] migrateToBackend: backend registration failed", err);
        return false;
      }
    },
    [instructorName]
  );

  const storedPinLength = storedPin !== null ? storedPin.length : null;

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        isSetup,
        isAuthenticated,
        isPinUpgradeRequired,
        storedPinLength,
        instructorName,
        instructorId,
        instructorSlug,
        instructorEmail,
        authMethod,
        appMode,
        hasPendingMigration,
        setAppMode,
        setupInstructor,
        setupInstructorEmail,
        loginWithEmail,
        verifyPin,
        upgradePin,
        lock,
        migrateToBackend,
        retryMigration,
        switchToEmailLogin,
        resetAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
