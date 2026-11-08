/**
 * Tabla de equipos: una fila por equipo con su ciclo actual, su estado y las acciones que el rol
 * permite. En teléfonos el CSS convierte cada fila en una tarjeta.
 */
import type { Equipment } from '../api';
import { can, type Role } from '../auth/permissions';
import { cycleProgress, formatHours } from '../format';
import { EditIcon, iconFor, TrashIcon, WrenchIcon } from './icons';

interface EquipmentTableProps {
  equipment: Equipment[];
  role: Role;
  onEdit: (equipment: Equipment) => void;
  onMaintenance: (equipment: Equipment) => void;
  onDelete: (equipment: Equipment) => void;
}

export function EquipmentTable({ equipment, role, onEdit, onMaintenance, onDelete }: EquipmentTableProps) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Equipo</th>
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
            const Icon = iconFor(e.typeCode);
            // color de la barra: rojo cuando está vencido, ámbar desde el 80% del intervalo (servicio
            // próximo), verde en otro caso
            const level = e.requiresMaintenance ? 'due' : progress >= 80 ? 'warn' : '';
            return (
              <tr key={e.id}>
                <td className="first">
                  <div className="equipment-cell">
                    <span className="equipment-icon">
                      <Icon />
                    </span>
                    <div>
                      <strong>{e.code}</strong>
                      <small>
                        {e.typeName} · cada {formatHours(e.intervalHours)}
                      </small>
                    </div>
                  </div>
                </td>
                <td data-label="Horómetro" className="num">
                  {formatHours(e.hourmeter)}
                </td>
                <td data-label="Ciclo actual">
                  <div className="cycle">
                    <div
                      className={`progress ${level}`}
                      role="meter"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={progress}
                      aria-label={`${progress}% del intervalo`}
                    >
                      <span style={{ width: `${progress}%` }} />
                    </div>
                    <small className="muted">
                      {formatHours(e.hoursSinceService)} de {formatHours(e.intervalHours)}
                    </small>
                  </div>
                </td>
                <td data-label="Estado">
                  {e.requiresMaintenance ? (
                    <span className="badge danger">Requiere mantenimiento</span>
                  ) : (
                    <span className="badge success">Operativo · faltan {formatHours(e.hoursUntilMaintenance)}</span>
                  )}
                </td>
                <td className="actions-cell">
                  <div className="actions">
                  <button type="button" className="btn btn-neutral btn-sm" onClick={() => onMaintenance(e)}>
                    <WrenchIcon size={15} />
                    Mantenimiento
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => onEdit(e)}
                    aria-label={can(role, 'editIdentity') ? `Editar ${e.code}` : `Actualizar horómetro de ${e.code}`}
                    title={can(role, 'editIdentity') ? 'Editar' : 'Actualizar horómetro'}
                  >
                    <EditIcon />
                  </button>
                  {can(role, 'deleteEquipment') && (
                    <button
                      type="button"
                      className="icon-btn danger"
                      onClick={() => onDelete(e)}
                      aria-label={`Eliminar ${e.code}`}
                      title="Eliminar"
                    >
                      <TrashIcon />
                    </button>
                  )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
