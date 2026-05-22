import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "./types";

const sessionKey = "almoxarifado-session";

type SessionContextValue = {
  clearSession: () => void;
  session: Session | null;
  setSession: (session: Session) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function getStoredSession(): Session | null {
  const storedSession = localStorage.getItem(sessionKey);

  if (!storedSession) {
    return null;
  }

  try {
    return JSON.parse(storedSession) as Session;
  } catch {
    localStorage.removeItem(sessionKey);
    return null;
  }
}

export function SessionProvider({
  children,
  initialSession,
}: {
  children: ReactNode;
  initialSession?: Session | null;
}) {
  const [session, setCurrentSession] = useState<Session | null>(
    initialSession ?? getStoredSession(),
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      clearSession() {
        localStorage.removeItem(sessionKey);
        setCurrentSession(null);
      },
      session,
      setSession(nextSession) {
        localStorage.setItem(sessionKey, JSON.stringify(nextSession));
        setCurrentSession(nextSession);
      },
    }),
    [session],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);

  if (!value) {
    throw new Error("SessionProvider ausente.");
  }

  return value;
}
