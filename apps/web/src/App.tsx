import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError, type Equipment, type EquipmentType } from './api';
import { ConfirmDelete } from './components/ConfirmDelete';
import { EquipmentForm } from './components/EquipmentForm';
import { EquipmentTable } from './components/EquipmentTable';
import { MaintenanceDialog } from './components/MaintenanceDialog';

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; equipment: Equipment }
  | { kind: 'maintenance'; equipment: Equipment }
  | { kind: 'delete'; equipment: Equipment }
  | null;

type Filter = 'all' | 'due';

const byCode = (a: Equipment, b: Equipment) => a.code.localeCompare(b.code);

export function App() {
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [equipment, setEquipment] = useState<Equipment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [filter, setFilter] = useState<Filter>('all');
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
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  // a save that finishes late only closes its own dialog, never one opened afterwards
  const closeIf = (opened: Dialog) => setDialog((current) => (current === opened ? null : current));

  const upsert = (row: Equipment) =>
    setEquipment((rows) => [...(rows ?? []).filter((r) => r.id !== row.id), row].sort(byCode));

  const dueCount = useMemo(() => equipment?.filter((e) => e.requiresMaintenance).length ?? 0, [equipment]);
  const visible = useMemo(
    () => (filter === 'due' ? equipment?.filter((e) => e.requiresMaintenance) : equipment) ?? [],
    [equipment, filter],
  );

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>Registro de equipos mineros</h1>
          <p className="muted">Control de horómetro y mantenimiento por tipo de equipo.</p>
        </div>
        <button type="button" className="button primary" onClick={() => setDialog({ kind: 'create' })}>
          + Nuevo equipo
        </button>
      </header>

      {equipment && (
        <section className="stats" aria-label="Resumen">
          <div className="stat">
            <span className="stat-value">{equipment.length}</span>
            <span className="muted">equipos</span>
          </div>
          <div className={`stat ${dueCount > 0 ? 'stat-alert' : ''}`}>
            <span className="stat-value">{dueCount}</span>
            <span className="muted">requieren mantenimiento</span>
          </div>
          <div className="stat stat-types">
            {types.map((t) => (
              <span key={t.code} className="muted">
                {t.name}: cada {t.maintenanceIntervalHours} h
              </span>
            ))}
          </div>
        </section>
      )}

      <main className="card">
        <div className="toolbar" role="group" aria-label="Filtro">
          <button
            type="button"
            className={`chip ${filter === 'all' ? 'active' : ''}`}
            aria-pressed={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            Todos
          </button>
          <button
            type="button"
            className={`chip ${filter === 'due' ? 'active' : ''}`}
            aria-pressed={filter === 'due'}
            onClick={() => setFilter('due')}
          >
            Requieren mantenimiento ({dueCount})
          </button>
        </div>

        {loadError && (
          <div className="empty" role="alert">
            <p>{loadError}</p>
            <button type="button" className="button" onClick={() => void load()}>
              Reintentar
            </button>
          </div>
        )}
        {!equipment && !loadError && <p className="empty muted">Cargando equipos…</p>}
        {equipment && visible.length === 0 && (
          <p className="empty muted">
            {filter === 'due' ? 'Ningún equipo requiere mantenimiento.' : 'Todavía no hay equipos registrados.'}
          </p>
        )}
        {visible.length > 0 && (
          <EquipmentTable
            equipment={visible}
            onEdit={(e) => setDialog({ kind: 'edit', equipment: e })}
            onMaintenance={(e) => setDialog({ kind: 'maintenance', equipment: e })}
            onDelete={(e) => setDialog({ kind: 'delete', equipment: e })}
          />
        )}
      </main>

      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}

      {dialog?.kind === 'create' && (
        <EquipmentForm
          types={types}
          onClose={() => setDialog(null)}
          onSubmit={async (input) => {
            const created = await api.create(input);
            upsert(created);
            closeIf(dialog);
            setNotice(`Equipo ${created.code} creado.`);
          }}
        />
      )}
      {dialog?.kind === 'edit' && (
        <EquipmentForm
          types={types}
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
    </div>
  );
}
