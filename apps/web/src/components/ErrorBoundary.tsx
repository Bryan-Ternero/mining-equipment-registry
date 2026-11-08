import { Component, type ErrorInfo, type ReactNode } from 'react';
import { clearSession } from '../auth/session';
import { AlertIcon } from './icons';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/**
 * Last line of defence: without it, any error while rendering unmounts the whole app and the
 * user is left with an empty page. Here it shows what happened and how to get out of it.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="fatal" role="alert">
        <div className="card fatal-card">
          <span className="stat-icon danger" aria-hidden="true">
            <AlertIcon />
          </span>
          <h1>Algo salió mal</h1>
          <p className="muted">
            La pantalla no se pudo mostrar. Recargue la página; si el problema sigue, cierre la sesión e ingrese de
            nuevo.
          </p>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-neutral"
              onClick={() => {
                clearSession();
                window.location.reload();
              }}
            >
              Cerrar sesión
            </button>
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Recargar
            </button>
          </div>
        </div>
      </div>
    );
  }
}
