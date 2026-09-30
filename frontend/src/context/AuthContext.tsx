import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, api, getToken, setToken } from "../lib/api";
import type { TokenResponse, User, Worker } from "../lib/types";

type AuthState = "loading" | "authenticated" | "anonymous";

type AuthContextValue = {
  status: AuthState;
  user: User | null;
  worker: Worker | null;
  token: string | null;
  login: (email: string, password: string) => Promise<User>;
  demoLogin: (role: "CITIZEN" | "WORKER" | "ADMIN") => Promise<User>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    ward?: string;
    address?: string;
  }) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
  updateProfile: (payload: Partial<Pick<User, "name" | "phone" | "ward" | "address">>) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = "smartwaste360.user";

function cacheUser(user: User | null) {
  try {
    if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [token, setTokenState] = useState<string | null>(() => getToken());

  const applySession = useCallback((data: TokenResponse) => {
    setToken(data.access_token);
    setTokenState(data.access_token);
    setUser(data.user);
    setWorker(data.worker);
    cacheUser(data.user);
    setStatus("authenticated");
  }, []);

  const clearSession = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setUser(null);
    setWorker(null);
    cacheUser(null);
    setStatus("anonymous");
  }, []);

  /** Restores a session on page load and revalidates it against the API. */
  const refresh = useCallback(async () => {
    if (!getToken()) {
      clearSession();
      return;
    }
    try {
      const data = await api<{ user: User; worker?: Worker | null }>("/auth/me");
      setUser(data.user);
      setWorker(data.worker ?? null);
      cacheUser(data.user);
      setStatus("authenticated");
    } catch (error) {
      // 401 means the token is no longer valid; anything else (network) keeps it.
      if (error instanceof ApiError && error.status === 401) clearSession();
      else setStatus((current) => (current === "loading" ? "anonymous" : current));
    }
  }, [clearSession]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api<TokenResponse>("/auth/login", {
        method: "POST",
        auth: false,
        body: { email, password },
      });
      applySession(data);
      return data.user;
    },
    [applySession],
  );

  const demoLogin = useCallback(
    async (role: "CITIZEN" | "WORKER" | "ADMIN") => {
      const data = await api<TokenResponse>("/auth/demo-login", {
        method: "POST",
        auth: false,
        body: { role },
      });
      applySession(data);
      return data.user;
    },
    [applySession],
  );

  const register = useCallback(
    async (payload: {
      name: string;
      email: string;
      password: string;
      phone?: string;
      ward?: string;
      address?: string;
    }) => {
      const data = await api<TokenResponse>("/auth/register", {
        method: "POST",
        auth: false,
        body: { ...payload, role: "CITIZEN" },
      });
      applySession(data);
      return data.user;
    },
    [applySession],
  );

  const updateProfile = useCallback(
    async (payload: Partial<Pick<User, "name" | "phone" | "ward" | "address">>) => {
      const data = await api<{ user: User }>("/auth/me", { method: "PATCH", body: payload });
      setUser(data.user);
      cacheUser(data.user);
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      worker,
      token,
      login,
      demoLogin,
      register,
      logout: clearSession,
      refresh,
      updateProfile,
    }),
    [status, user, worker, token, login, demoLogin, register, clearSession, refresh, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}

/** Home route for each role, used by the router guards and logout flow. */
export function homeFor(role: User["role"] | undefined): string {
  if (role === "ADMIN") return "/admin";
  if (role === "WORKER") return "/worker";
  return "/app/dashboard";
}
