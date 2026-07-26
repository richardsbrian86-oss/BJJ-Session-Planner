import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface InstructorUser {
  id: number;
  name: string;
  slug: string;
  email?: string;
}

interface InstructorAuthContextValue {
  instructor: InstructorUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, instructor: InstructorUser) => void;
  logout: () => void;
}

const InstructorAuthContext = createContext<InstructorAuthContextValue | null>(null);

const TOKEN_KEY = "bjj_instructor_token";
const USER_KEY = "bjj_instructor_user";

export function InstructorAuthProvider({ children }: { children: ReactNode }) {
  const [instructor, setInstructor] = useState<InstructorUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const savedToken = sessionStorage.getItem(TOKEN_KEY);
      const savedUser = sessionStorage.getItem(USER_KEY);
      if (savedToken && savedUser) {
        setToken(savedToken);
        setInstructor(JSON.parse(savedUser));
      }
    } catch {
      // sessionStorage blocked
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((newToken: string, newInstructor: InstructorUser) => {
    try {
      sessionStorage.setItem(TOKEN_KEY, newToken);
      sessionStorage.setItem(USER_KEY, JSON.stringify(newInstructor));
    } catch {
      // sessionStorage blocked
    }
    setToken(newToken);
    setInstructor(newInstructor);
  }, []);

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
    } catch {
      // sessionStorage blocked
    }
    setToken(null);
    setInstructor(null);
  }, []);

  return (
    <InstructorAuthContext.Provider
      value={{ instructor, token, isAuthenticated: !!instructor, isLoading, login, logout }}
    >
      {children}
    </InstructorAuthContext.Provider>
  );
}

export function useInstructorAuth() {
  const ctx = useContext(InstructorAuthContext);
  if (!ctx) throw new Error("useInstructorAuth must be used within InstructorAuthProvider");
  return ctx;
}
