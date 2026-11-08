export type Role = 'SUPERVISOR' | 'OPERADOR';

export type Action = 'registerMaintenance' | 'updateHourmeter' | 'createEquipment' | 'deleteEquipment' | 'editIdentity';

/**
 * What each role may do in the interface. The API enforces the same rules; this only hides
 * actions the user cannot perform, so nobody clicks a button that answers 403.
 */
const RULES: Record<Action, Role[]> = {
  registerMaintenance: ['SUPERVISOR', 'OPERADOR'],
  updateHourmeter: ['SUPERVISOR', 'OPERADOR'],
  createEquipment: ['SUPERVISOR'],
  deleteEquipment: ['SUPERVISOR'],
  // code and type: the identity of the equipment
  editIdentity: ['SUPERVISOR'],
};

export function can(role: Role, action: Action): boolean {
  return RULES[action].includes(role);
}

export function roleLabel(role: Role): string {
  return role === 'SUPERVISOR' ? 'Supervisor' : 'Operador';
}
