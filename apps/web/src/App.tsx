import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { configureAuth } from './api';
import { clearSession, loadSession, saveSession, type Session } from './auth/session';
import { AppShell } from './components/AppShell';
import { FleetView } from './components/FleetView';
import { LoginScreen } from './components/LoginScreen';

/** session gate: the login until there is a valid session, then the system for that role */
export function App() {
  const [session, setSession] = useState<Session | null>(loadSession);
  const [notice, setNotice] = useState<string | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const logout = useCallback((reason?: string) => {
    clearSession();
    setSession(null);
    setNotice(reason ?? null);
  }, []);

  // a layout effect runs before any child's useEffect: on a page reload with a stored session,
  // the fleet's first request must already carry the token
  useLayoutEffect(() => {
    configureAuth({
      token: () => sessionRef.current?.token ?? null,
      onUnauthorized: () => logout('Su sesión expiró. Ingrese nuevamente.'),
    });
  }, [logout]);

  // the token carries its expiry: sign out on time instead of waiting for a rejected request
  useEffect(() => {
    if (!session) return;
    const ms = new Date(session.expiresAt).getTime() - Date.now();
    // setTimeout fires at once beyond 2^31-1 ms (~24.8 days): cap it
    const delay = Math.min(Math.max(0, ms), 2 ** 31 - 1);
    const timer = setTimeout(() => logout('Su sesión expiró. Ingrese nuevamente.'), delay);
    return () => clearTimeout(timer);
  }, [session, logout]);

  if (!session) {
    return (
      <LoginScreen
        notice={notice}
        onLoggedIn={(next) => {
          saveSession(next);
          setNotice(null);
          setSession(next);
        }}
      />
    );
  }

  return (
    <AppShell user={session.user} dueCount={dueCount} onLogout={() => logout()}>
      <FleetView key={session.user.username} role={session.user.role} onDueCountChange={setDueCount} />
    </AppShell>
  );
}
