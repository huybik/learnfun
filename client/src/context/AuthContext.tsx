import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { apiFetch } from "@/config/api";

interface AuthUser {
  token: string;
  userId: string;
  displayName: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    password: string,
    displayName: string,
  ) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = "learnfun-auth";

const AuthContext = createContext<AuthContextValue | null>(null);

function saveAuth(user: AuthUser) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

function loadAuth(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Verify stored token on mount
  useEffect(() => {
    const stored = loadAuth();
    if (!stored) {
      setIsLoading(false);
      return;
    }
    apiFetch<{ userId: string; displayName: string }>("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ token: stored.token }),
    })
      .then((data) => {
        const verified = {
          token: stored.token,
          userId: data.userId,
          displayName: data.displayName,
        };
        setUser(verified);
        saveAuth(verified);
      })
      .catch(() => {
        clearAuth();
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const data = await apiFetch<AuthUser>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setUser(data);
    saveAuth(data);
  }, []);

  const register = useCallback(
    async (username: string, password: string, displayName: string) => {
      const data = await apiFetch<AuthUser>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, password, displayName }),
      });
      setUser(data);
      saveAuth(data);
    },
    [],
  );

  const logout = useCallback(() => {
    setUser(null);
    clearAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
