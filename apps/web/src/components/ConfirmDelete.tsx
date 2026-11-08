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
      <p>Se eliminará el equipo y todo su historial de mantenimientos. Esta acción no se puede deshacer.</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <footer className="form-actions">
        <button type="button" className="button" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="button danger" onClick={handleConfirm} disabled={deleting}>
          {deleting ? 'Eliminando…' : 'Eliminar'}
        </button>
      </footer>
    </Modal>
  );
}
