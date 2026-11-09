/**
 * Ficha con el detalle de un equipo: fecha de registro, último mantenimiento, comentario, horómetro
 * en ese servicio, cantidad de mantenimientos y última actualización. Se usa en la tarjeta flotante
 * (escritorio) y en el panel desplegable de cada fila (celular y teclado).
 */
import type { Equipment } from '../api';
import { equipmentDetails } from '../details';

export function EquipmentDetails({ equipment }: { equipment: Equipment }) {
  return (
    <dl className="details-list">
      {equipmentDetails(equipment).map((row) => (
        <div key={row.label} className="details-item">
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
