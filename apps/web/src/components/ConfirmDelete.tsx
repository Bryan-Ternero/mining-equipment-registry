/**
 * Confirmation before deleting an equipment: the history goes with it and it cannot be undone.
 */
import { useState } from 'react';
import { ApiError, type Equipment } from '../api';
import { Modal } from './Modal';

interface ConfirmDeleteProps {
  equipment: Equipment;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function ConfirmDelete({ equipment, onConfirm, onClose }: ConfirmDeleteProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setDeleting(true);
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado. Intente de nuevo.');
      setDeleting(false);
    }
  }

  return (
    <Modal title={`Eliminar ${equipment.code}`} onClose={onClose}>
      <p style={{ marginTop: 0 }}>
        Se eliminará el equipo <strong>{equipment.code}</strong> y todo su historial de mantenimientos. Esta acción no se
        puede deshacer.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <footer className="form-actions">
        <button type="button" className="btn btn-neutral" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="btn btn-danger" onClick={handleConfirm} disabled={deleting}>
          {deleting ? 'Eliminando…' : 'Eliminar equipo'}
        </button>
      </footer>
    </Modal>
  );
}
