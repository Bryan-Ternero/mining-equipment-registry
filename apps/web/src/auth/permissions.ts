export type Role = 'SUPERVISOR' | 'OPERADOR';

export type Action = 'registerMaintenance' | 'updateHourmeter' | 'createEquipment' | 'deleteEquipment' | 'editIdentity';

/**
 * Lo que cada rol puede hacer en la interfaz. La API aplica las mismas reglas; esto solo oculta
 * las acciones que el usuario no puede realizar, para que nadie pulse un botón que responda 403.
 */
const RULES: Record<Action, Role[]> = {
  registerMaintenance: ['SUPERVISOR', 'OPERADOR'],
  updateHourmeter: ['SUPERVISOR', 'OPERADOR'],
  createEquipment: ['SUPERVISOR'],
  deleteEquipment: ['SUPERVISOR'],
  // código y tipo: la identidad del equipo
  editIdentity: ['SUPERVISOR'],
};

export function can(role: Role, action: Action): boolean {
  return RULES[action].includes(role);
}

export function roleLabel(role: Role): string {
  return role === 'SUPERVISOR' ? 'Supervisor' : 'Operador';
}
