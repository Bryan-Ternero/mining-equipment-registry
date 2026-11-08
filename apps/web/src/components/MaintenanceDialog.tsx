import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type Equipment, type Maintenance } from '../api';
import { formatDate, formatHours, parseHours } from '../format';
import { Modal } from './Modal';

interface MaintenanceDialogProps {
  equipment: Equipment;
  onRegistered: (equipment: Equipment) => void;
  onClose: () => void;
}

/** registers a service (restarting the cycle) and shows the equipment's history */
export function MaintenanceDialog({ equipment, onRegistered, onClose }: MaintenanceDialogProps) {
  const [history, setHistory] = useState<Maintenance[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [reading, setReading] = useState(String(equipment.hourmeter));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .history(equipment.id)
      .then((rows) => active && setHistory(rows))
      .catch((e: unknown) => active && setHistoryError(e instanceof ApiError ? e.message : 'No se pudo cargar el historial.'));
    return () => {
      active = false;
    };
  }, [equipment.id]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const hours = parseHours(reading);
    if (hours === null) return setError('Ingrese la lectura del horómetro.');
    if (hours < equipment.hourmeter) {
      return setError(`La lectura no puede ser menor al horómetro actual (${formatHours(equipment.hourmeter)}).`);
    }
    setError(null);
    setSaving(true);
    try {
      const result = await api.registerMaintenance(equipment.id, {
        hourmeter: hours,
        notes: notes.trim() || undefined,
      });
      setHistory((rows) => [result.maintenance, ...(rows ?? [])]);
      setNotes('');
      onRegistered(result.equipment);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado. Intente de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Mantenimiento · ${equipment.code}`} onClose={onClose}>
      <p className="muted">
        {equipment.typeName} · intervalo {formatHours(equipment.intervalHours)}. Registrar el servicio reinicia el
        ciclo desde la lectura indicada.
      </p>

      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <label className="field">
            <span>Horómetro al servicio</span>
            <input value={reading} onChange={(e) => setReading(e.target.value)} inputMode="decimal" />
          </label>
          <label className="field grow">
            <span>Notas (opcional)</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="Cambio de aceite y filtros"
            />
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <footer className="form-actions">
          <button type="submit" className="button primary" disabled={saving}>
            {saving ? 'Registrando…' : 'Registrar mantenimiento'}
          </button>
        </footer>
      </form>

      <h3 className="section-title">Historial</h3>
      {historyError && <p className="form-error">{historyError}</p>}
      {!history && !historyError && <p className="muted">Cargando…</p>}
      {history?.length === 0 && <p className="muted">Sin mantenimientos registrados.</p>}
      {history && history.length > 0 && (
        <ol className="history">
          {history.map((m) => (
            <li key={m.id}>
              <strong>{formatHours(m.hourmeter)}</strong>
              <span className="muted">{formatDate(m.performedAt)}</span>
              {m.notes && <span>{m.notes}</span>}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
