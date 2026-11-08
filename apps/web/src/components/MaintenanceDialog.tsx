import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type Equipment, type Maintenance } from '../api';
import { formatDate, formatHours, fromLocalInput, parseHours, toLocalInput } from '../format';
import { Modal } from './Modal';

interface MaintenanceDialogProps {
  equipment: Equipment;
  onRegistered: (equipment: Equipment) => void;
  onClose: () => void;
}

/** registra un servicio con su fecha, hora y comentarios (reiniciando el ciclo) y muestra el historial */
export function MaintenanceDialog({ equipment, onRegistered, onClose }: MaintenanceDialogProps) {
  const [history, setHistory] = useState<Maintenance[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [reading, setReading] = useState(String(equipment.hourmeter));
  const [performedAt, setPerformedAt] = useState(() => toLocalInput(new Date()));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .history(equipment.id)
      .then((rows) => {
        if (active) setHistory(rows);
      })
      .catch((e: unknown) => {
        if (active) setHistoryError(e instanceof ApiError ? e.message : 'No se pudo cargar el historial.');
      });
    return () => {
      active = false;
    };
  }, [equipment.id]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const hours = parseHours(reading);
    const when = fromLocalInput(performedAt);
    if (hours === null) return setError('Ingrese la lectura del horómetro.');
    if (hours < equipment.hourmeter) {
      return setError(`La lectura no puede ser menor al horómetro actual (${formatHours(equipment.hourmeter)}).`);
    }
    if (!when) return setError('Ingrese la fecha y hora del mantenimiento.');
    if (new Date(when).getTime() > Date.now() + 60_000) return setError('La fecha y hora no pueden ser futuras.');

    setError(null);
    setSaving(true);
    try {
      const result = await api.registerMaintenance(equipment.id, {
        hourmeter: hours,
        performedAt: when,
        notes: notes.trim() || undefined,
      });
      setHistory((rows) => [result.maintenance, ...(rows ?? [])]);
      setNotes('');
      setPerformedAt(toLocalInput(new Date()));
      onRegistered(result.equipment);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado. Intente de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Mantenimiento · ${equipment.code}`} onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>
        {equipment.typeName} · intervalo {formatHours(equipment.intervalHours)}. Registrar el servicio reinicia el ciclo
        desde la lectura indicada.
      </p>

      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <label className="field">
            <span>Fecha y hora</span>
            <input
              type="datetime-local"
              value={performedAt}
              max={toLocalInput(new Date())}
              onChange={(e) => setPerformedAt(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Horómetro al servicio</span>
            <input value={reading} onChange={(e) => setReading(e.target.value)} inputMode="decimal" />
          </label>
        </div>
        <label className="field">
          <span>Comentarios</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            placeholder="Cambio de aceite y filtros, revisión de frenos…"
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <footer className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Registrando…' : 'Registrar mantenimiento'}
          </button>
        </footer>
      </form>

      <h3 className="section-title">Historial de mantenimientos</h3>
      {historyError && <p className="form-error">{historyError}</p>}
      {!history && !historyError && <p className="muted">Cargando…</p>}
      {history?.length === 0 && <p className="muted">Sin mantenimientos registrados.</p>}
      {history && history.length > 0 && (
        <ol className="history">
          {history.map((m) => (
            <li key={m.id}>
              <span className="history-dot" aria-hidden="true" />
              <div>
                <div className="history-meta">
                  <strong>{formatDate(m.performedAt)}</strong>
                  <span className="muted">{formatHours(m.hourmeter)}</span>
                  {m.performedBy && <span className="muted">por {m.performedBy}</span>}
                </div>
                {m.notes ? <p>{m.notes}</p> : <p className="muted">Sin comentarios.</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
