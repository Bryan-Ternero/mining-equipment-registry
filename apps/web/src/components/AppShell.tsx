import type { ReactNode } from 'react';
import { roleLabel } from '../auth/permissions';
import type { SessionUser } from '../auth/session';
import { BrandMark, GridIcon, LogoutIcon } from './icons';
import { PROJECT_NAME } from './LoginScreen';

interface AppShellProps {
  user: SessionUser;
  dueCount: number;
  onLogout: () => void;
  children: ReactNode;
}

/** barra lateral con la marca, la navegación y el usuario conectado; una barra superior compacta en teléfonos */
export function AppShell({ user, dueCount, onLogout, children }: AppShellProps) {
  const initial = user.username.slice(0, 1);
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandMark />
          <span>{PROJECT_NAME}</span>
        </div>

        <nav className="nav" aria-label="Principal">
          <a className="nav-item active" href="#equipos" aria-current="page">
            <GridIcon />
            Equipos
            {dueCount > 0 && (
              <span className="nav-count" title="Requieren mantenimiento">
                {dueCount}
              </span>
            )}
          </a>
        </nav>

        <div className="user-card">
          <span className="avatar" aria-hidden="true">
            {initial}
          </span>
          <div className="who">
            <strong>{user.username}</strong>
            <span className="badge role">{roleLabel(user.role)}</span>
          </div>
          <button type="button" className="icon-btn" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión">
            <LogoutIcon />
          </button>
        </div>
      </aside>

      <header className="topbar-mobile">
        <div className="brand">
          <BrandMark />
        </div>
        <div className="who">
          <span className="badge role">{roleLabel(user.role)}</span>
          <strong>{user.username}</strong>
          <button type="button" className="icon-btn" onClick={onLogout} aria-label="Cerrar sesión">
            <LogoutIcon />
          </button>
        </div>
      </header>

      <main className="main" id="equipos">
        {children}
      </main>
    </div>
  );
}
