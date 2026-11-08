import { useState, type FormEvent } from 'react';
import { ApiError, type Equipment, type EquipmentInput, type EquipmentType } from '../api';
import { can, type Role } from '../auth/permissions';
import { formatHours, parseHours } from '../format';
import { Modal } from './Modal';

interface EquipmentFormProps {
  types: EquipmentType[];
  role: Role;
  /** equipment to edit; undefined to create a new one */
  equipment?: Equipment;
  onSubmit: (input: Partial<EquipmentInput>) => Promise<void>;
  onClose: () => void;
}

type FieldName = 'code' | 'typeCode' | 'hourmeter';
type Fields = Partial<Record<FieldName, string>>;
const FIELD_NAMES: FieldName[] = ['code', 'typeCode', 'hourmeter'];

export function EquipmentForm({ types, role, equipment, onSubmit, onClose }: EquipmentFormProps) {
  const [code, setCode] = useState(equipment?.code ?? '');
  const [typeCode, setTypeCode] = useState<string>(equipment?.typeCode ?? '');
  const [hourmeter, setHourmeter] = useState(equipment ? String(equipment.hourmeter) : '0');
  const [fieldErrors, setFieldErrors] = useState<Fields>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // the operator only updates the hourmeter: code and type are the identity of the equipment
  const identityLocked = !can(role, 'editIdentity');
  const minHours = equipment?.lastServiceHours ?? 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const hours = parseHours(hourmeter);
    const errors: Fields = {};
    if (!identityLocked && !code.trim()) errors.code = 'Ingrese el código del equipo.';
    if (!identityLocked && !typeCode) errors.typeCode = 'Seleccione el tipo.';
    if (hours === null) errors.hourmeter = 'Ingrese un número de horas.';
    else if (hours < minHours) errors.hourmeter = `No puede ser menor a ${formatHours(minHours)} (último mantenimiento).`;
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0 || hours === null) return;

    setSaving(true);
    try {
      await onSubmit(
        identityLocked ? { hourmeter: hours } : { code: code.trim(), typeCode, hourmeter: hours },
      );
    } catch (error) {
      if (error instanceof ApiError) {
        const fromApi: Fields = {};
        for (const f of error.fields) {
          const name = FIELD_NAMES.find((n) => n === f.field);
          if (name) fromApi[name] = f.message;
        }
        setFieldErrors(fromApi);
        setFormError(Object.keys(fromApi).length === 0 || error.code === 'CONFLICT' ? error.message : null);
      } else {
        setFormError('Error inesperado. Intente de nuevo.');
      }
      setSaving(false);
    }
  }

  const title = !equipment ? 'Nuevo equipo' : identityLocked ? `Actualizar horómetro · ${equipment.code}` : `Editar ${equipment.code}`;

  return (
    <Modal title={title} onClose={onClose}>
      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <label className="field">
            <span>Código</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CAM-001"
              maxLength={30}
              disabled={identityLocked}
              autoFocus={!identityLocked}
              aria-invalid={Boolean(fieldErrors.code)}
            />
            {fieldErrors.code && <small className="field-error">{fieldErrors.code}</small>}
          </label>

          <label className="field">
            <span>Tipo</span>
            <select
              value={typeCode}
              onChange={(e) => setTypeCode(e.target.value)}
              disabled={identityLocked}
              aria-invalid={Boolean(fieldErrors.typeCode)}
            >
              <option value="" disabled>
                Seleccione…
              </option>
              {types.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name} · cada {formatHours(t.maintenanceIntervalHours)}
                </option>
              ))}
            </select>
            {fieldErrors.typeCode && <small className="field-error">{fieldErrors.typeCode}</small>}
          </label>
        </div>

        <label className="field">
          <span>Horómetro (horas de uso)</span>
          <input
            value={hourmeter}
            onChange={(e) => setHourmeter(e.target.value)}
            inputMode="decimal"
            autoFocus={identityLocked}
            aria-invalid={Boolean(fieldErrors.hourmeter)}
          />
          {fieldErrors.hourmeter ? (
            <small className="field-error">{fieldErrors.hourmeter}</small>
          ) : (
            equipment && <small className="hint">Mínimo {formatHours(minHours)}: lectura del último mantenimiento.</small>
          )}
        </label>

        {identityLocked && (
          <p className="muted" style={{ margin: 0, fontSize: '0.8125rem' }}>
            El código y el tipo solo los cambia un supervisor.
          </p>
        )}

        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}

        <footer className="form-actions">
          <button type="button" className="btn btn-neutral" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : equipment ? 'Guardar cambios' : 'Crear equipo'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
