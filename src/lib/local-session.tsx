import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ADMIN_USERNAME, type LocalUser, verifyLocalUser, verifyPin } from "./local-users";

const SESSION_KEY = "sibamotor-session";

type SessionCtx = {
  user: LocalUser | null;
  ready: boolean;
  isAdmin: boolean;
  /** Returns user, or { needsPin: true, pending } if 2FA required */
  login: (
    username: string,
    password: string,
  ) => Promise<LocalUser | { needsPin: true; pending: LocalUser } | null>;
  completePinLogin: (username: string, pin: string, pending: LocalUser) => Promise<LocalUser | null>;
  logout: () => void;
};

const Ctx = createContext<SessionCtx | null>(null);

function readSession(): LocalUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalUser;
    if (!parsed?.username || !parsed.displayName) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(user: LocalUser) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
}

export function LocalSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(readSession());
    setReady(true);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const next = await verifyLocalUser({ data: { username, password } });
    if (!next) return null;
    if (next.pinEnabled) {
      return { needsPin: true as const, pending: next };
    }
    writeSession(next);
    setUser(next);
    return next;
  }, []);

  const completePinLogin = useCallback(async (username: string, pin: string, pending: LocalUser) => {
    const res = await verifyPin({ data: { username, pin } });
    if (!res.ok) return null;
    writeSession(pending);
    setUser(pending);
    return pending;
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    setUser(null);
  }, []);

  const isAdmin = user?.username === ADMIN_USERNAME;
  const value = useMemo(
    () => ({ user, ready, isAdmin, login, completePinLogin, logout }),
    [user, ready, isAdmin, login, completePinLogin, logout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocalSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLocalSession outside provider");
  return ctx;
}
