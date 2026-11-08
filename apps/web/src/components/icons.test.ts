import { describe, expect, it } from 'vitest';
import { GenericEquipmentIcon, iconFor, typeIcon } from './icons';

describe('iconFor', () => {
  it('returns the icon of each known type', () => {
    expect(iconFor('CAMION')).toBe(typeIcon.CAMION);
    expect(iconFor('CARGADOR')).toBe(typeIcon.CARGADOR);
  });

  it('falls back to a generic icon for a type the frontend does not know yet', () => {
    // una API más reciente (o una migración por delante de este build) puede enviar tipos que este bundle
    // nunca vio
    expect(iconFor('GRUA')).toBe(GenericEquipmentIcon);
    expect(iconFor('')).toBe(GenericEquipmentIcon);
  });
});
