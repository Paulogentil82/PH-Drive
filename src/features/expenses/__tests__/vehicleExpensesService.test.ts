import { describe, it, expect } from 'vitest';
import { vehicleExpensesService } from '../vehicleExpensesService';

describe('vehicleExpensesService', () => {
    it('service should be defined', () => {
        expect(vehicleExpensesService).toBeDefined();
    });
});
