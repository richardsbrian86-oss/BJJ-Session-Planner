import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface ClientUser {
  id: number;
  name: string;
  email: string;
}

interface ClientAuthContextValue {
  client: ClientUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, client: ClientUser) => void;
  logout: () => void;
}

const ClientAuthContext = createContext<ClientAuthContextValue | null>(null);

const TOKEN_KEY = "bjj_client_token";
const CLIENT_KEY = "bjj_client_user";

export function ClientAuthProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<ClientUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // One-time migration: move any existing localStorage session into sessionStorage
    // so users who were already logged in are not suddenly logged out.
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
      // localStorage or sessionStorage may be blocked (e.g. private browsing with strict settings)
    }

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

  const login = useCallback((newToken: string, newClient: ClientUser) => {
    try {
      sessionStorage.setItem(TOKEN_KEY, newToken);
      sessionStorage.setItem(CLIENT_KEY, JSON.stringify(newClient));
    } catch {
      // sessionStorage blocked — state still updated in memory
    }
    setToken(newToken);
    setClient(newClient);
  }, []);

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(CLIENT_KEY);
    } catch {
      // sessionStorage blocked
    }
    setToken(null);
    setClient(null);
  }, []);

  return (
    <ClientAuthContext.Provider
      value={{ client, token, isAuthenticated: !!client, isLoading, login, logout }}
    >
      {children}
    </ClientAuthContext.Provider>
  );
}

export function useClientAuth() {
  const ctx = useContext(ClientAuthContext);
  if (!ctx) throw new Error("useClientAuth must be used within ClientAuthProvider");
  return ctx;
}
