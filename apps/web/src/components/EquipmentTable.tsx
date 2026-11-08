import type { Equipment } from '../api';
import { cycleProgress, formatHours } from '../format';

interface EquipmentTableProps {
  equipment: Equipment[];
  onEdit: (equipment: Equipment) => void;
  onMaintenance: (equipment: Equipment) => void;
  onDelete: (equipment: Equipment) => void;
}

export function EquipmentTable({ equipment, onEdit, onMaintenance, onDelete }: EquipmentTableProps) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th scope="col">Código</th>
          <th scope="col">Tipo</th>
          <th scope="col" className="num">
            Horómetro
          </th>
          <th scope="col">Ciclo actual</th>
          <th scope="col">Estado</th>
          <th scope="col">
            <span className="visually-hidden">Acciones</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {equipment.map((e) => {
          const progress = cycleProgress(e);
          return (
            <tr key={e.id} className={e.requiresMaintenance ? 'row-alert' : undefined}>
              <td data-label="Código" className="code">
                {e.code}
              </td>
              <td data-label="Tipo">{e.typeName}</td>
              <td data-label="Horómetro" className="num">
                {formatHours(e.hourmeter)}
              </td>
              <td data-label="Ciclo actual">
                <div className="cycle">
                  <div
                    className="meter"
                    role="meter"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                    aria-label={`${progress}% del intervalo`}
                  >
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <small className="muted">
                    {formatHours(e.hoursSinceService)} / {formatHours(e.intervalHours)}
                  </small>
                </div>
              </td>
              <td data-label="Estado">
                {e.requiresMaintenance ? (
                  <span className="badge alert">Requiere mantenimiento</span>
                ) : (
                  <span className="badge ok">Operativo · faltan {formatHours(e.hoursUntilMaintenance)}</span>
                )}
              </td>
              <td className="actions">
                <button type="button" className="button small" onClick={() => onMaintenance(e)}>
                  Mantenimiento
                </button>
                <button type="button" className="button small" onClick={() => onEdit(e)}>
                  Editar
                </button>
                <button type="button" className="button small danger-text" onClick={() => onDelete(e)}>
                  Eliminar
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
