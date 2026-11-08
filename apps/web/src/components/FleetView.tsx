/**
 * Main screen: loads the type catalogue and the equipment, shows the summary cards, filters and search,
 * and opens the dialogs. After each change it updates that row in place instead of reloading the list.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError, type Equipment, type EquipmentType } from '../api';
import { can, type Role } from '../auth/permissions';
import { ConfirmDelete } from './ConfirmDelete';
import { EquipmentForm } from './EquipmentForm';
import { EquipmentTable } from './EquipmentTable';
import { AlertIcon, CheckIcon, GridIcon, PlusIcon, SearchIcon } from './icons';
import { MaintenanceDialog } from './MaintenanceDialog';

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; equipment: Equipment }
  | { kind: 'maintenance'; equipment: Equipment }
  | { kind: 'delete'; equipment: Equipment }
  | null;

type Filter = 'all' | 'due' | 'ok';

const NOTICE_MS = 3500;
const byCode = (a: Equipment, b: Equipment) => a.code.localeCompare(b.code);

interface FleetViewProps {
  role: Role;
  onDueCountChange: (count: number) => void;
}

export function FleetView({ role, onDueCountChange }: FleetViewProps) {
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [equipment, setEquipment] = useState<Equipment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [typeRows, rows] = await Promise.all([api.types(), api.list()]);
      setTypes(typeRows);
      setEquipment(rows);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'No se pudo cargar el registro.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const dueCount = useMemo(() => equipment?.filter((e) => e.requiresMaintenance).length ?? 0, [equipment]);
  useEffect(() => onDueCountChange(dueCount), [dueCount, onDueCountChange]);

  // tab filter (all / due / operating) combined with the search box (code or type name)
  const visible = useMemo(() => {
    const text = query.trim().toUpperCase();
    return (equipment ?? []).filter(
      (e) =>
        (filter === 'all' || (filter === 'due') === e.requiresMaintenance) &&
        (!text || e.code.includes(text) || e.typeName.toUpperCase().includes(text)),
    );
  }, [equipment, filter, query]);

  // a save that finishes late only closes its own dialog, never one opened afterwards
  const closeIf = (opened: Dialog) => setDialog((current) => (current === opened ? null : current));
  // the API answers every write with the updated equipment: replace that row, keep the list sorted
  const upsert = (row: Equipment) =>
    setEquipment((rows) => [...(rows ?? []).filter((r) => r.id !== row.id), row].sort(byCode));

  const total = equipment?.length ?? 0;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Equipos</h1>
          <p className="muted">Horómetro, ciclo de mantenimiento e historial de cada equipo de la faena.</p>
        </div>
        {can(role, 'createEquipment') && (
          <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: 'create' })}>
            <PlusIcon size={16} />
            Nuevo equipo
          </button>
        )}
      </div>

      <section className="stats" aria-label="Resumen">
        <div className="card stat">
          <div>
            <span className="stat-label">Equipos</span>
            <span className="stat-value">{total}</span>
          </div>
          <span className="stat-icon primary">
            <GridIcon />
          </span>
        </div>
        <div className="card stat">
          <div>
            <span className="stat-label">Requieren mantenimiento</span>
            <span className="stat-value">{dueCount}</span>
          </div>
          <span className="stat-icon danger">
            <AlertIcon />
          </span>
        </div>
        <div className="card stat">
          <div>
            <span className="stat-label">Operativos</span>
            <span className="stat-value">{total - dueCount}</span>
          </div>
          <span className="stat-icon success">
            <CheckIcon />
          </span>
        </div>
      </section>

      <section className="card">
        <div className="table-card-header">
          <div className="tabs" role="group" aria-label="Filtro">
            {(
              [
                ['all', `Todos (${total})`],
                ['due', `Requieren mantenimiento (${dueCount})`],
                ['ok', `Operativos (${total - dueCount})`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`tab ${filter === value ? 'active' : ''}`}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="search">
            <span className="visually-hidden">Buscar</span>
            <SearchIcon size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por código o tipo" />
          </label>
        </div>

        {loadError && (
          <div className="empty" role="alert">
            <p>{loadError}</p>
            <button type="button" className="btn btn-neutral" onClick={() => void load()}>
              Reintentar
            </button>
          </div>
        )}
        {!equipment && !loadError && <p className="empty muted">Cargando equipos…</p>}
        {equipment && visible.length === 0 && (
          <p className="empty muted">
            {total === 0
              ? 'Todavía no hay equipos registrados.'
              : query
                ? 'Ningún equipo coincide con la búsqueda.'
                : filter === 'due'
                  ? 'Ningún equipo requiere mantenimiento.'
                  : 'No hay equipos en este estado.'}
          </p>
        )}
        {visible.length > 0 && (
          <>
            <EquipmentTable
              equipment={visible}
              role={role}
              onEdit={(e) => setDialog({ kind: 'edit', equipment: e })}
              onMaintenance={(e) => setDialog({ kind: 'maintenance', equipment: e })}
              onDelete={(e) => setDialog({ kind: 'delete', equipment: e })}
            />
            <div className="table-footer muted">
              Mostrando {visible.length} de {total} equipos
            </div>
          </>
        )}
      </section>

      {notice && (
        <div className="toast" role="status">
          <CheckIcon size={16} />
          {notice}
        </div>
      )}

      {dialog?.kind === 'create' && (
        <EquipmentForm
          types={types}
          role={role}
          onClose={() => setDialog(null)}
          onSubmit={async (input) => {
            const created = await api.create(input as Required<typeof input>);
            upsert(created);
            closeIf(dialog);
            setNotice(`Equipo ${created.code} creado.`);
          }}
        />
      )}
      {dialog?.kind === 'edit' && (
        <EquipmentForm
          types={types}
          role={role}
          equipment={dialog.equipment}
          onClose={() => setDialog(null)}
          onSubmit={async (input) => {
            const updated = await api.update(dialog.equipment.id, input);
            upsert(updated);
            closeIf(dialog);
            setNotice(`Equipo ${updated.code} actualizado.`);
          }}
        />
      )}
      {dialog?.kind === 'maintenance' && (
        <MaintenanceDialog
          equipment={dialog.equipment}
          onClose={() => setDialog(null)}
          onRegistered={(updated) => {
            upsert(updated);
            // keep the dialog open on the refreshed equipment, unless the user already left it
            setDialog((current) => (current === dialog ? { kind: 'maintenance', equipment: updated } : current));
            setNotice(`Mantenimiento de ${updated.code} registrado: ciclo reiniciado.`);
          }}
        />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmDelete
          equipment={dialog.equipment}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await api.remove(dialog.equipment.id);
            setEquipment((rows) => rows?.filter((r) => r.id !== dialog.equipment.id) ?? null);
            closeIf(dialog);
            setNotice(`Equipo ${dialog.equipment.code} eliminado.`);
          }}
        />
      )}
    </>
  );
}
