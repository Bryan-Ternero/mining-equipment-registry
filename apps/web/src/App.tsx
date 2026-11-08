import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { configureAuth } from './api';
import { clearSession, loadSession, saveSession, type Session } from './auth/session';
import { AppShell } from './components/AppShell';
import { FleetView } from './components/FleetView';
import { LoginScreen } from './components/LoginScreen';

/** control de sesión: el login hasta que haya una sesión válida, luego el sistema para ese rol */
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

  // un layout effect se ejecuta antes que el useEffect de cualquier hijo: al recargar la página con una sesión
  // guardada, la primera petición de la flota ya debe llevar el token
  useLayoutEffect(() => {
    configureAuth({
      token: () => sessionRef.current?.token ?? null,
      onUnauthorized: () => logout('Su sesión expiró. Ingrese nuevamente.'),
    });
  }, [logout]);

  // el token lleva su vencimiento: cerrar sesión a tiempo en lugar de esperar una petición rechazada
  useEffect(() => {
    if (!session) return;
    const ms = new Date(session.expiresAt).getTime() - Date.now();
    // setTimeout se dispara de inmediato por encima de 2^31-1 ms (~24,8 días): se limita
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
