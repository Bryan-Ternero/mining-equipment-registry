/**
 * Tabla de equipos: una fila por equipo con su ciclo actual, su estado y las acciones que el rol
 * permite. En teléfonos el CSS convierte cada fila en una tarjeta.
 */
import { Fragment, useEffect, useState, type MouseEvent } from 'react';
import type { Equipment } from '../api';
import { can, type Role } from '../auth/permissions';
import { cycleProgress, formatHours } from '../format';
import { EquipmentDetails } from './EquipmentDetails';
import { EditIcon, iconFor, InfoIcon, TrashIcon, WrenchIcon } from './icons';

// la tarjeta flotante solo tiene sentido con un mouse; en pantallas táctiles se usa el botón ⓘ
const canHover = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
const CARD_WIDTH = 300;
const CARD_HEIGHT = 250;

interface Peek {
  equipment: Equipment;
  top: number;
  left: number;
}

interface EquipmentTableProps {
  equipment: Equipment[];
  role: Role;
  onEdit: (equipment: Equipment) => void;
  onMaintenance: (equipment: Equipment) => void;
  onDelete: (equipment: Equipment) => void;
}

export function EquipmentTable({ equipment, role, onEdit, onMaintenance, onDelete }: EquipmentTableProps) {
  const [peek, setPeek] = useState<Peek | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // la tarjeta usa posición fija: al desplazar la página quedaría fuera de lugar, así que se oculta
  useEffect(() => {
    if (!peek) return;
    const hide = () => setPeek(null);
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [peek]);

  // la tarjeta aparece a la derecha de la celda del equipo, sin salirse de la ventana
  function showPeek(event: MouseEvent<HTMLTableRowElement>, row: Equipment) {
    if (!canHover) return;
    const cell = event.currentTarget.querySelector('.equipment-cell')?.getBoundingClientRect();
    if (!cell) return;
    const left = Math.min(cell.right + 12, window.innerWidth - CARD_WIDTH - 12);
    const top = Math.max(12, Math.min(cell.top, window.innerHeight - CARD_HEIGHT - 12));
    setPeek({ equipment: row, top, left });
  }

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
            const expanded = expandedId === e.id;
            return (
              <Fragment key={e.id}>
              <tr onMouseEnter={(event) => showPeek(event, e)} onMouseLeave={() => setPeek(null)}>
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
                    <button
                      type="button"
                      className={`icon-btn details-toggle ${expanded ? 'active' : ''}`}
                      onClick={() => setExpandedId(expanded ? null : e.id)}
                      aria-expanded={expanded}
                      aria-controls={`details-${e.id}`}
                      aria-label={`${expanded ? 'Ocultar' : 'Ver'} detalle de ${e.code}`}
                      title="Detalle del equipo"
                    >
                      <InfoIcon size={16} />
                    </button>
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
              {expanded && (
                <tr className="details-row" id={`details-${e.id}`}>
                  <td colSpan={5}>
                    <EquipmentDetails equipment={e} />
                  </td>
                </tr>
              )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {peek && expandedId !== peek.equipment.id && (
        <div className="details-card" style={{ top: peek.top, left: peek.left, width: CARD_WIDTH }} role="tooltip">
          <strong className="details-card-title">{peek.equipment.code}</strong>
          <EquipmentDetails equipment={peek.equipment} />
        </div>
      )}
    </div>
  );
}
