import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api';
import type { Session } from '../auth/session';
import { BrandMark, EyeIcon, EyeOffIcon } from './icons';

export const PROJECT_NAME = 'Registro de equipos mineros';

interface LoginScreenProps {
  onLoggedIn: (session: Session) => void;
  /** se muestra cuando la sesión anterior expiró */
  notice?: string | null;
}

/** login 60/40: la operación a la izquierda (imagen + nombre del proyecto), el formulario a la derecha */
export function LoginScreen({ onLoggedIn, notice }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError('Ingrese su usuario y contraseña.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      onLoggedIn(await api.login(username.trim(), password));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo iniciar sesión. Intente de nuevo.');
      setPassword('');
      setLoading(false);
    }
  }

  return (
    <div className="login">
      <section className="login-visual" aria-label={PROJECT_NAME}>
        <div className="brand">
          <BrandMark />
          <span>Control de flota</span>
        </div>
        <div>
          <h1>{PROJECT_NAME}</h1>
          <p>
            Controle el horómetro de camiones, excavadoras y perforadoras, y sepa qué equipo requiere mantenimiento
            antes de que se detenga la operación.
          </p>
          <div className="login-facts">
            <div>
              <strong>250 h</strong>
              <span>intervalo de camiones</span>
            </div>
            <div>
              <strong>500 h</strong>
              <span>intervalo de excavadoras</span>
            </div>
            <div>
              <strong>300 h</strong>
              <span>intervalo de perforadoras</span>
            </div>
          </div>
        </div>
      </section>

      <main className="login-panel">
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <header>
            <h2>Iniciar sesión</h2>
            <p className="muted">Ingrese con su cuenta de supervisor u operador.</p>
          </header>

          {notice && !error && (
            <p className="form-error" role="status">
              {notice}
            </p>
          )}

          <label className="field">
            <span>Usuario</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              aria-invalid={Boolean(error) && !username.trim()}
            />
          </label>

          <label className="field">
            <span>Contraseña</span>
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                aria-invalid={Boolean(error) && !password}
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>

          <ul className="login-roles">
            <li>
              <span className="badge role">Supervisor</span>
              <span className="muted">Gestiona la flota completa.</span>
            </li>
            <li>
              <span className="badge role">Operador</span>
              <span className="muted">Actualiza horómetros y registra mantenimientos.</span>
            </li>
          </ul>
        </form>
      </main>
    </div>
  );
}
