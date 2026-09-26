import { describe, it, expect } from 'vitest';
import { parsePtBrNumber } from '../numberParser';

describe('parsePtBrNumber', () => {
    it('should parse various formats', () => {
        expect(parsePtBrNumber("250")).toBe(250);
        expect(parsePtBrNumber("250,00")).toBe(250);
        expect(parsePtBrNumber("1.250,00")).toBe(1250);
        expect(parsePtBrNumber("1.250,50")).toBe(1250.5);
        expect(parsePtBrNumber("")).toBeNull();
    });

    it('should return null for invalid values', () => {
        expect(parsePtBrNumber("abc")).toBeNull();
    });
});
