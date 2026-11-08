import { useState, type FormEvent } from 'react';
import { ApiError, type Equipment, type EquipmentInput, type EquipmentType, type TypeCode } from '../api';
import { formatHours, parseHours } from '../format';
import { Modal } from './Modal';

interface EquipmentFormProps {
  types: EquipmentType[];
  /** equipment to edit; undefined to create a new one */
  equipment?: Equipment;
  onSubmit: (input: EquipmentInput) => Promise<void>;
  onClose: () => void;
}

type Fields = Partial<Record<'code' | 'typeCode' | 'hourmeter', string>>;

export function EquipmentForm({ types, equipment, onSubmit, onClose }: EquipmentFormProps) {
  const [code, setCode] = useState(equipment?.code ?? '');
  const [typeCode, setTypeCode] = useState<TypeCode | ''>(equipment?.typeCode ?? '');
  const [hourmeter, setHourmeter] = useState(equipment ? String(equipment.hourmeter) : '0');
  const [fieldErrors, setFieldErrors] = useState<Fields>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const minHours = equipment?.lastServiceHours ?? 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const hours = parseHours(hourmeter);
    const errors: Fields = {};
    if (!code.trim()) errors.code = 'Ingrese el código del equipo.';
    if (!typeCode) errors.typeCode = 'Seleccione el tipo.';
    if (hours === null) errors.hourmeter = 'Ingrese un número de horas.';
    else if (hours < minHours) errors.hourmeter = `No puede ser menor a ${formatHours(minHours)} (último mantenimiento).`;
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0 || !typeCode || hours === null) return;

    setSaving(true);
    try {
      await onSubmit({ code: code.trim(), typeCode, hourmeter: hours });
    } catch (error) {
      if (error instanceof ApiError) {
        const fromApi: Fields = {};
        for (const f of error.fields) {
          if (f.field === 'code' || f.field === 'typeCode' || f.field === 'hourmeter') fromApi[f.field] = f.message;
        }
        setFieldErrors(fromApi);
        setFormError(error.code === 'CONFLICT' || Object.keys(fromApi).length === 0 ? error.message : null);
      } else {
        setFormError('Error inesperado. Intente de nuevo.');
      }
      setSaving(false);
    }
  }

  return (
    <Modal title={equipment ? `Editar ${equipment.code}` : 'Nuevo equipo'} onClose={onClose}>
      <form className="form" onSubmit={handleSubmit} noValidate>
        <label className="field">
          <span>Código</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CAM-001"
            maxLength={30}
            autoFocus
            aria-invalid={Boolean(fieldErrors.code)}
          />
          {fieldErrors.code && <small className="field-error">{fieldErrors.code}</small>}
        </label>

        <label className="field">
          <span>Tipo</span>
          <select
            value={typeCode}
            onChange={(e) => setTypeCode(e.target.value as TypeCode)}
            aria-invalid={Boolean(fieldErrors.typeCode)}
          >
            <option value="" disabled>
              Seleccione…
            </option>
            {types.map((t) => (
              <option key={t.code} value={t.code}>
                {t.name} · mantenimiento cada {formatHours(t.maintenanceIntervalHours)}
              </option>
            ))}
          </select>
          {fieldErrors.typeCode && <small className="field-error">{fieldErrors.typeCode}</small>}
        </label>

        <label className="field">
          <span>Horómetro (horas de uso)</span>
          <input
            value={hourmeter}
            onChange={(e) => setHourmeter(e.target.value)}
            inputMode="decimal"
            aria-invalid={Boolean(fieldErrors.hourmeter)}
          />
          {fieldErrors.hourmeter && <small className="field-error">{fieldErrors.hourmeter}</small>}
        </label>

        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}

        <footer className="form-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="button primary" disabled={saving}>
            {saving ? 'Guardando…' : equipment ? 'Guardar cambios' : 'Crear equipo'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
