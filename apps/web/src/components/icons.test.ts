import { describe, expect, it } from 'vitest';
import { GenericEquipmentIcon, iconFor, typeIcon } from './icons';

describe('iconFor', () => {
  it('returns the icon of each known type', () => {
    expect(iconFor('CAMION')).toBe(typeIcon.CAMION);
    expect(iconFor('CARGADOR')).toBe(typeIcon.CARGADOR);
  });

  it('falls back to a generic icon for a type the frontend does not know yet', () => {
    // a newer API (or a migration ahead of this build) may send types this bundle never saw
    expect(iconFor('GRUA')).toBe(GenericEquipmentIcon);
    expect(iconFor('')).toBe(GenericEquipmentIcon);
  });
});
