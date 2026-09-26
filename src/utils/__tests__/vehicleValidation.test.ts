import { describe, it, expect } from 'vitest';

// Pure helper function for validating odometer rules
export function validateOdometer(currentOdometer: number, newOdometer: number): { isValid: boolean; warning: boolean; message?: string } {
  if (newOdometer < 0) {
    return { isValid: false, warning: false, message: 'O odômetro não pode ser negativo.' };
  }
  if (newOdometer < currentOdometer) {
    return { isValid: true, warning: true, message: 'O novo odômetro é inferior ao valor registrado atualmente.' };
  }
  return { isValid: true, warning: false };
}

describe('Vehicle Odometer Validation', () => {
  it('should accept valid odometer increase', () => {
    const result = validateOdometer(10000, 10500);
    expect(result.isValid).toBe(true);
    expect(result.warning).toBe(false);
  });

  it('should reject negative odometer values', () => {
    const result = validateOdometer(10000, -100);
    expect(result.isValid).toBe(false);
  });

  it('should warn when new odometer is lower than current value', () => {
    const result = validateOdometer(10000, 9500);
    expect(result.isValid).toBe(true);
    expect(result.warning).toBe(true);
    expect(result.message).toContain('inferior ao valor registrado');
  });
});
